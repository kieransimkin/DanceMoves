/** Read-only, URL-agnostic long-run DOM/CSS growth check for EPK pages. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function assessGrowth(samples) {
  assert.ok(samples.length >= 6, 'At least six settled samples are required');
  const first = samples.slice(0, 3);
  const last = samples.slice(-3);
  const checks = [
    { key: 'domElements', allowance: baseline => Math.max(20, Math.ceil(baseline * .05)) },
    { key: 'generatedCssChars', allowance: baseline => Math.max(1024, Math.ceil(baseline * .10)) },
    { key: 'generatedCssRules', allowance: baseline => Math.max(10, Math.ceil(baseline * .10)) }
  ].map(({ key, allowance }) => {
    const baseline = median(first.map(sample => sample[key]));
    const ending = median(last.map(sample => sample[key]));
    const allowedGrowth = allowance(baseline);
    return { metric: key, baseline, ending, growth: ending - baseline, allowedGrowth, pass: ending - baseline <= allowedGrowth };
  });
  return { pass: checks.every(check => check.pass), checks };
}

export async function samplePage(page) {
  return page.evaluate(() => {
    const generated = [...document.querySelectorAll('style')].filter(style => style.id.startsWith('dance-moves-catalogue-pseudo-timing'));
    return {
      elapsedSeconds: Math.round(performance.now() / 1000),
      domElements: document.getElementsByTagName('*').length,
      generatedCssChars: generated.reduce((sum, style) => sum + style.textContent.length, 0),
      generatedCssRules: generated.reduce((sum, style) => { try { return sum + style.sheet.cssRules.length; } catch { return sum; } }, 0),
      catalogueTimingCopies: generated.reduce((sum, style) => sum + (style.textContent.match(/prefers-reduced-motion/g) || []).length, 0),
      danceMovesVersion: window.DanceMoves?.version || null,
      quality: document.querySelector('[data-dance-moves-quality]')?.getAttribute('data-dance-moves-quality') || null,
      visibility: document.visibilityState
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const urls = args.filter(arg => /^https?:\/\//.test(arg));
  if (!urls.length) throw new Error('Pass one or more explicit EPK URLs; no URL is fetched by default.');
  const seconds = Math.max(30, Number(option('seconds') || 90));
  const intervalSeconds = Math.min(Math.max(2, Number(option('interval') || 10)), seconds / 5);
  const playAudio = args.includes('--play-audio');
  const audioSelector = option('audio-selector') || 'audio[data-dance-moves-master], audio';
  const output = option('output');
  const launch = { headless: true };
  if (option('executable')) launch.executablePath = option('executable');
  if (option('channel')) launch.channel = option('channel');
  const browser = await chromium.launch(launch);
  const reports = [];
  try {
    for (const url of urls) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(5000);
        if (playAudio) {
          const audio = page.locator(audioSelector).first();
          if (!await audio.count()) throw new Error(`No audio element matches ${audioSelector} on ${url}`);
          await audio.evaluate(element => { element.muted = true; return element.play(); });
          await page.waitForFunction(selector => document.querySelector(selector)?.currentTime > .05, audioSelector, { timeout: 10000 });
        }
        const samples = [];
        for (let elapsed = 0; elapsed <= seconds; elapsed += intervalSeconds) {
          samples.push(await samplePage(page));
          if (elapsed + intervalSeconds <= seconds) await page.waitForTimeout(intervalSeconds * 1000);
        }
        const assessment = assessGrowth(samples);
        reports.push({ url, audioMode: playAudio ? `muted playback: ${audioSelector}` : 'idle unless page autoplays', status: assessment.pass && !errors.length ? 'PASS' : 'FAIL', assessment, samples, errors });
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  const report = { generatedAt: new Date().toISOString(), scope: 'Read-only browser test; a pass is not physical-device FPS proof', reports };
  if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (reports.some(item => item.status !== 'PASS')) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
