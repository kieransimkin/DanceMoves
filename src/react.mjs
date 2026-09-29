'use client';
import {createContext,createElement as h,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {createDanceMoves,validatePageConfig} from './index.mjs';
const EMPTY=Object.freeze({});
const Context=createContext(null);
/** Keep options stable with useMemo; changing options recreates the scoped runtime. */
export function useDanceMoves(rootRef,options=EMPTY) {
  const [result,setResult]=useState({runtime:null,error:null});
  useEffect(()=>{
    if (!rootRef.current) return;
    let active=true, runtime;
    try {
      runtime=createDanceMoves({...options,root:rootRef.current});
      setResult({runtime,error:null});
      runtime.ready.catch(error=>{if(active)setResult({runtime,error});});
    } catch(error) {setResult({runtime:null,error});}
    return ()=>{active=false;runtime?.destroy();};
  },[rootRef,options]);
  return result;
}
export function DanceMovesProvider({options=EMPTY,children,className='',...attributes}) {
  const root=useRef(null);
  const result=useDanceMoves(root,options);
  return h('div',{...attributes,ref:root,className:`ks-epk ${className}`.trim()},h(Context.Provider,{value:result},children));
}
export function useDanceMovesContext() {
  const value=useContext(Context);
  if (!value) throw new Error('useDanceMovesContext requires DanceMovesProvider');
  return value;
}
export function useCue(runtime,name,callback) {
  const latest=useRef(callback);latest.current=callback;
  useEffect(()=>runtime?.onCue(name,detail=>latest.current(detail)),[runtime,name]);
}
export function useLyric(runtime) {
  const [lyric,setLyric]=useState(null);
  useEffect(()=>{
    setLyric(null);if(!runtime)return;
    const remove=runtime.onLyric(setLyric);
    const clear=()=>setLyric(null);
    const events=['pause','ended','seeking'];events.forEach(type=>runtime.root.addEventListener(type,clear,true));
    return ()=>{remove();events.forEach(type=>runtime.root.removeEventListener(type,clear,true));};
  },[runtime]);
  return lyric;
}
export function useRudiment(runtime,targetRef,options) {
  const [result,setResult]=useState({controller:null,error:null});
  useEffect(()=>{
    if (!runtime || !targetRef.current) return;
    let active=true,controller;
    try {
      controller=runtime.rudiments.animate({...options,root:runtime.root,target:targetRef.current});
      setResult({controller,error:null});
      controller.ready.catch(error=>{if(active)setResult({controller,error});});
    } catch(error) {setResult({controller:null,error});}
    return ()=>{active=false;controller?.destroy();};
  },[runtime,targetRef,options]);
  return result;
}
export function Rudiment({runtime,options,children,...attributes}) {
  const ref=useRef(null);useRudiment(runtime,ref,options);
  return h('div',{...attributes,ref},children);
}
/** Reusable editor; persistence and authorisation belong to the host application. */
export function PageMetadataEditor({value=EMPTY,onSave}) {
  const [draft,setDraft]=useState(()=>({...value})),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>setDraft({...value}),[value]);
  const input=(key,label,type='text')=>h('label',{key},label,h('input',{type,value:draft[key] ?? '',step:type==='number'?'0.001':undefined,
    onChange:e=>setDraft({...draft,[key]:type==='number'?(e.target.value===''?undefined:Number(e.target.value)):e.target.value})}));
  return h('form',{onSubmit:async event=>{
    event.preventDefault();setBusy(true);setMessage('');
    try {await onSave(validatePageConfig(draft));setMessage('Saved');}catch(error){setMessage(error.message);}finally{setBusy(false);}
  }},
    input('bpm','BPM','number'),input('lyricTimingUrl','Lyric timing URL'),input('cueTimingUrl','Cue timing URL'),
    input('masterDurationMilliseconds','Master duration (milliseconds)','number'),
    h('label',null,h('input',{type:'checkbox',checked:!!draft.lyricPopupsEnabled,onChange:e=>setDraft({...draft,lyricPopupsEnabled:e.target.checked})}),'Timed lyric pop-ups'),
    h('label',null,'Ambient effect',h('select',{value:draft.effect || '',onChange:e=>setDraft({...draft,effect:e.target.value})},
      h('option',{value:''},'None'),h('option',{value:'paper-planes'},'Paper planes'))),
    h('button',{type:'submit',disabled:busy},busy?'Saving…':'Save metadata'),h('output',{'aria-live':'polite'},message));
}
