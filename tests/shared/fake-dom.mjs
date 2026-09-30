// A deliberately limited lifecycle test double, not browser-rendering evidence.
export class Style {
 constructor(){this.values=new Map();this.priorities=new Map();}
 setProperty(key,value,priority=''){this.values.set(key,String(value));this.priorities.set(key,priority);}
 getPropertyValue(key){return this.values.get(key)||'';}
 getPropertyPriority(key){return this.priorities.get(key)||'';}
 removeProperty(key){const value=this.getPropertyValue(key);this.values.delete(key);this.priorities.delete(key);return value;}
 [Symbol.iterator](){return this.values.keys();}
}
export class Element extends EventTarget {
 constructor(doc,tag='div'){super();this.ownerDocument=doc;this.nodeType=1;this.tagName=tag.toUpperCase();this.style=new Style();this.attributes=new Map();this.children=[];this.parentNode=null;this.isConnected=true;this.hidden=false;
  const tokens=()=>new Set((this.getAttribute('class')||'').split(/\s+/).filter(Boolean));
  this.classList={contains:k=>tokens().has(k),add:(...ks)=>{const s=tokens();ks.forEach(k=>s.add(k));this.setAttribute('class',[...s].join(' '));},remove:(...ks)=>{const s=tokens();ks.forEach(k=>s.delete(k));this.setAttribute('class',[...s].join(' '));},toggle:(k,force)=>{const s=tokens();const yes=force===undefined?!s.has(k):force;yes?s.add(k):s.delete(k);this.setAttribute('class',[...s].join(' '));return yes;},[Symbol.iterator]:()=>tokens().values()};
  this.dataset=new Proxy({}, {get:(_,k)=>this.getAttribute('data-'+String(k).replace(/[A-Z]/g,l=>'-'+l.toLowerCase()))??undefined,set:(_,k,v)=>{this.setAttribute('data-'+String(k).replace(/[A-Z]/g,l=>'-'+l.toLowerCase()),String(v));return true;},deleteProperty:(_,k)=>{this.removeAttribute('data-'+String(k).replace(/[A-Z]/g,l=>'-'+l.toLowerCase()));return true;}});
  if(tag==='style')this.sheet={cssRules:[],insertRule(text,index){this.cssRules.splice(index,0,{selectorText:text.split('{')[0],style:new Style()});return index;},deleteRule(index){this.cssRules.splice(index,1);}};
 }
 get id(){return this.getAttribute('id')||'';}set id(value){this.setAttribute('id',value);}
 get className(){return this.getAttribute('class')||'';}set className(value){this.setAttribute('class',value);}
 getAttribute(k){return this.attributes.get(k)??null;}setAttribute(k,v){this.attributes.set(k,String(v));}removeAttribute(k){this.attributes.delete(k);}hasAttribute(k){return this.attributes.has(k);}
 appendChild(node){if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(child=>child!==node);this.children.push(node);node.parentNode=this;return node;}append(...nodes){nodes.forEach(n=>this.appendChild(n));}
 removeChild(node){if(node.parentNode!==this)throw new Error('NotFoundError');this.children=this.children.filter(child=>child!==node);node.parentNode=null;return node;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;this.isConnected=false;}
 contains(node){return node===this||this.children.some(c=>c.contains(node));}
 matches(selector){return selector.split(',').some(s=>{s=s.trim();return s==='*'||s.toUpperCase()===this.tagName||s==='#'+this.id||s==='[id]'&&!!this.id||s.startsWith('.')&&s.slice(1).split('.').every(k=>this.classList.contains(k));});}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 getBoundingClientRect(){return {top:0,left:0,right:400,bottom:300,width:400,height:300};}
 getAnimations(){return [];}
}
export function environment(){
 const host=new EventTarget(),doc=new EventTarget();let time=0,next=0;
 const frames=new Map(),timers=new Map(),media=new Map();
 class Observer{constructor(callback){this.callback=callback;this.disconnected=false;}observe(){}disconnect(){this.disconnected=true;}}
 Object.assign(host,{document:doc,CustomEvent,Event,EventTarget,AbortController,AbortSignal,WebAssembly,
  location:new URL('http://localhost:4173/'),navigator:{userAgent:'test',maxTouchPoints:0},screen:{orientation:Object.assign(new EventTarget(),{angle:0})},isSecureContext:true,
  performance:{now:()=>time},console,atob:s=>Buffer.from(s,'base64').toString('binary'),CSS:{supports:()=>true},
  MutationObserver:Observer,ResizeObserver:Observer,IntersectionObserver:Observer,
  requestAnimationFrame(fn){const n=++next;frames.set(n,fn);return n;},cancelAnimationFrame(n){frames.delete(n);},
  setTimeout(fn,ms){const n=++next;timers.set(n,{fn,ms});return n;},clearTimeout(n){timers.delete(n);},
  fetch:async()=>new Response(''),getComputedStyle:element=>element.style,
  matchMedia(query){if(!media.has(query))media.set(query,Object.assign(new EventTarget(),{matches:false}));return media.get(query);}
 });
 Object.assign(doc,{defaultView:host,hidden:false,readyState:'complete',styleSheets:[],createElement(tag){return new Element(doc,tag);},createElementNS(ns,tag){return new Element(doc,tag);}});
 doc.documentElement=new Element(doc,'html');doc.head=new Element(doc,'head');doc.body=new Element(doc,'body');doc.documentElement.append(doc.head,doc.body);
 const root=new Element(doc);doc.body.append(root);
 return {host,doc,root,frames,timers,media,advance(ms=16){time+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));},setTime(ms){time=ms;}};
}
