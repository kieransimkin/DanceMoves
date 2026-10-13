/** One master clock shared by explicitly associated native and remote players. */
const youtubeLoaders = new WeakMap();
export function validatePlaybackMapping(input, masterDuration) {
  const offset = input.offset ?? 0, duration = input.duration ?? masterDuration, playerStart = input.playerStart ?? 0;
  for (const [key,value] of Object.entries({offset,duration,playerStart,masterDuration})) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (key === 'duration' || key === 'masterDuration') && value === 0) throw new RangeError(`${key} must be a finite positive duration or nonnegative offset`);
  }
  if (offset + duration > masterDuration + 0.001) throw new RangeError('The clip extends beyond its associated master');
  return Object.freeze({offset,duration,playerStart,masterDuration});
}
export function loadYouTubeAPI(host) {
  if (host.YT?.Player) return Promise.resolve(host.YT);
  if (youtubeLoaders.has(host)) return youtubeLoaders.get(host);
  const pending = new Promise((resolve,reject) => {
    const previous = host.onYouTubeIframeAPIReady;
    let timeout;
    const script = host.document.createElement('script');
    function finish(error) {
      host.clearTimeout(timeout);
      if (host.onYouTubeIframeAPIReady === ready) host.onYouTubeIframeAPIReady = previous;
      script.removeEventListener('error', failed);
      if (error) {script.remove();youtubeLoaders.delete(host);reject(error);} else resolve(host.YT);
    }
    function ready() {try {previous?.();} finally {finish(host.YT?.Player ? null : new Error('YouTube API unavailable'));}}
    function failed() {finish(new Error('YouTube API failed to load'));}
    host.onYouTubeIframeAPIReady = ready;
    script.src = 'https://www.youtube.com/iframe_api';
    script.addEventListener('error',failed,{once:true});
    timeout = host.setTimeout(()=>finish(new Error('YouTube API timed out')),20000);
    host.document.head.appendChild(script);
  });
  youtubeLoaders.set(host,pending);
  return pending;
}
export function installPlayback(scope, api, host = scope.document.defaultView) {
  const groups = new Map(), transports = new WeakSet(), controllers = new Set(), registered = new WeakMap();
  let disposed = false;
  function emit(target,type) {target.dispatchEvent(new host.Event(type));}
  function groupFor(reference) {
    if (disposed) throw new Error('DanceMoves playback owner is destroyed');
    const master=reference?.element || reference,declared=reference?.element?reference.duration:undefined;
    const isNative=!!master?.addEventListener && ['AUDIO','VIDEO'].includes(master.tagName);
    if(!isNative && (!master || typeof master.id!=='string' || !master.id.trim() || master.id.length>160 || typeof master.duration!=='number' || !Number.isFinite(master.duration) || master.duration<=0))throw new TypeError('A native master or identified master duration is required');
    if(isNative && (master.ownerDocument!==host.document || !scope.legacyGlobals && !scope.root.contains(master)))throw new TypeError('The master must belong to this runtime root');
    if (groups.has(master)) {const group=groups.get(master);group.setDuration(declared);return group;}
    const transport = new host.EventTarget();
    transports.add(transport);
    let active = null, lastPaused = true;
    let declaredDuration=declared||0;
    function setDuration(value){if(value===undefined)return;if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new RangeError('Declared master duration must be positive and finite');if(declaredDuration&&Math.abs(declaredDuration-value)>.001)throw new RangeError('Conflicting master durations');if(isNative&&Number(master.duration)>0&&Math.abs(Number(master.duration)-value)>.25)throw new RangeError('Declared master duration does not match its native reference');declaredDuration=value;}
    setDuration(declared);
    const duration = () => declaredDuration || (Number(master.duration)>0 && Number.isFinite(Number(master.duration)) ? Number(master.duration) : Number(api.config?.masterDurationMilliseconds || 0) / 1000);
    const target=isNative?master:scope.root;
    const native = {element:isNative?master:null,read:()=>({time:Number(master.currentTime)||0,paused:isNative?master.paused:true,ended:master.ended||false,rate:master.playbackRate||1,seeking:master.seeking||false,error:master.error}),pause:()=>master.pause?.(),play:()=>master.play?.(),seek:time=>{if(isNative)master.currentTime=time;},mapping:null};
    active = native;
    function read() {
      const raw = active.read(), map = active.mapping || {offset:0,playerStart:0,duration:duration()};
      const local = raw.time-map.playerStart, outside = local < -0.001 || local > map.duration + 0.001;
      return {...raw,time:map.offset+Math.max(0,Math.min(map.duration,local)),paused:raw.paused||outside,ended:raw.ended||local>map.duration+0.001};
    }
    Object.defineProperties(transport,{
      nodeType:{value:1},tagName:{get:()=>isNative?master.tagName:'VIDEO'},ownerDocument:{get:()=>target.ownerDocument},
      dataset:{get:()=>target.dataset},id:{get:()=>master.id},isConnected:{get:()=>target.isConnected},
      currentTime:{get:()=>read().time,set:value=>{const map=active.mapping||{offset:0,playerStart:0,duration:duration()};active.seek(map.playerStart+Math.max(0,Math.min(map.duration,Number(value)-map.offset)));}},
      duration:{get:duration},paused:{get:()=>read().paused},ended:{get:()=>read().ended},seeking:{get:()=>read().seeking||false},
      playbackRate:{get:()=>read().rate},error:{get:()=>read().error||null},element:{value:isNative?master:null},
      activePlayer:{get:()=>active.element},masterId:{get:()=>master.currentSrc||master.src||master.id}
    });
    transport.matches=selector=>target.matches(selector);
    transport.getAttribute=name=>target.getAttribute(name);
    transport.setAttribute=(name,value)=>target.setAttribute(name,value);
    transport.removeAttribute=name=>target.removeAttribute(name);
    transport.play=()=>active.play();transport.pause=()=>active.pause();
    function activate(source) {
      if (active!==source) {
        const previous=active;active=source;
        previous.pause();
        emit(transport,'seeking');emit(transport,'seeked');
      }
    }
    function forward(source,type) {
      if (type==='play'||type==='playing') activate(source);
      if (active!==source) return;
      const paused=read().paused;
      if(type==='timeupdate' && paused!==lastPaused)emit(transport,paused?'pause':'playing');
      lastPaused=paused;
      emit(transport,type);
    }
    const events=['loadedmetadata','durationchange','play','playing','pause','ended','seeking','seeked','ratechange','timeupdate','waiting','error'];
    const removers=[];
    function bindNative(element,mapping) {
      const source=element===master?native:{element,mapping,read:()=>({time:Number(element.currentTime)||0,paused:element.paused,ended:element.ended,rate:element.playbackRate||1,seeking:element.seeking,error:element.error}),pause:()=>element.pause(),play:()=>element.play(),seek:time=>{element.currentTime=time;}};
      source.removers=[];
      for(const type of events){const listener=()=>forward(source,type);scope.listen(element,type,listener);const remove=()=>scope.unlisten(element,type,listener);removers.push(remove);source.removers.push(remove);}
      return source;
    }
    if(isNative)bindNative(master,null);
    const group={transport,duration,setDuration,activate,forward,bindNative,isActive:source=>active===source,
      reconcile(source){if(active!==source)return;const paused=read().paused;if(paused!==lastPaused){lastPaused=paused;emit(transport,paused?'pause':'playing');}emit(transport,'timeupdate');},
      remove(source){if(active===source){source.pause();active=native;lastPaused=true;emit(transport,'pause');emit(transport,'seeking');emit(transport,'seeked');}},
      destroy(){removers.splice(0).forEach(remove=>remove());emit(transport,'pause');}
    };
    groups.set(master,group);return group;
  }
  function registerPlayer(options) {
    if (!options || options.masterVerified!==true) throw new TypeError('An explicitly verified master association is required');
    const group=groupFor(options.master), mapping=validatePlaybackMapping(options,group.duration());
    const element=options.player;
    if(!element?.addEventListener || !['AUDIO','VIDEO'].includes(element.tagName))throw new TypeError('player must be native audio or video');
    if(element.ownerDocument!==host.document || !scope.legacyGlobals && !scope.root.contains(element))throw new TypeError('The player must belong to this runtime root');
    if(registered.has(element))throw new Error('Player already has a playback owner');
    if(element===options.master)throw new TypeError('The master is already registered');
    const source=group.bindNative(element,mapping);
    let destroyed=false;
    const controller={source:group.transport,mapping,teardown(){if(destroyed)return;destroyed=true;source.removers.splice(0).forEach(remove=>remove());group.remove(source);registered.delete(element);controllers.delete(controller);},snapshot(){return {kind:'native',mapping,active:group.isActive(source),destroyed};}};
    registered.set(element,controller);
    Promise.resolve(api.ready).then(()=>{if(!destroyed&&!disposed)api.registerPlaybackSource?.(group.transport);});
    controllers.add(controller);return controller;
  }
  function registerYouTube(options) {
    if(!options || options.masterVerified!==true)throw new TypeError('An explicitly verified master association is required');
    const group=groupFor(options.master),mapping=validatePlaybackMapping(options,group.duration());
    const iframe=options.iframe;
    if(iframe?.tagName!=='IFRAME')throw new TypeError('A YouTube iframe is required');
    if(iframe.ownerDocument!==host.document || !scope.legacyGlobals && !scope.root.contains(iframe))throw new TypeError('The iframe must belong to this runtime root');
    if(registered.has(iframe))throw new Error('Player already has a playback owner');
    const url=new URL(iframe.src,host.location.href);
    if(!/^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{11}(\?|$)/.test(url.href))throw new TypeError('Unsupported YouTube embed');
    url.searchParams.set('enablejsapi','1');url.searchParams.set('origin',host.location.origin);
    const expectedVideoId=url.pathname.split('/').at(-1);
    if(iframe.src!==url.href)iframe.src=url.href;
    let player=null,state=-1,error=null,frame=0,destroyed=false,lastTime=null,lastWall=null,lastRate=1,readyTimer=0,rejectReady=null;
    const source={element:iframe,mapping,
      read:()=>({time:player?.getCurrentTime?.()||0,paused:state!==1,ended:state===0,rate:player?.getPlaybackRate?.()||1,error}),
      pause:()=>player?.pauseVideo?.(),play:()=>player?.playVideo?.(),seek:time=>player?.seekTo?.(time,true)};
    function stop(){if(frame)scope.window.cancelAnimationFrame(frame);frame=0;lastTime=null;lastWall=null;}
    function sample(wall){frame=0;if(destroyed||state!==1||scope.document.hidden||!group.isActive(source))return;
      const raw=source.read();
      if(lastTime!==null && Math.abs(raw.time-lastTime-(wall-lastWall)/1000*raw.rate)>.4){group.forward(source,'seeking');group.forward(source,'seeked');}
      if(raw.rate!==lastRate){lastRate=raw.rate;group.forward(source,'ratechange');}
      lastTime=raw.time;lastWall=wall;group.reconcile(source);
      frame=scope.window.requestAnimationFrame(sample);
    }
    function resume(){stop();if(!destroyed&&state===1&&!scope.document.hidden&&group.isActive(source))frame=scope.window.requestAnimationFrame(sample);}
    const visibility=()=>{if(scope.document.hidden)stop();else {group.forward(source,'seeking');group.forward(source,'seeked');resume();}};
    const pageHide=()=>stop(),pageShow=()=>{if(player?.getPlayerState)state=player.getPlayerState();visibility();};
    scope.listen(scope.document,'visibilitychange',visibility);
    scope.listen(host,'pagehide',pageHide);scope.listen(host,'pageshow',pageShow);
    const controller={source:group.transport,mapping,ready:null,
      teardown(){if(destroyed)return;destroyed=true;stop();if(readyTimer)scope.window.clearTimeout(readyTimer);readyTimer=0;rejectReady?.(new Error('YouTube playback owner removed'));rejectReady=null;group.remove(source);scope.unlisten(scope.document,'visibilitychange',visibility);scope.unlisten(host,'pagehide',pageHide);scope.unlisten(host,'pageshow',pageShow);player?.destroy?.();registered.delete(iframe);controllers.delete(controller);},
      snapshot(){return {kind:'youtube',mapping,state,error,active:group.isActive(source),destroyed,polling:!!frame,time:group.transport.currentTime};}};
    controllers.add(controller);
    registered.set(iframe,controller);
    Promise.resolve(api.ready).then(()=>{if(!destroyed&&!disposed)api.registerPlaybackSource?.(group.transport);});
    controller.ready=loadYouTubeAPI(host).then(YT=>{
      if(destroyed||disposed)return controller;
      return new Promise((resolve,reject)=>{
        rejectReady=reject;
        readyTimer=scope.window.setTimeout(()=>{readyTimer=0;error=new Error('YouTube player readiness timed out');rejectReady=null;reject(error);},15000);
        player=new YT.Player(iframe,{events:{
          onReady(){if(destroyed)return;if(readyTimer)scope.window.clearTimeout(readyTimer);readyTimer=0;rejectReady=null;
            const actual=Number(player.getDuration?.());
            if(actual>0 && actual+.25<mapping.playerStart+mapping.duration){error=new Error('The mapped soundtrack window exceeds the video duration');reject(error);return;}
            group.forward(source,'loadedmetadata');resolve(controller);},
          onStateChange(event){if(destroyed)return;state=event.data;stop();if(state===1){
            let actualId;try{actualId=new URL(player.getVideoUrl()).searchParams.get('v');}catch{}
            if(actualId!==expectedVideoId){error=new Error('YouTube switched away from the verified soundtrack asset');state=-1;group.forward(source,'pause');group.forward(source,'error');return;}
            const actualDuration=Number(player.getDuration?.());
            if(actualDuration>0&&actualDuration+.25<mapping.playerStart+mapping.duration){error=new Error('The mapped soundtrack window exceeds the video duration');state=-1;group.forward(source,'pause');group.forward(source,'error');return;}
            group.forward(source,'play');group.forward(source,'playing');resume();}else group.forward(source,state===0?'ended':state===3?'waiting':'pause');if(state===3)group.forward(source,'pause');},
          onPlaybackRateChange(){if(!destroyed)group.forward(source,'ratechange');},
          onError(event){if(destroyed)return;error=new Error('YouTube playback error '+event.data);state=-1;stop();if(readyTimer)scope.window.clearTimeout(readyTimer);readyTimer=0;rejectReady=null;group.forward(source,'pause');group.forward(source,'error');reject(error);}
        }});
      });
    });
    controller.ready.catch(()=>{});
    return controller;
  }
  Object.assign(api,{playbackSource:master=>transports.has(master)?master:groupFor(master).transport,registerPlayer,registerYouTube});
  scope.onDispose(()=>{disposed=true;for(const controller of [...controllers])controller.teardown();for(const group of groups.values())group.destroy();groups.clear();});
}
