import {createDanceMoves, VISUALISER_CATALOGUE} from '/lib/index.mjs';
const root = document.querySelector('#demo'), audio = root.querySelector('#audio'), grid = root.querySelector('#grid');
const family = root.querySelector('#family'), renderer = root.querySelector('#renderer'), pattern = root.querySelector('#pattern');
const notice = root.querySelector('#notice');
const runtime = createDanceMoves({root,bpm:120});
await runtime.ready;
const views = new Map();let serial = 0;
for (const row of runtime.rudiments.catalogue()) {
  const option = new Option(row.name.replaceAll('_',' '),row.name);pattern.add(option);
}
pattern.value = 'helix';
function choices() {
  renderer.replaceChildren();
  for (const view of VISUALISER_CATALOGUE) if (family.value === 'all' || family.value === view.family) renderer.add(new Option(view.label,view.name));
}
family.addEventListener('change',choices);choices();
renderer.value = 'path';
function clear() {for (const {handle,figure} of views.values()) {handle.destroy();figure.remove();}views.clear();notice.textContent='';}
async function add(name, {offscreen = true, limit = true} = {}) {
  if (limit && views.size >= 12) {notice.textContent='Remove a view before adding another (12 views per gallery).';return null;}
  const view = runtime.visualisers.describe(name), rudiment = runtime.rudiments.describe(pattern.value);
  if (!view.requiresSpectrum && rudiment.dimensions < view.minDimensions) {
    notice.textContent=`${view.label} needs ${view.minDimensions} axes. Choose a pattern such as circle or helix.`;return null;
  }
  const figure = document.createElement('figure'), heading = document.createElement('div'), caption = document.createElement('figcaption');
  const target = document.createElement('canvas'), status = document.createElement('p'), source = document.createElement('p'), remove = document.createElement('button');
  figure.setAttribute('data-dance-moves-visualiser-figure','');heading.className='view-heading';caption.textContent=view.label;
  target.width=480;target.height=220;target.setAttribute('aria-label',view.description);
  status.setAttribute('data-dance-moves-visualiser-status','');status.textContent='View ready to load.';
  source.className='source-label';source.textContent=view.requiresSpectrum?'Saved synthetic Fourier bands':`Native ${pattern.value.replaceAll('_',' ')} · ${rudiment.dimensions} axes`;
  remove.type='button';remove.textContent='Remove';remove.className='remove';remove.setAttribute('aria-label',`Remove ${view.label}`);
  heading.append(caption,remove);figure.append(heading,source,target,status);grid.append(figure);
  const id=`gallery:${++serial}`;
  const handle = runtime.visualisers.animate({id,target,audio,renderer:name,offscreen,
    ...(view.requiresSpectrum?{recordingUrl:'/fixture.json'}:{rudiment:pattern.value}),historyPips:192});
  views.set(id,{handle,figure});
  remove.addEventListener('click',()=>{handle.destroy();figure.remove();views.delete(id);});
  try {await handle.ready;notice.textContent='';return handle;}
  catch (error) {notice.textContent=String(error.message||error);return handle;}
}
const presets = {
  motion:['particles','path','waveform','phase-portrait'],
  history:['spectrum-waterfall','spectrogram-mel','spectrum-peak-trails','spectrogram-isometric-terrain'],
  circular:['spectrum-annular-led','spectrogram-annular-heatmap','waveform-annular-ribbon','phase-annular-portrait'],
  effects:['spectrum-cityscape','spectrogram-quilt','waveform-dna-helix','waveform-phosphor'],
  spatial:['spatial-torus','spatial-sphere','spatial-terrain']
};
root.querySelector('#add').addEventListener('click',()=>add(renderer.value));
root.querySelector('#clear').addEventListener('click',clear);
for (const button of root.querySelectorAll('[data-preset]')) button.addEventListener('click',async()=>{
  clear();for (const name of presets[button.dataset.preset]) await add(name);
});
pattern.addEventListener('change',()=>{notice.textContent='The selected pattern will be used for new movement views.';});
for (const name of presets.motion) await add(name);
// Small documented hook for this example's browser regression, not a global
// production runtime or a package-import side effect.
window.rudimentGallery = {runtime,audio,views,add,clear,catalogue:VISUALISER_CATALOGUE,ready:true};
window.addEventListener('pagehide',event=>{if (!event.persisted) runtime.destroy();});
