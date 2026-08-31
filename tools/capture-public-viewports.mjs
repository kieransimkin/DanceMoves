#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const edge = process.env.DANCE_MOVES_EDGE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const targetUrl = process.argv[2];
const outputDirectory = process.argv[3];
const presets = [
  { name: "desktop-1440", width: 1440, height: 1200 },
  { name: "tablet-900", width: 900, height: 1100 },
  { name: "mobile-390", width: 390, height: 844 },
];

if (!targetUrl || !outputDirectory) {
  console.error("Usage: node tools/capture-public-viewports.mjs <url> <output-directory>");
  process.exit(2);
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForFile(file, timeoutMilliseconds = 15000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    try { return await fs.readFile(file, "utf8"); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      await delay(50);
    }
  }
  throw new Error(`Timed out waiting for ${file}`);
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }
      if (!message.method) return;
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMilliseconds = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.set(method, (this.listeners.get(method) || []).filter(item => item !== handler));
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMilliseconds);
      const handler = params => {
        clearTimeout(timer);
        this.listeners.set(method, (this.listeners.get(method) || []).filter(item => item !== handler));
        resolve(params);
      };
      this.listeners.set(method, [...(this.listeners.get(method) || []), handler]);
    });
  }

  close() { this.socket.close(); }
}

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "dance-moves-cdp-"));
  await fs.mkdir(outputDirectory, { recursive: true });
  const child = spawn(edge, [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--hide-scrollbars",
    "--inprivate",
    "--no-first-run",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  let client;
  try {
    const activePort = (await waitForFile(path.join(profile, "DevToolsActivePort"))).trim().split(/\r?\n/);
    const port = Number(activePort[0]);
    const created = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!created.ok) throw new Error(`CDP target creation failed: HTTP ${created.status}`);
    const target = await created.json();
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    const results = [];
    for (const preset of presets) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: preset.width,
        height: preset.height,
        deviceScaleFactor: 1,
        mobile: false,
        screenWidth: preset.width,
        screenHeight: preset.height,
      });
      const loaded = client.once("Page.loadEventFired", 30000);
      await client.send("Page.navigate", { url: targetUrl });
      await loaded;
      await delay(3500);
      const evaluated = await client.send("Runtime.evaluate", {
        expression: `JSON.stringify({
          title: document.title,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body ? document.body.scrollWidth : 0,
          positiveHorizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0) - window.innerWidth,
          hasAdminBar: Boolean(document.querySelector("#wpadminbar")),
          replacementCharacters: (document.documentElement.textContent.match(/\\uFFFD/g) || []).length,
          danceMovesCore: Array.from(document.scripts, node => node.src).find(value => value.includes("dance-moves-core.js")) || null,
          clayStars: Array.from(document.scripts, node => node.src).find(value => value.includes("clay-stars-effects.js")) || null,
          legacyClayAssets: Array.from(document.querySelectorAll("script[src],link[href]"), node => node.src || node.href).filter(value => value.includes("kieran-made-from-clay-stars-epk-effects")),
          rootCount: document.querySelectorAll(".ks-epk.ks-clay-stars-v2").length,
          coverCount: document.querySelectorAll(".epk-cover-wrap").length,
          playerCount: document.querySelectorAll("audio").length,
          chapterCount: document.querySelectorAll("[data-ks-clay-stars-chapter]").length
        })`,
        returnByValue: true,
      });
      const metrics = JSON.parse(evaluated.result.value);
      const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      const image = Buffer.from(screenshot.data, "base64");
      const screenshotName = `${preset.name}.png`;
      await fs.writeFile(path.join(outputDirectory, screenshotName), image);
      results.push({
        ...preset,
        ...metrics,
        screenshot: screenshotName,
        screenshotSha256: crypto.createHash("sha256").update(image).digest("hex").toUpperCase(),
      });
    }

    const evidence = {
      schema: "dance-moves-public-viewport-evidence/v1",
      capturedAt: new Date().toISOString(),
      url: targetUrl,
      browser: "Microsoft Edge headless via DevTools Protocol",
      signedOut: results.every(item => !item.hasAdminBar),
      results,
    };
    await fs.writeFile(path.join(outputDirectory, "viewport-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    try { client?.close(); } catch {}
    try { child.kill(); } catch {}
    await delay(250);
    if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith("dance-moves-cdp-")) {
      await fs.rm(profile, { recursive: true, force: true });
    }
  }
}

main().catch(error => {
  console.error(error.stack || String(error));
  process.exit(1);
});
