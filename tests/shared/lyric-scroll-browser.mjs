import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';

const port = 8778;
const url = `http://127.0.0.1:${port}/examples/lyric-scroll/index.html`;
const evidence = '.build/browser-evidence/lyric-scroll';
await fs.mkdir(evidence, {recursive: true});
const server = spawn(process.execPath, ['examples/playback-sources/serve.mjs'], {
  env: {...process.env, PORT: String(port)}, stdio: ['ignore', 'pipe', 'inherit']
});
let browser;
try {
  const [message] = await Promise.race([
    once(server.stdout, 'data'),
    once(server, 'exit').then(([code]) => {throw new Error('Fixture server exited with ' + code);})
  ]);
  assert.match(String(message), /Playback fixture:/);
  browser = await chromium.launch({
    headless: true,
    ...(process.env.DANCEMOVES_BROWSER_EXECUTABLE ? {executablePath: process.env.DANCEMOVES_BROWSER_EXECUTABLE}
      : process.env.DANCEMOVES_BROWSER_CHANNEL ? {channel: process.env.DANCEMOVES_BROWSER_CHANNEL} : {})
  });
  const capture = process.env.DANCEMOVES_RECORD_VIDEO !== '0';
  const context = await browser.newContext({
    viewport: {width: 800, height: 540},
    ...(capture ? {recordVideo: {dir: evidence, size: {width: 800, height: 540}}} : {})
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const frame = page.locator('.dance-moves-lyric-scroll__frame');
  const track = frame.locator('.dance-moves-lyric-scroll__track');
  const audio = page.locator('[data-dance-moves-master]');
  const gap = frame.locator('.dance-moves-lyric-scroll__gap');
  const gapMessage = gap.locator('.dance-moves-lyric-scroll__gap-message');
  const upcoming = gap.locator('.dance-moves-lyric-scroll__gap-next');
  async function line(index) {
    await page.waitForFunction(expected =>
      document.querySelector('.dance-moves-lyric-scroll__frame')?.dataset.danceMovesLyricIndex === String(expected), index);
  }
  async function seek(time, index) {
    await audio.evaluate((element, time) => {
      const done = new Promise(resolve => element.addEventListener('seeked', resolve, {once: true}));
      element.currentTime = time;
      return done;
    }, time);
    await line(index);
  }
  async function layout() {
    return frame.evaluate(element => {
      const {top, bottom, height} = element.getBoundingClientRect();
      const rows = [...element.firstElementChild.children];
      const current = element.querySelector('[data-dance-moves-lyric-current]');
      const box = current.getBoundingClientRect();
      return {
        visible: rows.filter(row => {
          const {top: start, bottom: end} = row.getBoundingClientRect();
          return Math.min(bottom, end) - Math.max(top, start) > 1;
        }).map(row => row.textContent),
        centreError: Math.abs(box.top + box.height / 2 - top - height / 2),
        height,
        animations: element.getAnimations({subtree: true}).length
      };
    });
  }
  async function play() {
    await audio.evaluate(element => {element.muted = true; return element.play();});
  }
  await page.goto(url);
  await line(-1);
  await gap.waitFor({state:'visible'});
  assert.equal(await gapMessage.textContent(), '', 'a pause shorter than two beats shows only the upcoming lyric');
  assert.equal(await upcoming.textContent(), 'The room goes quiet');
  const gapCentres = await gap.evaluate(element => {
    const {top, height} = element.getBoundingClientRect();
    return [...element.children].map(row => {
      const box = row.getBoundingClientRect();
      return (box.top + box.height / 2 - top) / height;
    });
  });
  assert.ok(Math.abs(gapCentres[0] - .5) < .01 && Math.abs(gapCentres[1] - 5/6) < .01, gapCentres);
  assert.equal(await frame.getAttribute('aria-hidden'), 'true');
  assert.equal(await track.locator(':scope > div').count(), 7, 'five persistent sung rows plus two boundary spacers');
  assert.equal(await page.locator('.dance-moves-lyric-popover').count(), 0);

  await play();
  await line(0);
  assert.equal(await gap.isVisible(), false);
  assert.deepEqual((await layout()).visible, ['', 'The room goes quiet', 'A signal flickers']);
  await page.waitForFunction(() => {
    const track = document.querySelector('.dance-moves-lyric-scroll__track');
    const animation = track.getAnimations()[0];
    if (!animation || animation.currentTime < 40 || animation.currentTime > 210) return false;
    const y = new DOMMatrix(getComputedStyle(track).transform).m42;
    const step = track.firstElementChild.getBoundingClientRect().height;
    return y < -1 && y > -step + 1;
  });
  await line(2);
  await page.waitForFunction(() => !document.querySelector('.dance-moves-lyric-scroll__track').getAnimations().length);
  const desktop = await layout();
  const middle = 'One small light crosses the room and settles on the windowsill';
  assert.deepEqual(desktop.visible, ['A signal flickers', middle, 'Keep the window open']);
  assert.ok(desktop.centreError < 1);
  await page.screenshot({path: evidence + '/desktop.png'});
  await audio.evaluate(element => element.pause());
  await line(2);

  await page.setViewportSize({width: 360, height: 650});
  await page.waitForFunction(previous => document.querySelector('.dance-moves-lyric-scroll__frame').clientHeight > previous, desktop.height);
  const mobile = await layout();
  assert.deepEqual(mobile.visible, desktop.visible);
  assert.ok(mobile.centreError < 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
  await page.screenshot({path: evidence + '/mobile.png'});

  await seek(8.7, 5);
  assert.deepEqual((await layout()).visible, ['Keep the window open', 'The last light stays', '']);
  assert.equal((await layout()).animations, 0);
  await seek(7.4, -1);
  assert.equal(await track.evaluate(node => getComputedStyle(node).visibility), 'hidden');
  assert.equal(await gapMessage.textContent(), '(3 beats)');
  assert.equal(await upcoming.textContent(), 'The last light stays');
  await play();
  await page.waitForFunction(() => document.querySelector('.dance-moves-lyric-scroll__gap-message').textContent === '(2 beats)');
  await audio.evaluate(element => element.pause());
  const pausedMessage = await gapMessage.textContent();
  await page.waitForTimeout(300);
  assert.equal(await gapMessage.textContent(),pausedMessage);
  await seek(8.19, -1);
  assert.equal(await gapMessage.textContent(), '(1 beat)');
  assert.equal(await upcoming.textContent(), 'The last light stays');
  await seek(10.3, -1);
  assert.equal(await gap.isVisible(), false);
  await seek(1, 0);
  const otherIndex = await page.evaluate(async () => {
    const other = document.createElement('audio');
    other.src = document.querySelector('audio').src;
    other.muted = true;
    document.querySelector('main').append(other);
    await new Promise(resolve => other.addEventListener('loadedmetadata', resolve, {once: true}));
    window.runtime.discoverAudio();
    const cursorMoved = new Promise(resolve => other.addEventListener('seeked', resolve, {once: true}));
    other.currentTime = 6;
    await cursorMoved;
    const index = document.querySelector('.dance-moves-lyric-scroll__frame').dataset.danceMovesLyricIndex;
    other.remove();
    return index;
  });
  assert.equal(otherIndex, '0', 'an unrelated same-length player cannot move the lyric frame');

  for (const preference of [{reducedMotion: 'reduce'}, {reducedMotion: 'no-preference', forcedColors: 'active'}]) {
    await page.emulateMedia(preference);
    await seek(2, 0);
    await play();
    await line(1);
    assert.equal((await layout()).animations, 0);
    assert.ok((await layout()).centreError < 1);
    await audio.evaluate(element => element.pause());
  }
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'no-preference'});
  await seek(2, 0);
  await play();
  await line(1);
  const destroyed = await track.evaluate(element => {
    const [animation] = element.getAnimations();
    window.runtime.destroy();
    return {hadAnimation: Boolean(animation), cancelled: animation?.playState === 'idle', ...window.runtime.resources()};
  });
  assert.ok(destroyed.hadAnimation && destroyed.cancelled);
  for (const key of ['frames', 'timers', 'observers', 'listeners', 'created']) assert.equal(destroyed[key], 0, key);
  assert.equal(await frame.count(), 0);

  const video = page.video();
  await context.close();
  if (video) {
    const source = await video.path();
    await fs.rename(source, evidence + '/demonstration.webm');
  }

  const wordpress = await browser.newPage();
  wordpress.on('pageerror', error => errors.push(String(error)));
  await wordpress.goto(url + '?wordpress');
  await wordpress.waitForFunction(() => window.__danceMovesMount && document.querySelector('.dance-moves-lyric-scroll__frame'));
  await wordpress.locator('audio').evaluate(async element => {
    if (!element.duration) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, {once: true}));
    element.currentTime = 6;
  });
  await wordpress.waitForFunction(() => document.querySelector('.dance-moves-lyric-scroll__frame').dataset.danceMovesLyricIndex === '3');
  await wordpress.locator('audio').evaluate(async element => {
    element.currentTime = 10.85;
    element.muted = true;
    await element.play();
  });
  await wordpress.waitForFunction(() => document.querySelector('audio').ended &&
    document.querySelector('.dance-moves-lyric-scroll__frame').dataset.danceMovesLyricIndex === '-1');
  for (const [mode,expected] of [['previous','Keep the window open'],['message','Listen for the next line'],['none',''],['legacy',null]]) {
    const variant=await browser.newPage();
    variant.on('pageerror',error=>errors.push(String(error)));
    await variant.goto(url+'?gap='+mode);
    await variant.waitForFunction(()=>window.runtime && document.querySelector('.dance-moves-lyric-scroll__frame') &&
      Number.isFinite(document.querySelector('audio').duration));
    await variant.locator('audio').evaluate(async el=>{
      const seeked = new Promise(resolve=>el.addEventListener('seeked',resolve,{once:true}));
      el.currentTime=7.4;
      await seeked;
    });
    const slot=variant.locator('.dance-moves-lyric-scroll__gap');
    if(expected===null) assert.equal(await slot.count(),0);
    else {
      assert.ok(await slot.isVisible());
      assert.equal(await slot.locator('.dance-moves-lyric-scroll__gap-message').textContent(),expected);
      assert.equal(await slot.locator('.dance-moves-lyric-scroll__gap-next').textContent(),'The last light stays');
    }
    await variant.close();
  }
  const boundary = await browser.newPage();
  boundary.on('pageerror', error => errors.push(String(error)));
  // At 120 BPM, this intro is exactly two beats. Two consecutive blank
  // cues during a later pause must not restart its countdown eligibility.
  await boundary.route('**/examples/lyric-scroll/lyrics.lrc', async route => {
    const source = await route.fetch();
    const text = (await source.text()).replace('[00:00.70]', '[00:01.00]')
      .replace('[00:08.50]', '[00:08.05]\n[00:08.50]');
    await route.fulfill({response:source,body:text});
  });
  await boundary.goto(url);
  const edgeGap = boundary.locator('.dance-moves-lyric-scroll__gap');
  await edgeGap.waitFor({state:'visible'});
  const edgeMessage = edgeGap.locator('.dance-moves-lyric-scroll__gap-message');
  const edgeUpcoming = edgeGap.locator('.dance-moves-lyric-scroll__gap-next');
  assert.equal(await edgeMessage.textContent(), '');
  assert.equal(await edgeUpcoming.textContent(), 'The room goes quiet');
  await boundary.locator('audio').evaluate(async el => {
    const seeked = new Promise(resolve => el.addEventListener('seeked', resolve, {once:true}));
    el.currentTime = 8.20;
    await seeked;
  });
  assert.equal(await edgeMessage.textContent(), '(1 beat)');
  assert.equal(await edgeUpcoming.textContent(), 'The last light stays');
  await boundary.close();

  assert.deepEqual(errors, []);
  console.log('Lyric scroll passed: all gap modes, native beat countdown, in-flight motion, clipping, wrapping, seek, source ownership, preferences, teardown and WordPress bundle.');
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) {
    const closed = once(server, 'exit');
    server.kill();
    await closed;
  }
}
