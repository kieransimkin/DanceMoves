/** Explicit, origin-bound child-page transport. No media, cue or motion engine. */
const PROTOCOL = 'dancemoves.child-playback.v1';
const EVENTS = new Set(['snapshot','loadedmetadata','durationchange','play','playing','pause','ended','seeking','seeked','ratechange','timeupdate','waiting','error']);
const MAX_SECONDS = 86400;
function identity(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new TypeError(`${name} must be a nonempty string of at most 200 characters`);
  return value;
}
function exactOrigin(value) {
  const url = new URL(value);
  if (!['http:','https:'].includes(url.protocol) || url.origin !== value) throw new TypeError('An exact HTTP(S) origin is required');
  return value;
}
function context(options) {
  const host = options.window || globalThis.window;
  if (!host?.document || !host.crypto?.randomUUID) throw new TypeError('A browser Window with crypto.randomUUID is required');
  return {host, channel: identity(options.channel,'channel'), assetId: identity(options.assetId,'assetId'), origin: exactOrigin(options.origin)};
}
function validState(value) {
  return value && typeof value === 'object' &&
    typeof value.time === 'number' && Number.isFinite(value.time) && value.time >= 0 &&
    typeof value.duration === 'number' && Number.isFinite(value.duration) && value.duration > 0 && value.duration <= MAX_SECONDS && value.time <= value.duration + .25 &&
    typeof value.rate === 'number' && Number.isFinite(value.rate) && value.rate >= .0625 && value.rate <= 16 &&
    ['paused','ended','seeking','buffering','error'].every(key => typeof value[key] === 'boolean');
}
function packet(data, channel, assetId) {
  return data && typeof data === 'object' && data.protocol === PROTOCOL && data.channel === channel && data.assetId === assetId;
}
function resources(host) {
  const removers = [], timers = new Set();
  return {
    listen(target,type,callback) {target.addEventListener(type,callback);removers.push(()=>target.removeEventListener(type,callback));},
    later(callback,delay) {const id=host.setTimeout(()=>{timers.delete(id);callback();},delay);timers.add(id);return id;},
    cancel(id) {if(id){host.clearTimeout(id);timers.delete(id);}},
    dispose() {removers.splice(0).forEach(remove=>remove());for(const id of timers)host.clearTimeout(id);timers.clear();},
    snapshot() {return {listeners:removers.length,timers:timers.size};}
  };
}

