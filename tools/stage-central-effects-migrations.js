"use strict";

const fs = require("fs");
const path = require("path");

function stage(sourcePath, outputPath, transform) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const candidate = transform(source);
  if (candidate === source) throw new Error(`No migration applied to ${sourcePath}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, candidate, "utf8");
  return { sourcePath, outputPath, sourceLength: source.length, candidateLength: candidate.length };
}

const arcSource = "Z:/My Songs/Releases/Arcadians/epk-update-2026-09-23/arcadians.release-day-transition.wordpress.html";
const arcOutput = "Z:/My Songs/Releases/Arcadians/epk-update-2026-09-28/arcadians.central-effects.wordpress.html";
const claySource = "Z:/My Songs/Releases/Made from the clay and the stars/wordpress-public-player-2026-08-31/candidate-wordpress-transport-script-fix.html";
const clayOutput = "Z:/My Songs/Releases/Made from the clay and the stars/wordpress-central-effects-2026-09-28/clay-stars.central-effects.wordpress.html";
const pluginAssets = "https://kieransimkin.co.uk/wp-content/plugins/kieran-epk-device-orientation/assets/";

function writeRuntimePreview(candidatePath, previewPath, options) {
  let candidate = fs.readFileSync(candidatePath, "utf8");
  // Reproduce the plugin's server-side Clay content filter. A raw editor payload
  // is not the rendered WordPress document and omits these plugin-owned layers.
  if (options.clay) {
    candidate = candidate
      .replace(/(<section class="ks-epk[^>]*>)/, '$1\n  <span class="ks-cloud-field" aria-hidden="true"></span>')
      .replace('<div class="epk-cover-wrap">', '<div class="epk-cover-wrap"><span class="ks-warm-bloom" aria-hidden="true"></span><span class="ks-lens-flare" aria-hidden="true"></span><span class="ks-specular-sweep" aria-hidden="true"></span>');
  }
  const head = [
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    '<script>window.__centralEffectsErrors=[];addEventListener("error",function(event){window.__centralEffectsErrors.push(String(event.message||event.error||"script error"));});addEventListener("unhandledrejection",function(event){window.__centralEffectsErrors.push(String(event.reason||"unhandled rejection"));});</script>',
    options.clay ? `<link rel="stylesheet" href="${pluginAssets}clay-stars-effects.css?ver=2.8.0">` : "",
    "</head><body>"
  ].join("");
  const runtime = [
    `<script>window.danceMovesConfig=${JSON.stringify({ bpm: options.bpm, bpmSource: "explicit", ticksPerBeat: 16, pageId: options.pageId, effect: "none" })};</script>`,
    `<script src="${pluginAssets}dance-moves-core.js?ver=2.8.0"></script>`,
    `<script src="${pluginAssets}dance-moves-effects.js?ver=2.8.0"></script>`,
    options.clay ? `<script src="${pluginAssets}clay-stars-effects.js?ver=2.8.0"></script>` : "",
    `<script>(function(){var root=document.querySelector('.ks-epk'),checks={runtimePreview:true,noJavaScriptErrors:window.__centralEffectsErrors.length===0,effectsApi:!!window.DanceMovesEffects};if(${options.clay ? "true" : "false"}){checks.pageInitialised=root&&root.dataset.clayCentralEffects==='1';checks.pluginRuntime=root&&root.dataset.danceMovesClayRuntime==='ready';checks.cloudField=!!document.querySelector('.ks-cloud-field');checks.coverLayers=['.ks-warm-bloom','.ks-lens-flare','.ks-specular-sweep'].every(function(selector){return !!document.querySelector(selector);});checks.backgroundAnimation=getComputedStyle(document.querySelector('.ks-cloud-field'),'::before').animationName!=='none';}else{var audio=document.querySelector('#arcadians-audio');checks.pageInitialised=root&&root.dataset.arcCentralEffects==='1';checks.instances=window.DanceMovesEffects&&window.DanceMovesEffects.snapshot().length===3;if(audio){audio.currentTime=110;audio.dispatchEvent(new Event('timeupdate'));}checks.sectionAdvanced=root&&root.dataset.arcSection==='drop-1';checks.activeCue=!!document.querySelector('.arc-cues li[data-cue="drop-1"][aria-current="true"]');if(audio){audio.currentTime=0;audio.dispatchEvent(new Event('timeupdate'));}checks.initialStateRestored=root&&root.dataset.arcSection==='intro'&&!!document.querySelector('.arc-cues li[data-cue="intro"][aria-current="true"]');}var passed=Object.keys(checks).every(function(key){return key==='errors'||checks[key]===true;});window.__centralEffectsQa={passed:passed,checks:checks,errors:window.__centralEffectsErrors.slice()};document.documentElement.dataset.runtimePreview='ready';document.documentElement.dataset.centralEffectsQa=passed?'passed':'failed';})();</script>`,
    "</body></html>"
  ].join("");
  fs.writeFileSync(previewPath, head + candidate + runtime, "utf8");
}

const arcScript = `<script id="arcadians-visual-system-v1-js">(() => {"use strict";
const root = document.querySelector('.ks-epk[data-release="arcadians"].arcadians-reimagined');
if (!root || root.dataset.arcInit === "1") return;
root.dataset.arcInit = "1";
const audio = root.querySelector("#arcadians-audio");
const progress = root.querySelector(".arc-progress");
const sectionOut = root.querySelector("#arc-current-section");
const lyricOut = root.querySelector("#arc-current-lyric");
const cueItems = [...root.querySelectorAll(".arc-cues li")];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const sections = [{ id: "intro", t: 0, e: "ancient", l: "No crown, no concrete" },{ id: "verse-1", t: 57.46, e: "ancient", l: "Pan in the pines, river in the light" },{ id: "pre-chorus", t: 70.82, e: "ancient", l: "Hear the pipes through the valley below" },{ id: "build-1", t: 85, e: "future", l: "Pan on the pipe" },{ id: "drop-1", t: 104.01, e: "future", l: "AR-CA-DI-A!" },{ id: "post-drop", t: 133.94, e: "future", l: "Arcadia..." },{ id: "verse-2", t: 154.44, e: "ancient", l: "Callisto's stars on the mountainside" },{ id: "build-2", t: 167.75, e: "future", l: "Hear the pipes through the valley below" },{ id: "final-drop", t: 187.54, e: "future", l: "AR-CA-DI-A!" },{ id: "outro", t: 222.1, e: "future", l: "From the old highlands" }];
const labels = { intro: "Intro", "verse-1": "Verse 1", "pre-chorus": "Pre-Chorus", "build-1": "Build 1", "drop-1": "Drop 1", "post-drop": "Post-Drop", "verse-2": "Verse 2", "build-2": "Build 2", "final-drop": "Final Drop", outro: "Outro" };
let scrollFrame = 0, current = "";
const setPointer = (x = 0, y = 0) => { root.style.setProperty("--arc-x", x.toFixed(3)); root.style.setProperty("--arc-y", y.toFixed(3)); };
const updateScroll = () => { scrollFrame = 0; const max = Math.max(1, root.scrollHeight - innerHeight); const value = Math.max(0, Math.min(1, -root.getBoundingClientRect().top / max)); root.style.setProperty("--arc-progress", value.toFixed(4)); progress?.setAttribute("aria-valuenow", String(Math.round(value * 100))); };
addEventListener("scroll", () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }, { passive: true });
addEventListener("resize", updateScroll, { passive: true });
const setSection = (time) => { let section = sections[0]; for (const item of sections) { if (time >= item.t) section = item; else break; } if (section.id === current) return; current = section.id; root.dataset.arcSection = section.id; root.dataset.arcEra = section.e; sectionOut.textContent = labels[section.id]; lyricOut.textContent = section.l; cueItems.forEach(item => item.setAttribute("aria-current", item.dataset.cue === section.id ? "true" : "false")); };
const initialiseEffects = () => {
  const effects = window.DanceMovesEffects;
  if (!effects || root.dataset.arcCentralEffects === "1") return;
  root.dataset.arcCentralEffects = "1";
  const pointer = effects.pointer({ id: "arcadians:pointer", root, target: root, bounds: root, render: ({ x, y }) => setPointer(x, y) });
  if (audio) effects.playbackPulse({ id: "arcadians:pulse", root, audio, ticks: 64, className: "is-playing", propertyPrefix: "--arc-pulse", render: ({ audio: player }) => setSection(player.currentTime || 0) });
  effects.quality({ id: "arcadians:quality", root, tiers: ["full", "reduced", "minimal"], sampleMilliseconds: 1500, render: state => { root.dataset.arcQuality = state.tier; root.dataset.arcQualityReason = state.reason; if (state.sample) { root.dataset.arcFps = state.sample.fps.toFixed(1); root.dataset.arcTargetFps = root.dataset.danceMovesReferenceFps || ""; } if (state.tier === "minimal") pointer.reset("quality-minimal"); } });
};
if (window.DanceMovesEffects) initialiseEffects(); else document.addEventListener("dance-moves-effects-ready", initialiseEffects, { once: true });
updateScroll(); setSection(0);
if (!reduced.matches) requestAnimationFrame(() => { root.classList.add("arc-intro-active"); setTimeout(() => root.classList.remove("arc-intro-active"), 2100); });
window.ArcadiansEPK = Object.freeze({ version: "1.1.0", getState: () => ({ section: current, quality: root.dataset.arcQuality, reason: root.dataset.arcQualityReason, fps: root.dataset.arcFps || null, targetFps: root.dataset.arcTargetFps || null, bpm: Number(root.dataset.danceMovesBpm || root.dataset.arcBpm || 145), centralEffects: root.dataset.arcCentralEffects === "1" }) });
})();</script>`;

const clayScript = `<script id="ks-clay-stars-v2-script">
/* ks-clay-stars-v2-motion: visual mapping only; pointer lifecycle is centralised in DanceMovesEffects */
(function () {
  "use strict";
  var root = document.querySelector(".ks-epk.ks-clay-stars-v2");
  if (!root) return;
  var cover = root.querySelector(".epk-cover-wrap");
  if (!cover) return;
  var reset = function () {
    cover.style.setProperty("--ks-rx", "0deg");
    cover.style.setProperty("--ks-ry", "0deg");
    cover.style.setProperty("--ks-tx", "0px");
    cover.style.setProperty("--ks-ty", "0px");
  };
  var render = function (point) {
    var nx = point.x;
    var ny = point.y;
    cover.style.setProperty("--ks-rx", (-ny * 1.15).toFixed(2) + "deg");
    cover.style.setProperty("--ks-ry", (nx * 1.15).toFixed(2) + "deg");
    cover.style.setProperty("--ks-tx", (nx * 4).toFixed(2) + "px");
    cover.style.setProperty("--ks-ty", (ny * 4).toFixed(2) + "px");
  };
  var initialiseEffects = function () {
    if (!window.DanceMovesEffects || root.dataset.clayCentralEffects === "1") return;
    root.dataset.clayCentralEffects = "1";
    window.DanceMovesEffects.pointer({ id: "clay-stars:cover-pointer", root: root, target: cover, bounds: cover, render: render });
  };
  reset();
  if (window.DanceMovesEffects) initialiseEffects();
  else document.addEventListener("dance-moves-effects-ready", initialiseEffects, { once: true });
}());
</script>`;

const results = [];
results.push(stage(arcSource, arcOutput, source => {
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  if (!scripts.length) throw new Error("Arcadians script not found");
  const match = scripts[scripts.length - 1];
  return source.slice(0, match.index) + arcScript + source.slice(match.index + match[0].length);
}));
results.push(stage(claySource, clayOutput, source => {
  const pattern = /<script id="ks-clay-stars-v2-script">[\s\S]*?<\/script>/;
  if (!pattern.test(source)) throw new Error("Clay motion script not found");
  return source.replace(pattern, clayScript);
}));

writeRuntimePreview(arcOutput, path.join(path.dirname(arcOutput), "arcadians.central-effects.preview.html"), { pageId: 260, bpm: 145, clay: false });
writeRuntimePreview(clayOutput, path.join(path.dirname(clayOutput), "clay-stars.central-effects.preview.html"), { pageId: 252, bpm: 90, clay: true });

console.log(JSON.stringify(results, null, 2));
