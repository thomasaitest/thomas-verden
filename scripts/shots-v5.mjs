// Screenshots of v5 features. Usage: node scripts/shots-v5.mjs [url] [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4750/';
const out = process.argv[3] ?? '/workspace/heddas-mockups/v5';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function start(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 45000 });
  await page.waitForTimeout(800);
  if (!opts.avatar) {
    await page.getByRole('button', { name: 'Ferdig ✓' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Klekk egget! 🐣' }).click();
    await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(400);
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
    g.commit({ ...g.save, bucks: 5000, bag: { ...g.save.bag, 'bil-rosa': 1, 'vogn-rosa': 1, 'bil-lilla': 1 } });
    g.player.pos.set(0, 0, 8);
    g.cam.yaw = 0.2; g.cam.pitch = 0.55; g.cam.dist = 28;
    // force evening-ish sky
    g.weatherT0 = performance.now() / 1000 - 180 * 0.72;
  });
  await shot(page, '01-town-evening', 1000);

  // drive car
  await page.evaluate(() => {
    const g = window.__hv;
    g.toggleDrive();
    g.player.pos.set(2, 0, 4);
    g.player.yaw = 0.4;
    g.cam.yaw = 0.8; g.cam.pitch = 0.4; g.cam.dist = 14;
  });
  await shot(page, '02-drive-car', 900);

  await page.evaluate(() => window.__hv.clearVehicle?.() || window.__hv.toggleDrive());

  // pram
  await page.evaluate(() => {
    const g = window.__hv;
    const pet = g.save.pets[0];
    if (pet) g.commit({ ...g.save, equipped: [pet.uid] }, { pets: true });
    g.togglePram();
    g.player.pos.set(-2, 0, 3);
    g.cam.yaw = -0.3; g.cam.pitch = 0.35; g.cam.dist = 11;
  });
  await shot(page, '03-pram-pet', 900);
  await page.evaluate(() => { const g = window.__hv; if (g.pramming) g.togglePram(); });

  // playground trampoline
  await page.evaluate(() => {
    const g = window.__hv;
    const e = g.town.equipment.find((x) => x.id === 'tramp');
    if (e) {
      g.player.pos.set(e.wx, 0, e.wz);
      g.startUse('tramp');
      g.cam.yaw = 0.5; g.cam.pitch = 0.45; g.cam.dist = 14;
    }
  });
  await shot(page, '04-trampoline', 1100);
  await page.evaluate(() => window.__hv.stopUse?.());

  // plaza dance
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(0, 0, 2);
    g.activity = { kind: 'dance', since: g.time, slot: 0 };
    g.cam.yaw = 0.3; g.cam.pitch = 0.55; g.cam.dist = 18;
  });
  await shot(page, '05-plaza-dance', 1000);

  // house visit interior (own furnished)
  await page.evaluate(() => {
    const g = window.__hv;
    g.activity = null;
    g.debugFurnish();
    g.enterHouse();
    g.player.pos.set(0, 0, 2);
    g.cam.yaw = 0.4; g.cam.pitch = 0.55; g.cam.dist = 16;
  });
  await shot(page, '06-house-furnishing', 900);

  await ctx.close();
}

// iPad touch framing
{
  const { page, ctx } = await start({ viewport: { width: 1024, height: 768 } });
  await page.evaluate(() => {
    const g = window.__hv;
    g.commit({ ...g.save, bucks: 2000, bag: { ...g.save.bag, 'bil-gul': 1 } });
    g.player.pos.set(0, 0, 6);
    g.toggleDrive();
    g.cam.yaw = 0.5; g.cam.pitch = 0.4; g.cam.dist = 12;
  });
  await shot(page, '07-ipad-drive', 900);
  await ctx.close();
}

await browser.close();
console.log('done', out);