/** Publish actual native media or DanceMoves playbackSource state to one parent. */
export function createPlaybackPublisher(options = {}) {
  const {host,channel,assetId,origin}=context(options), source=options.source;
  const target=options.targetWindow || host.parent;
  if (!source?.addEventListener || !source?.pause || !target?.postMessage || target===host) throw new TypeError('A playback source and distinct target Window are required');
  const owned=resources(host);
  let session=null, sequence=0, commandSequence=0, timer=0, destroyed=false, suspended=false;
  const envelope=(type,extra={})=>({protocol:PROTOCOL,channel,assetId,session,type,...extra});
  function send(type,extra) {target.postMessage(envelope(type,extra),origin);}
  function stop() {owned.cancel(timer);timer=0;}
  function sample(event='snapshot') {
    stop();if(destroyed||suspended||!session)return;
    const state={time:Number(source.currentTime),duration:Number(source.duration),rate:Number(source.playbackRate),paused:!!source.paused,ended:!!source.ended,seeking:!!source.seeking,buffering:event==='waiting',error:!!source.error};
    if (!validState(state)) return; // No fabricated metadata or unknown duration.
    send('state',{sequence:++sequence,event,state});
    if(!state.paused&&!state.ended&&!state.error&&!state.buffering&&!host.document.hidden)timer=owned.later(()=>sample(),250);
  }
  function disconnect(reason) {stop();source.pause();if(session)send('disconnect',{reason});session=null;}
  function message(event) {
    const data=event.data;
    if(destroyed||suspended||event.source!==target||event.origin!==origin||!packet(data,channel,assetId))return;
    if(data.type==='connect' && typeof data.session==='string' && /^[0-9a-f-]{36}$/i.test(data.session)) {
      if(session!==data.session){session=data.session;sequence=0;commandSequence=0;}
      sample();return;
    }
    if(data.session!==session||!session)return;
    if(data.type==='disconnect'){disconnect('parent-disconnected');return;}
    if(data.type!=='command'||!Number.isSafeInteger(data.sequence)||data.sequence<=commandSequence)return;
    if(!['pause','seek','play'].includes(data.command))return;
    if(data.command==='seek' && (typeof data.time!=='number'||!Number.isFinite(data.time)||data.time<0||data.time>Number(source.duration)))return;
    commandSequence=data.sequence;
    const currentSession=session;
    Promise.resolve().then(()=>{
      if(destroyed||session!==currentSession)return;
      if(data.command==='pause')source.pause();
      else if(data.command==='seek')source.currentTime=data.time;
      else if(options.allowPlayCommands===true)return source.play();
      else throw new Error('Parent play commands are disabled');
    }).then(()=>{if(!destroyed&&session===currentSession){sample();send('ack',{sequence:data.sequence,ok:true});}},()=>{if(!destroyed&&session===currentSession)send('ack',{sequence:data.sequence,ok:false});});
  }
  owned.listen(host,'message',message);
  function requestClose() {if(!destroyed&&!suspended&&session)send('dismiss',{sequence:++sequence});}
  if(options.notifyEscape===true)owned.listen(host.document,'keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented&&!host.document.fullscreenElement)requestClose();});
  for(const event of EVENTS)if(event!=='snapshot')owned.listen(source,event,()=>sample(event));
  owned.listen(host.document,'visibilitychange',()=>{if(host.document.hidden){stop();if(session){sample('waiting');stop();}}else sample();});
  owned.listen(host,'pagehide',()=>{suspended=true;disconnect('pagehide');});
  owned.listen(host,'pageshow',()=>{if(!destroyed){suspended=false;send('available');}});
  send('available');
  return {requestClose,teardown(){if(destroyed)return;disconnect('teardown');destroyed=true;owned.dispose();},snapshot(){return {kind:'child-publisher',connected:!!session,destroyed,suspended,...owned.snapshot()};}};
}

/** Receive one explicitly selected iframe's state as a media-compatible player. */
export function createPlaybackReceiver(options = {}) {
  const {host,channel,assetId,origin}=context(options), iframe=options.iframe;
  if(iframe?.tagName!=='IFRAME'||!iframe.contentWindow)throw new TypeError('An attached iframe is required');
  const staleAfter=options.staleAfterMilliseconds ?? 1500;
  if(typeof staleAfter!=='number'||!Number.isFinite(staleAfter)||staleAfter<750||staleAfter>10000)throw new RangeError('staleAfterMilliseconds must be between 750 and 10000');
  const owned=resources(host), player=new host.EventTarget(), pending=new Map();
  let session='',sequence=0,commands=0,lastWall=0,timer=0,connectTimer=0,destroyed=false,connected=false,status='connecting';
  let state={time:0,duration:0,rate:1,paused:true,ended:false,seeking:false,buffering:false,error:false};
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});
  const emit=event=>player.dispatchEvent(new host.Event(event));
  const envelope=(type,extra={})=>({protocol:PROTOCOL,channel,assetId,session,type,...extra});
  function send(type,extra) {iframe.contentWindow?.postMessage(envelope(type,extra),origin);}
  function cancelPending() {for(const request of pending.values()){owned.cancel(request.timer);request.reject(new Error('Child playback disconnected'));}pending.clear();}
  function stop(reason) {
    owned.cancel(timer);owned.cancel(connectTimer);timer=connectTimer=0;
    const playing=!player.paused;
    state={...state,time:player.currentTime,paused:true,buffering:false};connected=false;status=reason;cancelPending();if(playing)emit('pause');
  }
  function connect() {
    if(destroyed)return;stop('connecting');session=host.crypto.randomUUID();sequence=0;
    send('connect');
    const started=host.performance.now();
    const retry=()=>{if(destroyed||connected)return;if(host.performance.now()-started>=10000){stop('unavailable');rejectReady(new Error('Child playback did not become ready'));return;}send('connect');connectTimer=owned.later(retry,500);};
    connectTimer=owned.later(retry,500);
  }
  function command(name,time) {
    if(destroyed||!connected)return Promise.reject(new Error('Child playback is unavailable'));
    if(pending.size>=16)return Promise.reject(new Error('Too many pending child playback commands'));
    const id=++commands;
    return new Promise((resolve,reject)=>{
      const timeout=owned.later(()=>{pending.delete(id);reject(new Error('Child playback command timed out'));},2000);
      pending.set(id,{resolve,reject,timer:timeout});send('command',{sequence:id,command:name,...(name==='seek'?{time}:{} )});
    });
  }
  Object.defineProperties(player,{
    nodeType:{value:1},tagName:{value:'VIDEO'},ownerDocument:{value:host.document},isConnected:{get:()=>!destroyed&&iframe.isConnected},
    currentTime:{get:()=>Math.min(state.duration||MAX_SECONDS,state.time+(!player.paused&&!state.seeking?Math.min(500,Math.max(0,host.performance.now()-lastWall))/1000*state.rate:0)),set:value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>state.duration)throw new RangeError('Seek must be inside the child duration');command('seek',value).catch(()=>{});}},
    duration:{get:()=>state.duration},paused:{get:()=>state.paused||state.buffering||state.error||!connected},ended:{get:()=>state.ended},seeking:{get:()=>state.seeking},playbackRate:{get:()=>state.rate},error:{get:()=>state.error?new Error('Child media error'):null}
  });
  player.play=()=>command('play');player.pause=()=>{command('pause').catch(()=>{});};
  function message(event) {
    const data=event.data;
    if(destroyed||event.source!==iframe.contentWindow||event.origin!==origin||!packet(data,channel,assetId))return;
    if(data.type==='available'){if(!host.document.hidden){if(connected)send('connect');else connect();}return;}
    if(data.session!==session)return;
    if(data.type==='dismiss'&&Number.isSafeInteger(data.sequence)&&data.sequence>sequence){sequence=data.sequence;emit('dismiss');return;}
    if(data.type==='disconnect'){stop('disconnected');session='';return;}
    if(data.type==='ack'&&Number.isSafeInteger(data.sequence)&&typeof data.ok==='boolean') {
      const request=pending.get(data.sequence);if(request){owned.cancel(request.timer);pending.delete(data.sequence);data.ok?request.resolve():request.reject(new Error('Child playback rejected the command'));}return;
    }
    if(data.type!=='state'||!Number.isSafeInteger(data.sequence)||data.sequence<=sequence||!EVENTS.has(data.event)||!validState(data.state))return;
    const previous=state,wasConnected=connected,wasPaused=player.paused;
    sequence=data.sequence;state={...data.state};lastWall=host.performance.now();connected=true;status='connected';owned.cancel(connectTimer);connectTimer=0;owned.cancel(timer);timer=0;
    if(!wasConnected){emit('loadedmetadata');resolveReady(controller);}
    else if(previous.duration!==state.duration)emit('durationchange');
    if(previous.rate!==state.rate)emit('ratechange');
    if(state.seeking&&!previous.seeking)emit('seeking');
    if(!state.seeking&&previous.seeking)emit('seeked');
    // Reconstruct a discontinuity even if a browser coalesced seeking events.
    if(!state.seeking&&!previous.seeking&&wasConnected&&Math.abs(state.time-previous.time-(wasPaused?0:(lastWall-previousWall)/1000*previous.rate))>.4){emit('seeking');emit('seeked');}
    previousWall=lastWall;
    if(wasPaused&&!player.paused){emit('play');emit('playing');}
    if(!wasPaused&&player.paused)emit('pause');
    if(state.ended&&!previous.ended)emit('ended');
    if(data.event==='waiting')emit('waiting');
    if(state.error&&!previous.error)emit('error');
    emit('timeupdate');
    if(!player.paused)timer=owned.later(()=>{send('disconnect');stop('stale');session='';emit('waiting');},staleAfter);
  }
  let previousWall=0;
  owned.listen(host,'message',message);
  owned.listen(iframe,'load',connect);
  owned.listen(host,'pagehide',()=>{send('disconnect');stop('suspended');session='';});
  owned.listen(host,'pageshow',connect);
  owned.listen(host.document,'visibilitychange',()=>{if(host.document.hidden){send('command',{sequence:++commands,command:'pause'});stop('hidden');session='';}else connect();});
  const observer=new host.MutationObserver(()=>{if(!iframe.isConnected)controller.teardown();});observer.observe(host.document.documentElement,{childList:true,subtree:true});
  const controller={player,ready,reconnect:connect,teardown(){if(destroyed)return;send('command',{sequence:++commands,command:'pause'});send('disconnect');stop('destroyed');destroyed=true;session='';rejectReady(new Error('Child playback owner removed'));observer.disconnect();owned.dispose();},snapshot(){return {kind:'child-receiver',status,connected,destroyed,time:player.currentTime,paused:player.paused,assetId,...owned.snapshot()};}};
  connect();return controller;
}

/** Scoped integration with the shared native/YouTube player ownership API. */
export function installChildPlayback(scope, api, host) {
  function own(controller) {const teardown=controller.teardown.bind(controller);const remove=scope.onDispose(()=>teardown());controller.teardown=()=>{remove();teardown();};return controller;}
  api.publishPlayback=options=>{if(api.destroyed)throw new Error('DanceMoves owner is destroyed');return own(createPlaybackPublisher({...options,window:host}));};
  api.receiveChildPlayback=options=>{
    if(api.destroyed)throw new Error('DanceMoves owner is destroyed');
    if(typeof api.registerPlaybackProvider!=='function')throw new Error('The shared playback provider API is required');
    if(options?.masterVerified!==true)throw new TypeError('An explicitly verified master association is required');
    const receiver=createPlaybackReceiver({...options,window:host});
    let registration;
    try {registration=api.registerPlaybackProvider({...options,player:receiver.player});}catch(error){receiver.teardown();throw error;}
    return own({source:registration.source,player:receiver.player,ready:receiver.ready,mapping:registration.mapping,reconnect:receiver.reconnect,teardown(){receiver.teardown();registration.teardown();},snapshot(){return {...receiver.snapshot(),mapping:registration.mapping};}});
  };
}
