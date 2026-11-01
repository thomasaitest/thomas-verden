// Screenshots of v4 features. Usage: node scripts/shots-v4.mjs [url] [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/workspace/heddas-mockups/v4';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function start(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 45000 });
  await page.waitForTimeout(1000);
  if (!opts.avatar) {
    await page.getByRole('button', { name: 'Ferdig ✓' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Klekk egget! 🐣' }).click();
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: 'Hurra! 🎉' }).click();
    await page.waitForTimeout(500);
  }
  return { page, ctx };
}
const shot = async (page, name, wait = 800) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};

{
  const { page, ctx } = await start();
  await page.evaluate(() => {
    const g = window.__hv;
    g.commit({ ...g.save, bucks: 5000 });
    g.player.pos.set(g.town.spawn.x, 0, g.town.spawn.z);
    g.cam.yaw = 0.4; g.cam.pitch = 0.55; g.cam.dist = 28;
  });
  await shot(page, '01-town-overview', 1200);

  // house roof exterior
  await page.evaluate(() => {
    const g = window.__hv;
    const e = g.town.entrances.home;
    g.player.pos.set(e.x, 0, e.z);
    g.cam.yaw = e.yaw + Math.PI; g.cam.pitch = 0.55; g.cam.dist = 22;
  });
  await shot(page, '02-house-roof', 900);

  // more houses / switch
  await page.evaluate(() => window.__hv.panels.openMap());
  await page.waitForTimeout(400);
  await shot(page, '03-houses-buy-switch', 500);
  await page.evaluate(() => document.querySelectorAll('.sheet-wrap').forEach((e) => e.remove()));
  await page.evaluate(() => { window.__hv.paused = false; });

  // interior roof (upstairs ceiling)
  await page.evaluate(() => {
    const g = window.__hv;
    g.enterHouse();
    g.player.pos.set(0, 6.6, 2);
    g.cam.yaw = 0.3; g.cam.pitch = 0.85; g.cam.dist = 16;
  });
  await shot(page, '04-house-interior-ceiling', 900);
  await page.evaluate(() => window.__hv.exitHouse());

  // benches with legs + sit
  await page.evaluate(() => {
    const g = window.__hv;
    const b = g.town.benches[0];
    g.player.pos.set(b.x + Math.sin(b.yaw) * 2.5, 0, b.z + Math.cos(b.yaw) * 2.5);
    g.player.yaw = b.yaw + Math.PI;
    g.cam.yaw = b.yaw + 0.4; g.cam.pitch = 0.4; g.cam.dist = 10;
  });
  await shot(page, '05-bench-legs', 700);
  await page.evaluate(() => {
    const g = window.__hv;
    const b = g.town.benches[0];
    g.resting = { x: b.x, z: b.z, yaw: b.yaw };
    g.player.pos.set(b.x, 0.85, b.z);
    g.player.yaw = b.yaw;
    g.cam.yaw = b.yaw + 1.2; g.cam.pitch = 0.35; g.cam.dist = 9;
  });
  await shot(page, '06-bench-sit-rest', 700);
  await page.evaluate(() => { window.__hv.resting = null; window.__hv.player.pos.y = 0; });

  // map with playground road
  await page.evaluate(() => window.__hv.panels.openMap());
  await shot(page, '07-map-playground-road', 500);
  await page.evaluate(() => document.querySelectorAll('.sheet-wrap').forEach((e) => e.remove()));
  await page.evaluate(() => { window.__hv.paused = false; });

  // car shop
  await page.evaluate(() => {
    const g = window.__hv;
    const z = g.town.zones.find((q) => q.kind === 'cars');
    const yaw = g.town.entrances.cars.yaw;
    g.player.pos.set(z.x - Math.sin(yaw) * 2, 0, z.z - Math.cos(yaw) * 2);
    g.player.yaw = yaw + Math.PI;
    g.cam.yaw = yaw + 0.4; g.cam.pitch = 0.55; g.cam.dist = 12;
  });
  await shot(page, '08-car-shop', 1200);

  // pet shop
  await page.evaluate(() => {
    const g = window.__hv;
    const z = g.town.zones.find((q) => q.kind === 'pets');
    const yaw = g.town.entrances.pets.yaw;
    g.player.pos.set(z.x - Math.sin(yaw) * 2, 0, z.z - Math.cos(yaw) * 2);
    g.player.yaw = yaw + Math.PI;
    g.cam.yaw = yaw + 0.4; g.cam.pitch = 0.55; g.cam.dist = 12;
  });
  await shot(page, '09-pet-shop', 1200);

  // jump onto fountain
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(5.5, 0, 0);
    g.player.yaw = -Math.PI / 2;
    g.cam.yaw = 1.2; g.cam.pitch = 0.45; g.cam.dist = 14;
    // simulate jump landing on rim
    g.player.pos.set(3.2, 1.15, 0);
    g.player.grounded = true;
  });
  await shot(page, '10-jump-fountain', 900);

  // fluffy / purple trees
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(-20, 0, 30);
    g.cam.yaw = 0.8; g.cam.pitch = 0.4; g.cam.dist = 20;
  });
  await shot(page, '11-fluffy-trees', 1000);

  // avatar outfits
  await page.evaluate(() => window.__hv.panels.openAvatar());
  await page.waitForTimeout(400);
  const tabs = await page.$$('.tabs .tab');
  if (tabs[0]) await tabs[0].click();
  await shot(page, '12-avatar-outfits', 700);
  await page.evaluate(() => document.querySelectorAll('.sheet-wrap').forEach((e) => e.remove()));
  await page.evaluate(() => { window.__hv.editingAvatar = false; window.__hv.paused = false; });

  // neighbourhood plots
  await page.evaluate(() => {
    const g = window.__hv;
    g.town.setPlotHouse(1, 'villa', 'Maja');
    g.town.setPlotHouse(2, 'moderne', 'Leo');
    g.player.pos.set(-20, 0, -20);
    g.cam.yaw = 0.2; g.cam.pitch = 0.5; g.cam.dist = 40;
  });
  await shot(page, '13-neighbourhood-plots', 1200);

  // combined overview
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(0, 0, 8);
    g.cam.yaw = 0.15; g.cam.pitch = 0.85; g.cam.dist = 55;
  });
  await shot(page, '00-overview', 1400);

  await ctx.close();
}

await browser.close();
console.log('done');
