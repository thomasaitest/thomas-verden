import { chromium } from 'playwright-core';
import fs from 'node:fs';

const base = process.env.PROFILE_URL || 'http://127.0.0.1:4740/';
const outDir = process.env.PROFILE_OUT || '/tmp/perf-before';
const dsf = Number(process.env.PROFILE_DSF || '1');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--window-size=1280,720',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dsf });
const logs = [];
page.on('console', (msg) => {
  const t = msg.type();
  if (t === 'error' || t === 'warning') logs.push({ t, text: msg.text().slice(0, 400) });
});
page.on('pageerror', (err) => logs.push({ t: 'pageerror', text: String(err).slice(0, 500) }));

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('loading', base);
await page.waitForFunction(() => window.__hv && window.__hv.assetsReady, null, { timeout: 90000 });
console.log('booted');
await page.evaluate(async () => {
  const g = window.__hv;
  await g.assetsReady;
  g.editingAvatar = false;
  g.paused = false;
  g.save.avatarDone = true;
  g.save.starterClaimed = true;
  document.querySelectorAll('.sheet, .overlay, .hatch').forEach((e) => e.remove());
  if (!window.__perfHook) {
    window.__perfHook = true;
    const times = [];
    const stats = [];
    let last = performance.now();
    const loop = (now) => {
      times.push(now - last);
      last = now;
      const info = g.renderer.info.render;
      stats.push({ calls: info.calls, triangles: info.triangles });
      if (times.length > 400) {
        times.shift();
        stats.shift();
      }
      window.__perf = { times, stats };
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
});
await page.waitForTimeout(1500);

async function census(label) {
  return page.evaluate((label) => {
    const g = window.__hv;
    const perf = window.__perf || { times: [], stats: [] };
    const times = perf.times.slice();
    const stats = perf.stats.slice();
    perf.times.length = 0;
    perf.stats.length = 0;
    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.length ? times.reduce((s, n) => s + n, 0) / times.length : 0;
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
    const calls = stats.length ? stats.reduce((s, n) => s + n.calls, 0) / stats.length : 0;
    const triangles = stats.length ? stats.reduce((s, n) => s + n.triangles, 0) / stats.length : 0;
    const shown = (o) => {
      let p = o;
      while (p) {
        if (p.visible === false) return false;
        p = p.parent;
      }
      return true;
    };
    let pointLights = 0;
    let pointLightsOn = 0;
    let transmission = 0;
    let meshes = 0;
    let skinned = 0;
    let shownMeshes = 0;
    let shownSkinned = 0;
    let shownTris = 0;
    g.scene.traverse((o) => {
      if (o.isPointLight) {
        pointLights++;
        if (o.visible && shown(o)) pointLightsOn++;
      }
      if (o.isMesh) {
        meshes++;
        if (o.isSkinnedMesh) skinned++;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some((m) => m && m.transmission > 0)) transmission++;
        if (shown(o)) {
          shownMeshes++;
          if (o.isSkinnedMesh) shownSkinned++;
          const geo = o.geometry;
          if (geo) {
            const n = geo.index ? geo.index.count / 3 : (geo.attributes.position?.count || 0) / 3;
            shownTris += n;
          }
        }
      }
    });
    const gl = g.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const mem = performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null;
    return {
      label,
      frames: times.length,
      avgMs: +avg.toFixed(2),
      p95Ms: +p95.toFixed(2),
      drawCalls: +calls.toFixed(1),
      triangles: Math.round(triangles),
      pointLights,
      pointLightsOn,
      transmissionMeshes: transmission,
      meshes,
      skinned,
      shownMeshes,
      shownSkinned,
      shownTris: Math.round(shownTris),
      townVisible: !!g.town?.group?.visible,
      interiorVisible: !!g.interior?.group?.visible,
      geometries: g.renderer.info.memory.geometries,
      textures: g.renderer.info.memory.textures,
      dpr: g.renderer.getPixelRatio(),
      hq: g.highQuality,
      tier: g.budgetTier,
      mode: g.mode,
      pos: { x: +g.player.pos.x.toFixed(1), y: +g.player.pos.y.toFixed(1), z: +g.player.pos.z.toFixed(1) },
      gpu: String(gpu),
      canvas: { w: g.renderer.domElement.width, h: g.renderer.domElement.height },
      mem,
    };
  }, label);
}

async function shot(name) {
  try {
    await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 15000, animations: 'disabled' });
  } catch (err) {
    console.error('shot failed', name, String(err).split('\n')[0]);
  }
}

const report = { url: base, dsf, when: new Date().toISOString(), samples: [] };
const note = async (label, wait = 1000) => {
  await page.evaluate(() => {
    if (window.__perf) {
      window.__perf.times.length = 0;
      window.__perf.stats.length = 0;
    }
  });
  await page.waitForTimeout(wait);
  const row = await census(label);
  report.samples.push(row);
  console.log('SAMPLE', JSON.stringify(row));
  if (process.env.PROFILE_SHOTS !== '0') await shot(label);
};

await note('spawn-adaptive', 2200);
await page.evaluate(() => {
  const g = window.__hv;
  g.observeFrame = () => {};
  g.pushBudget(1);
});
await note('spawn-idle', 800);

// plaza
await page.evaluate(() => {
  const g = window.__hv;
  g.player.pos.set(0, 0, 8);
  g.player.yaw = Math.PI;
  g.cam.yaw = Math.PI;
  g.cam.pitch = 0.22;
  g.cam.dist = 9;
  g.camShown = 9;
});
await note('plaza-idle', 2500);

// orbit / move at plaza
await page.keyboard.down('KeyW');
await page.keyboard.down('KeyQ');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyW');
await page.keyboard.up('KeyQ');
await note('plaza-move', 200);

// street with traffic
await page.evaluate(() => {
  const g = window.__hv;
  g.player.pos.set(0, 0, 36);
  g.player.yaw = 0;
  g.cam.yaw = 0.2;
  g.cam.pitch = 0.28;
  g.cam.dist = 11;
  g.camShown = 11;
});
await note('street-idle', 2500);

// indoors
await page.evaluate(() => window.__hv.enterHouse());
await note('house-idle', 2000);

await page.evaluate(() => window.__hv.exitHouse());
await note('after-exit', 600);

// HQ toggle at plaza
await page.evaluate(() => {
  const g = window.__hv;
  g.player.pos.set(0, 0, 8);
  if (!g.highQuality) g.toggleQuality();
});
await note('plaza-hq', 1200);

const grouped = {};
for (const row of logs) grouped[row.text.slice(0, 140)] = (grouped[row.text.slice(0, 140)] || 0) + 1;
report.logs = Object.entries(grouped).map(([text, n]) => ({ n, text }));
report.logCount = logs.length;
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
