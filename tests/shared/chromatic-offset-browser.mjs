import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';

const base = 'https://dancemoves.test/';
const browser = await chromium.launch({
  executablePath: process.env.DANCEMOVES_TEST_CHROMIUM || undefined,
});
const example = await fs.readFile('examples/chromatic-offset.html', 'utf8');

async function pixel(page, screenshot, x, y) {
  return page.evaluate(async ({encoded, x, y}) => {
    const png = await fetch('data:image/png;base64,' + encoded);
    const bitmap = await createImageBitmap(await png.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return Array.from(context.getImageData(x, y, 1, 1).data);
  }, {encoded: screenshot.toString('base64'), x, y});
}

try {
  for (const bundle of ['dancemoves.min.js', 'wordpress.js']) {
    const page = await browser.newPage({viewport: {width: 480, height: 260}});
    try {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(base + '**', route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/examples/chromatic-offset.html') {
          return route.fulfill({contentType: 'text/html', body: example.replace('dancemoves.min.js', bundle)});
        }
        assert.equal(url.pathname, '/lib/' + bundle);
        return route.fulfill({contentType: 'text/javascript', path: path.join('lib', bundle)});
      });
      await page.goto(base + 'examples/chromatic-offset.html');
      await page.waitForFunction(() => window.chromaticDemo?.effect.snapshot().active);
      const snapshot = () => page.evaluate(() => chromaticDemo.effect.snapshot());
      const set = offsets => page.evaluate(value => chromaticDemo.effect.set(value), offsets);
      const pattern = page.locator('.pattern');
      const split = await pattern.screenshot();
      const blue = await pixel(page, split, 76, 48);
      const cyan = await pixel(page, split, 84, 48);
      assert(blue[0] < 32 && blue[1] < 32 && blue[2] > 240, JSON.stringify(blue));
      assert(cyan[0] < 32 && cyan[1] > 240 && cyan[2] > 240, JSON.stringify(cyan));
      const coverage = await pixel(page, split, 18, 48);

      await set({red: [100, 12], green: [12, 12], blue: [12, 12]});
      assert.deepEqual((await snapshot()).offsets, {red: [12, 12], green: [12, 12], blue: [12, 12]});
      const shifted = await pattern.screenshot();
      assert.deepEqual((await pixel(page, shifted, 25, 17)).slice(0, 3), [0, 0, 0]);
      assert.deepEqual(await pixel(page, shifted, 18, 48), coverage);

      await page.emulateMedia({reducedMotion: 'reduce'});
      await page.waitForFunction(() => !chromaticDemo.effect.snapshot().active);
      const neutral = await pattern.screenshot();
      assert.deepEqual((await pixel(page, neutral, 76, 48)).slice(0, 3), [16, 16, 16]);
      assert.deepEqual(await pixel(page, neutral, 18, 48), coverage);
      await set({red: [6, 0]});
      assert.equal((await snapshot()).active, false);
      await page.emulateMedia({reducedMotion: 'no-preference'});
      await set({red: [8, 0], blue: [-8, 0]});
      assert.equal((await snapshot()).active, true);
      await page.emulateMedia({forcedColors: 'active'});
      await page.waitForFunction(() => !chromaticDemo.effect.snapshot().active);
      await page.emulateMedia({forcedColors: 'none'});
      await set({red: [8, 4], blue: [-8, -4]});

      if (bundle === 'dancemoves.min.js') {
        await fs.mkdir('.build/browser-evidence', {recursive: true});
        await page.screenshot({path: '.build/browser-evidence/chromatic-offset.png'});
      }
      await page.evaluate(() => {
        const {runtime, effect} = chromaticDemo;
        runtime.destroy();
        effect.set({red: [10, 0]});
      });
      assert.equal(await page.locator('filter[id^="dance-moves-chromatic-"]').count(), 0);
      assert.equal((await snapshot()).active, false);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({bundle, blue, cyan, lifecycle: 'passed'}));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

