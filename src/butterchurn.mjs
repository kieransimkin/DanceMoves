/** Opt-in Butterchurn 2.6.7 rendering driven by an existing playback owner. */
const silent = new Uint8Array(1024).fill(128);
const silence = {timeByteArray: silent, timeByteArrayL: silent, timeByteArrayR: silent};
const vertexSource = '#version 300 es\n' +
  'out vec2 uv; void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));' +
  'uv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';
const fragmentSource = '#version 300 es\n' +
  'precision mediump float;in vec2 uv;uniform sampler2D inputLayer;uniform float opacity;out vec4 colour;' +
  'void main(){vec4 pixel=texture(inputLayer,uv);colour=vec4(pixel.rgb,pixel.a*opacity);}';

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  const error = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error('Butterchurn feedback shader: ' + error);
}

function createInputLayer(renderer) {
  const {gl} = renderer;
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Butterchurn feedback program: ' + error);
  }
  const opacityLocation = gl.getUniformLocation(program, 'opacity');
  const sourceLocation = gl.getUniformLocation(program, 'inputLayer');
  const texture = gl.createTexture();
  const vao = gl.createVertexArray();
  let width = 0;
  let height = 0;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return {
    draw(source, opacity) {
      const w = source.videoWidth ?? source.naturalWidth ?? source.displayWidth ?? source.width;
      const h = source.videoHeight ?? source.naturalHeight ?? source.displayHeight ?? source.height;
      if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 4096 || h > 4096)
        throw new RangeError('Butterchurn feedback source must be a ready image or canvas within 4096 px per edge');
      gl.activeTexture(gl.TEXTURE0);
      gl.bindSampler(0, null);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (w === width && h === height) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        width = w;
        height = h;
      }

      // Butterchurn swaps this attachment into the previous frame immediately
      // before its next warp. The context belongs exclusively to this renderer.
      gl.bindFramebuffer(gl.FRAMEBUFFER, renderer.targetFrameBuffer);
      gl.viewport(0, 0, renderer.texsizeX, renderer.texsizeY);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform1i(sourceLocation, 0);
      gl.uniform1f(opacityLocation, opacity);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.bindTexture(gl.TEXTURE_2D, null);
    },
    destroy() {
      gl.deleteVertexArray(vao);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    },
  };
}

function validatePreset(preset) {
  if (typeof preset?.init_eqs !== 'function' || typeof preset.frame_eqs !== 'function' ||
      !Array.isArray(preset.shapes) || !Array.isArray(preset.waves)) {
    throw new TypeError('Butterchurn requires an authored function-form preset with shapes and waves arrays');
  }
  // Butterchurn applies defaults by writing into these records.
  const clone = item => ({...item, baseVals: {...item.baseVals}});
  return {...clone(preset), shapes: preset.shapes.map(clone), waves: preset.waves.map(clone)};
}

