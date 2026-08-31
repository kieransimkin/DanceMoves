#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "migration", "epk-page-timing-manifest-2026-08-31.json");
const outputPath = path.join(repoRoot, "migration", "epk-motion-timing-audit-2026-08-31.json");
const ledgerPath = path.join(repoRoot, "migration", "epk-motion-timing-conversion-ledger-2026-08-31.tsv");
const manifest = JSON.parse((await fs.readFile(manifestPath, "utf8")).replace(/^\uFEFF/, ""));

const userAgent = "DanceMoves live EPK motion audit/1.0 (+https://kieransimkin.co.uk/)";
const assetCache = new Map();

function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#038;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"');
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? decodeEntities(match[2]) : null;
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": userAgent, accept: "text/html,text/css,application/javascript,*/*;q=0.2" },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { text: await response.text(), finalUrl: response.url, status: response.status };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
  throw lastError;
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function compact(value, max = 260) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function cssContext(text, index) {
  const brace = text.lastIndexOf("{", index);
  if (brace < 0) return "unknown";
  const priorClose = Math.max(text.lastIndexOf("}", brace), text.lastIndexOf(";", brace - 1));
  return compact(text.slice(Math.max(0, priorClose + 1), brace), 180) || "unknown";
}

function durationTokens(value) {
  const tokens = [];
  const re = /(-?(?:\d+\.?\d*|\.\d+))\s*(ms|s)\b/gi;
  let match;
  while ((match = re.exec(value))) {
    const numeric = Number(match[1]);
    tokens.push({
      literal: match[0],
      milliseconds: match[2].toLowerCase() === "s" ? numeric * 1000 : numeric,
    });
  }
  return tokens;
}

function quantizeMilliseconds(milliseconds, bpm) {
  if (!Number.isFinite(milliseconds) || milliseconds === 0) return null;
  const sign = milliseconds < 0 ? -1 : 1;
  const rawTicks = Math.abs(milliseconds) / (3750 / bpm);
  let ticks = Math.max(1, Math.floor(rawTicks + 0.5));
  if (ticks > 16) ticks = Math.max(16, Math.floor(ticks / 16 + 0.5) * 16);
  return {
    raw_ticks: Number(rawTicks.toFixed(4)),
    ticks: ticks * sign,
    quantized_milliseconds: Number(((3750 / bpm) * ticks * sign).toFixed(3)),
    css_property: `var(--dance-moves-${sign < 0 ? "neg-" : ""}${ticks}t)`,
    js_expression: `DanceMoves.durationMilliseconds(${ticks * sign})`,
  };
}

function scanCss(text, source, bpm) {
  const records = [];
  const declaration = /\b(animation(?:-[a-z-]+)?|transition(?:-[a-z-]+)?|scroll-behavior)\s*:\s*([^;}{]+)\s*;?/gi;
  let match;
  while ((match = declaration.exec(text))) {
    const property = match[1].toLowerCase();
    const value = compact(match[2], 260);
    const alreadyDanceMoves = /--dance-moves-|calc\([^)]*--dance-moves/i.test(value);
    const isReducedMotionOverride = /prefers-reduced-motion/i.test(text.slice(Math.max(0, match.index - 1000), match.index)) && /(?:none|0(?:ms|s)?)(?:\s|$)/i.test(value);
    records.push({
      kind: "css",
      source,
      line: lineNumber(text, match.index),
      selector: cssContext(text, match.index),
      property,
      value,
      already_dance_moves: alreadyDanceMoves,
      reduced_motion_override: isReducedMotionOverride,
      durations: durationTokens(value).map((duration) => ({
        ...duration,
        conversion: quantizeMilliseconds(duration.milliseconds, bpm),
      })),
    });
  }
  const timingVariable = /(--[a-z0-9_-]*(?:duration|delay|speed|time)[a-z0-9_-]*)\s*:\s*([^;}{]+)\s*;?/gi;
  while ((match = timingVariable.exec(text))) {
    const value = compact(match[2], 260);
    records.push({
      kind: "css-variable",
      source,
      line: lineNumber(text, match.index),
      selector: cssContext(text, match.index),
      property: match[1],
      value,
      already_dance_moves: /--dance-moves-|calc\([^)]*--dance-moves/i.test(value),
      reduced_motion_override: false,
      durations: durationTokens(value).map((duration) => ({
        ...duration,
        conversion: quantizeMilliseconds(duration.milliseconds, bpm),
      })),
    });
  }
  return records;
}

function jsContext(text, index) {
  return compact(text.slice(Math.max(0, index - 180), Math.min(text.length, index + 420)), 520);
}

function scanJs(text, source, bpm) {
  const records = [];
  const pattern = /\b(setTimeout|setInterval|requestAnimationFrame|cancelAnimationFrame|\.animate\s*\(|setProperty\s*\(\s*["']--[^"']*(?:duration|delay|speed|time)[^"']*["']|animationDuration|transitionDuration|transitionDelay|animationDelay|currentTime|playbackRate|onNextInterval|onEveryInterval|onNextBeat|onEveryBeat|onNextBar|onEveryBar|deferStart|scheduleAtInterval|onCue|addEventListener\s*\(\s*["'](?:animation|transition|pointer|mouse|touch|scroll|deviceorientation|devicemotion|timeupdate|play|pause|ended|seeked))/gi;
  let match;
  while ((match = pattern.exec(text))) {
    const snippet = jsContext(text, match.index);
    const callTail = text.slice(match.index, Math.min(text.length, match.index + 1200));
    const numericDelay = callTail.match(/(?:setTimeout|setInterval)\s*\([\s\S]*?,\s*(\d+(?:\.\d+)?)\s*\)/i);
    records.push({
      kind: "js",
      source,
      line: lineNumber(text, match.index),
      api: match[1],
      snippet,
      already_dance_moves: /DanceMoves|onNextInterval|onEveryInterval|onNextBeat|onEveryBeat|onNextBar|onEveryBar|deferStart|scheduleAtInterval|onCue|durationMilliseconds/.test(snippet),
      timer_literal: numericDelay ? {
        milliseconds: Number(numericDelay[1]),
        conversion: quantizeMilliseconds(Number(numericDelay[1]), bpm),
      } : null,
    });
  }
  return records;
}

function sourceClass(urlOrLabel) {
  if (urlOrLabel.startsWith("inline:")) return "inline";
  if (/\/wp-content\/plugins\/(?:dance-moves|kieran-epk-device-orientation)\//i.test(urlOrLabel)) return "dance-moves-plugin";
  if (/\/wp-content\/plugins\//i.test(urlOrLabel)) return "other-plugin";
  if (/\/wp-content\/themes\//i.test(urlOrLabel)) return "theme";
  return "other-asset";
}

async function getAsset(url) {
  if (!assetCache.has(url)) {
    assetCache.set(url, fetchText(url).catch((error) => ({ error: String(error) })));
  }
  return assetCache.get(url);
}

function extractSources(html, pageUrl) {
  const sources = [];
  let index = 0;
  for (const match of html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)) {
    index += 1;
    const id = attribute(match[0], "id");
    sources.push({ type: "css", label: `inline:style:${id || index}`, text: match[2] });
  }
  index = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attribute(match[0], "src")) continue;
    index += 1;
    const id = attribute(match[0], "id");
    sources.push({ type: "js", label: `inline:script:${id || index}`, text: match[2] });
  }
  index = 0;
  for (const match of html.matchAll(/<([a-z][a-z0-9:-]*)\b[^>]*\bstyle\s*=\s*(["'])(.*?)\2[^>]*>/gi)) {
    index += 1;
    const id = attribute(match[0], "id");
    const classes = (attribute(match[0], "class") || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    const selector = `${match[1]}${id ? `#${id}` : ""}${classes ? `.${classes}` : ""}`;
    sources.push({ type: "css", label: `inline:attribute:style:${index}`, text: `${selector}{${decodeEntities(match[3])}}` });
  }
  const assets = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attribute(match[0], "rel") || "";
    const href = attribute(match[0], "href");
    if (href && /stylesheet/i.test(rel)) assets.push({ type: "css", url: new URL(href, pageUrl).href });
  }
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
    assets.push({ type: "js", url: new URL(decodeEntities(match[2]), pageUrl).href });
  }
  return { inline: sources, assets };
}

const pages = [];
const sharedAssets = new Map();

for (const page of manifest.pages) {
  const fetched = await fetchText(page.url);
  const extracted = extractSources(fetched.text, fetched.finalUrl);
  const pageRecords = [];
  for (const source of extracted.inline) {
    const findings = source.type === "css"
      ? scanCss(source.text, source.label, page.effective_bpm)
      : scanJs(source.text, source.label, page.effective_bpm);
    pageRecords.push(...findings);
  }
  for (const asset of extracted.assets) {
    let shared = sharedAssets.get(asset.url);
    if (!shared) {
      const result = await getAsset(asset.url);
      shared = result.error
        ? { url: asset.url, type: asset.type, source_class: sourceClass(asset.url), error: result.error, findings: [] }
        : {
            url: asset.url,
            type: asset.type,
            source_class: sourceClass(asset.url),
            findings: asset.type === "css"
              ? scanCss(result.text, asset.url, 120)
              : scanJs(result.text, asset.url, 120),
          };
      sharedAssets.set(asset.url, shared);
    }
  }
  pages.push({
    post_id: page.post_id,
    title: page.title,
    url: page.url,
    fetched_url: fetched.finalUrl,
    http_status: fetched.status,
    bpm: page.effective_bpm,
    bpm_source: page.bpm_source,
    inline_findings: pageRecords,
    linked_assets: extracted.assets.map((asset) => asset.url),
  });
  process.stdout.write(`Audited ${page.post_id} ${page.title}\n`);
}

const output = {
  schema: "dance-moves-live-motion-audit/v1",
  generated_at: new Date().toISOString(),
  evidence_basis: "Signed-out rendered HTML and linked CSS/JavaScript assets fetched from each manifest URL.",
  manifest: manifestPath,
  page_count: pages.length,
  tick_definition: "one sixteenth of a beat; 3750 / BPM milliseconds",
  conversion_rule: "Round to nearest integer tick; when over 16 ticks, round to nearest multiple of 16 ticks.",
  pages,
  shared_assets: [...sharedAssets.values()],
};

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
function recommendation(finding) {
  if (finding.reduced_motion_override || /(?:^|\s)(?:none|auto)(?:\s|!|$)|\.00?1ms/i.test(finding.value || "")) {
    return "Keep unchanged; reduced-motion/accessibility override is authoritative.";
  }
  if (finding.already_dance_moves) {
    return "Already uses DanceMoves timing; verify animation scope registration and cue reset behavior.";
  }
  if (finding.kind === "js") {
    if (/setTimeout|setInterval/i.test(finding.api)) {
      return "If visual, replace the delay with DanceMoves.durationMilliseconds(ticks); if it starts a page update, use onNextInterval/onEveryInterval. Keep functional sampling or availability timers time-based.";
    }
    if (/currentTime|timeupdate|play|pause|ended/i.test(`${finding.api} ${finding.snippet}`)) {
      return "Keep the audio state driver; move named song moments to DanceMoves.onCue and align optional starts with onNextBeat/onNextBar.";
    }
    return "Keep the pointer/scroll/sensor/requestAnimationFrame driver event-based; convert only its visual CSS easing or release duration.";
  }
  if (finding.property === "scroll-behavior" || /animation-timeline|animation-range/.test(finding.property || "")) {
    return "Keep as scroll/view-driven behavior; convert only any accompanying fixed visual duration.";
  }
  if (/delay/.test(finding.property || "")) {
    return "Replace the literal/variable with a DanceMoves tick property; use deferStart or onNextInterval when the delay represents musical boundary alignment rather than phase staggering.";
  }
  if (/^animation/.test(finding.property || "")) {
    return "Replace each fixed duration with the listed --dance-moves-Nt property, register the page animation scope, and use a 16- or 64-tick deferred start for beat/bar alignment when audio-driven.";
  }
  if (/^transition/.test(finding.property || "")) {
    return "Replace each fixed duration with the listed --dance-moves-Nt property; when a class/state change must wait for a boundary, trigger it through deferStart/onNextInterval.";
  }
  return "Replace fixed visual time values with the listed DanceMoves tick properties.";
}

function cleanTsv(value) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

const headers = ["post_id", "title", "url", "bpm", "scope", "source", "kind", "selector_or_api", "property", "value", "literal", "milliseconds", "ticks", "quantized_milliseconds", "replacement", "recommendation"];
const rows = [headers];
for (const page of pages) {
  for (const finding of page.inline_findings) {
    const durations = finding.durations?.length ? finding.durations : [null];
    for (const duration of durations) {
      rows.push([
        page.post_id,
        page.title,
        page.url,
        page.bpm,
        "page-inline",
        finding.source,
        finding.kind,
        finding.selector || finding.api || "",
        finding.property || "",
        finding.value || finding.snippet || "",
        duration?.literal || "",
        duration?.milliseconds ?? "",
        duration?.conversion?.ticks ?? "",
        duration?.conversion?.quantized_milliseconds ?? "",
        duration?.conversion?.css_property || "",
        recommendation(finding),
      ]);
    }
  }
}
for (const asset of sharedAssets.values()) {
  for (const finding of asset.findings) {
    const durations = finding.durations?.length ? finding.durations : [null];
    for (const duration of durations) {
      rows.push([
        "ALL",
        "Shared linked asset",
        asset.url,
        "page-dependent",
        asset.source_class,
        finding.source,
        finding.kind,
        finding.selector || finding.api || "",
        finding.property || "",
        finding.value || finding.snippet || "",
        duration?.literal || "",
        duration?.milliseconds ?? "",
        duration?.conversion?.ticks ?? "",
        duration?.conversion?.quantized_milliseconds ?? "",
        duration?.conversion?.css_property || "",
        recommendation(finding),
      ]);
    }
  }
}
await fs.writeFile(ledgerPath, `${rows.map((row) => row.map(cleanTsv).join("\t")).join("\n")}\n`, "utf8");
process.stdout.write(`Wrote ${outputPath}\n`);
process.stdout.write(`Wrote ${ledgerPath}\n`);
