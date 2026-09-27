(function (window, document) {
  "use strict";

  var root = document.querySelector('.ks-epk');
  var hero = root && root.querySelector('.epk-hero');
  if (!root || !hero || window.DanceMovesPaperDreams) return;

  var motion = window.DanceMoves || null;
  var config = window.danceMovesPaperDreamsConfig || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var compact = window.matchMedia('(max-width: 760px), (update: slow)');
  var stage = document.createElement('div');
  stage.className = 'paper-dreams-flight';
  stage.setAttribute('aria-hidden', 'true');
  stage.style.setProperty('--paper-dreams-atlas', 'url("' + String(config.atlasUrl || '') + '")');
  hero.insertBefore(stage, hero.firstChild);

  var profiles = [
    { scale: .48, parallax: .62, opacity: .56 },
    { scale: .82, parallax: .90, opacity: .82 },
    { scale: 1.28, parallax: 1.16, opacity: .96 }
  ];
  var targets = {
    glide:[1,-.04,-6,0], climb:[.68,-.23,-25,-7], mush:[.38,-.03,-20,-3],
    stall:[.25,.12,-14,2], drop:[.76,.44,36,8], recovery:[1.18,.20,17,5], swoop:[1.02,-.20,-18,-8]
  };
  var durations = { glide:3.0, climb:1.02, mush:.32, stall:.22, drop:.78, recovery:.68, swoop:.92 };
  var order = ['glide','climb','mush','stall','drop','recovery','swoop'];
  var planes = [];
  var frame = 0;
  var last = 0;
  var running = false;
  var visible = true;
  var observer = null;
  var seed = 2601890;

  function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function enter(plane, state) { plane.state = state; plane.stateTime = 0; }
  function makePlane(index) {
    var depth = index % 3;
    var profile = profiles[depth];
    var node = document.createElement('span');
    var sprite = (index * 5) % 24;
    var col = sprite % 6;
    var row = Math.floor(sprite / 6);
    node.className = 'paper-dreams-flight__plane';
    node.dataset.depth = String(depth);
    node.style.setProperty('--sprite-x', (col * 20) + '%');
    node.style.setProperty('--sprite-y', (row * 33.333333) + '%');
    node.style.setProperty('--plane-size', (92 * profile.scale) + 'px');
    node.style.setProperty('--plane-size-compact', (70 * profile.scale) + 'px');
    node.style.setProperty('--plane-opacity', profile.opacity);
    node.style.setProperty('--static-transform', 'translate3d(' + (16 + index * 27) + 'vw,' + (20 + index * 16) + 'vh,0) rotate(' + (-10 + index * 9) + 'deg)');
    stage.appendChild(node);
    return {
      node:node, depth:depth, profile:profile, x:-.12+(index/Math.max(1,Number(config.planeCount||12)-1))*1.34, y:.12+random()*.68,
      vx:.38+random()*.09, vy:-.02, pitch:-7, pitchRate:0, roll:0,
      state:'glide', stateTime:index*.23, age:index*.31, cycle:1.1+random()*2.1,
      phase:random()*Math.PI*2
    };
  }
  for (var i=0;i<Number(config.planeCount || 12);i+=1) planes.push(makePlane(i));

  function advanceState(plane) {
    if (plane.state === 'glide' && plane.age >= plane.cycle) enter(plane, 'climb');
    else if (plane.state !== 'glide' && plane.stateTime >= durations[plane.state]) {
      var next = order[(order.indexOf(plane.state) + 1) % order.length];
      enter(plane, next);
      if (next === 'glide') plane.cycle = plane.age + 1.2 + random()*.9;
    }
  }
  function step(plane, dt, time) {
    plane.age += dt; plane.stateTime += dt; advanceState(plane);
    var target = targets[plane.state];
    var response = plane.state === 'stall' ? 5 : (plane.state === 'climb' || plane.state === 'swoop' ? 1.9 : 3.2);
    var cruise = .44;
    var targetVx = cruise * target[0];
    var targetVy = target[1] * (cruise / .22);
    plane.vx += (targetVx-plane.vx)*Math.min(1,dt*response);
    plane.vy += (targetVy-plane.vy)*Math.min(1,dt*response);
    var targetPitch = target[2];
    var pitchResponse = plane.state === 'mush' || plane.state === 'stall' ? 2.2 : 4;
    plane.pitchRate += ((targetPitch-plane.pitch)*pitchResponse-plane.pitchRate*3)*dt;
    plane.pitch += plane.pitchRate*dt;
    plane.roll += (target[3]-plane.roll)*Math.min(1,dt*5.2);
    plane.x += plane.vx*dt; plane.y += plane.vy*dt;
    if (plane.x>1.28 || plane.y>1.24 || plane.y<-.3) {
      plane.x=-.24-random()*.3; plane.y=.12+random()*.68; plane.vx=.39+random()*.09; plane.vy=-.02;
      plane.pitch=-7; plane.pitchRate=0; plane.roll=0; plane.age=0; plane.cycle=.8+random()*1.4; enter(plane,'glide');
    }
    var x=.5+(plane.x-.5)*plane.profile.parallax + Math.sin(time*.21+plane.depth*1.7)*(plane.profile.parallax-.9)*.055;
    var y=.5+(plane.y-.5)*(.76+.18*plane.profile.parallax) + Math.cos(time*.16+plane.depth)*(plane.profile.parallax-.9)*.035;
    var width=hero.clientWidth, height=hero.clientHeight;
    var angle=-plane.pitch+plane.roll*.28;
    var squeeze=1-.22*Math.min(1,Math.abs(plane.roll)/42);
    plane.node.style.transform='translate3d('+(x*width).toFixed(2)+'px,'+(y*height).toFixed(2)+'px,0) rotate('+angle.toFixed(2)+'deg) scaleX('+squeeze.toFixed(3)+')';
  }
  function tick(now) {
    if (!running) return;
    var dt=last ? clamp((now-last)/1000,0,.05) : 1/60; last=now;
    var bpm=Number(config.bpm||120);
    var seconds=(motion && typeof motion.currentTick==='function' ? motion.currentTick({clock:'page'}) : now*bpm/60000*16)*60/(bpm*16);
    for (var i=0;i<planes.length;i+=1) if (!compact.matches || i<Number(config.compactPlaneCount||5)) step(planes[i],dt,seconds);
    frame=window.requestAnimationFrame(tick);
  }
  function reconcile() {
    stage.dataset.quality=reduce.matches?'static':(compact.matches?'compact':'full');
    var shouldRun=!reduce.matches && visible && !document.hidden;
    if (shouldRun && !running) { running=true; last=0; frame=window.requestAnimationFrame(tick); }
    else if (!shouldRun && running) { running=false; window.cancelAnimationFrame(frame); frame=0; }
  }
  reduce.addEventListener('change',reconcile); compact.addEventListener('change',reconcile);
  document.addEventListener('visibilitychange',reconcile);
  if ('IntersectionObserver' in window) {
    observer=new IntersectionObserver(function(entries){visible=Boolean(entries[0]&&entries[0].isIntersecting);reconcile();},{rootMargin:'120px'});
    observer.observe(hero);
  }
  reconcile();

  window.DanceMovesPaperDreams={
    root:stage,
    snapshot:function(){return {version:'2.6.2',planes:planes.length,active:running,quality:stage.dataset.quality,bpm:Number(config.bpm||120),bounds:'hero',states:planes.map(function(p){return p.state;})};},
    teardown:function(){running=false;if(frame)window.cancelAnimationFrame(frame);if(observer)observer.disconnect();reduce.removeEventListener('change',reconcile);compact.removeEventListener('change',reconcile);document.removeEventListener('visibilitychange',reconcile);stage.remove();}
  };
}(window, document));