export function createButterchurnService(scope, resources) {
  const handles = new Set();

  async function create(options = {}) {
    if (scope.disposed) throw new Error('DanceMoves mount is destroyed');
    const {id, maxDimension = 960} = options;
    if (typeof id !== 'string' || !id.trim() || id.length > 160) throw new TypeError('Butterchurn requires a unique id of 1..160 characters');
    if (!Number.isInteger(maxDimension) || maxDimension < 128 || maxDimension > 1920)
      throw new RangeError('Butterchurn maxDimension must be an integer in [128, 1920]');
    const target = resources.resolveElement(options.target, 'Butterchurn canvas');
    if (target.tagName !== 'CANVAS') throw new TypeError('Butterchurn target must be a canvas');
    const preset = validatePreset(options.preset);
    resources.assertCanvasAvailable(target);
    resources.assertIdAvailable(id);
    const before = {width: target.getAttribute('width'), height: target.getAttribute('height')};
    const host = scope.root.ownerDocument.defaultView;
    const output = scope.root.ownerDocument.createElement('canvas');
    const reduced = host.matchMedia('(prefers-reduced-motion: reduce)');
    const forced = host.matchMedia('(forced-colors: active)');
    let status = 'loading';
    let context, gl, renderer, visualiser, input, size;
    let time = 0, previousTime = null, frames = 0;

    function destroy() {
      if (status === 'destroyed') return;
      status = 'destroyed';
      input?.destroy();
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      if (size && target.width === size.width && target.height === size.height) {
        for (const [name, value] of Object.entries(before))
          if (value === null) target.removeAttribute(name); else target.setAttribute(name, value);
        context?.clearRect(0, 0, target.width, target.height);
      }
      input = gl = renderer = visualiser = context = null;
      handles.delete(handle);
      resources.releaseCanvas(target);
    }
    function clear() {
      gl.clearColor(0, 0, 0, 1);
      for (const buffer of [renderer.targetFrameBuffer, renderer.prevFrameBuffer, null]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    function reset() {
      if (status !== 'ready') return;
      previousTime = null;
      clear();
      context.clearRect(0, 0, target.width, target.height);
    }
    function resize(width, height) {
      if (status !== 'ready') return;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        throw new RangeError('Butterchurn requires positive finite dimensions');
      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      if (w === size?.width && h === size?.height) return;
      target.width = w;
      target.height = h;
      output.width = w;
      output.height = h;
      const previousTexture = renderer.targetTexture;
      visualiser.setRendererSize(w, h);
      if (renderer.targetTexture !== previousTexture) gl.deleteTexture(previousTexture);
      size = {width: w, height: h};
      reset();
    }
    function render({time: sourceSeconds, source, opacity = 1} = {}) {
      if (status !== 'ready' || host.document.hidden || reduced.matches || forced.matches) return false;
      if (!Number.isFinite(sourceSeconds) || sourceSeconds < 0 || !Number.isFinite(opacity) || opacity < 0 || opacity > 1)
        throw new RangeError('Butterchurn requires nonnegative media time and an opacity from 0 to 1');
      if (gl.isContextLost()) {
        status = 'error';
        context.clearRect(0, 0, target.width, target.height);
        return false;
      }
      if (previousTime !== null && (sourceSeconds < previousTime || sourceSeconds - previousTime > .25)) reset();
      time = sourceSeconds;
      const elapsedTime = previousTime === null ? 1 / 60 : Math.max(1 / 240, time - previousTime);
      if (source && opacity > 0) {
        input ??= createInputLayer(renderer);
        input.draw(source, opacity);
      }
      visualiser.render({elapsedTime, audioLevels: silence});
      context.drawImage(output, 0, 0, target.width, target.height);
      previousTime = time;
      frames++;
      return true;
    }

    const handle = Object.freeze({id, render, reset, resize, destroy,
      snapshot: () => ({id, status, frames, sourceSeconds: previousTime, ...size})});
    resources.claimCanvas(target, handle);
    handles.add(handle);

    try {
      const imported = await import('butterchurn/lib/butterchurn.min.js');
      if (status === 'destroyed') throw new Error('Butterchurn owner was destroyed while loading');
      const engine = imported.default.default ?? imported.default;
      const OfflineContext = host.OfflineAudioContext ?? host.webkitOfflineAudioContext;
      if (!OfflineContext) throw new Error('Offline Web Audio is unavailable');
      context = target.getContext('2d');
      gl = output.getContext('webgl2', {alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false});
      if (!context || !gl) throw new Error('Butterchurn requires WebGL 2 and a Canvas 2D target');
      const silentContext = new OfflineContext(2, 2048, 44100);
      visualiser = engine.createVisualizer(silentContext, output, {width: 1, height: 1, meshWidth: 24, meshHeight: 18, pixelRatio: 1, textureRatio: 1});
      renderer = visualiser.renderer;
      if (renderer.gl !== gl || !renderer.targetFrameBuffer || !renderer.prevFrameBuffer)
        throw new Error('The pinned Butterchurn feedback buffers are unavailable');
      visualiser.loadPreset(preset, 0);
      renderer.calcTimeAndFPS = function () {
        this.time = time;
        this.fps = 60;
        this.blending = false;
      };
      status = 'ready';
      const rect = target.getBoundingClientRect();
      resize(rect.width || target.width, rect.height || target.height);
      return handle;
    } catch (error) {
      destroy();
      throw error;
    }
  }

  scope.onDispose(() => {for (const handle of [...handles]) handle.destroy();});
  return Object.freeze({create});
}
