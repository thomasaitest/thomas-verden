// Remaining next2 shots: shop signs (fixed cams), potion, MP, better benches
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/workspace/thomas-verden-shots/next2';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function boot(label, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(label, 'PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) { await ferdig.click(); await page.waitForTimeout(200); }
  const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click();
    await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => { window.__hv.weatherT0 = performance.now() / 1000 - 100; });
  return { page, ctx };
}

const shot = async (page, name, wait = 500) => {
  await page.waitForTimeout(wait);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  console.log('saved', path);
};

{
  const { page, ctx } = await boot('solo2');

  // Shop signs: aim camera at building centre from street side (front rot)
  const places = await page.evaluate(() => {
    const g = window.__hv;
    const e = g.town.entrances;
    return Object.fromEntries(Object.keys(e).map((k) => [k, e[k]]));
  });
  console.log('entrances', places);

  for (const [key, name] of [
    ['shop', 'butikk'],
    ['vet', 'dyrlegen'],
    ['eggs', 'eggbutikk'],
    ['cars', 'bilbutikk'],
    ['pets', 'dyrebutikk'],
    ['doors', 'dorspillet'],
  ]) {
    await page.evaluate(({ key }) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      const door = g.town.entrances[key];
      // Stand just outside the door, look at facade; lift pitch so roof sign is in frame
      const out = 9;
      g.player.pos.set(door.x + Math.sin(door.yaw) * out, 0, door.z + Math.cos(door.yaw) * out);
      g.player.yaw = door.yaw + Math.PI;
      g.cam.yaw = door.yaw; // camera south of player looking north to facade
      g.cam.pitch = 0.55;
      g.cam.dist = 14;
    }, { key });
    await shot(page, `02-sign-${name}-street`, 700);
    await page.evaluate(({ key }) => {
      const g = window.__hv;
      const door = g.town.entrances[key];
      g.player.pos.set(door.x + Math.sin(door.yaw) * 6, 0, door.z + Math.cos(door.yaw) * 6);
      g.cam.yaw = door.yaw + 0.35;
      g.cam.pitch = 1.05;
      g.cam.dist = 22;
    }, { key });
    await shot(page, `02-sign-${name}-above`, 700);
  }

  // Better bench side views: close, low, camera on the RIGHT of facing so backrest is behind avatar left of frame
  const benches = await page.evaluate(() => window.__hv.town.benches.map((b, i) => ({ i, ...b })));
  const byYaw = {};
  for (const b of benches) {
    const bucket = (Math.round((b.yaw / Math.PI) * 2) / 2).toFixed(2); // quarters of pi
    if (!byYaw[bucket]) byYaw[bucket] = b;
  }
  let n = 0;
  for (const b of Object.values(byYaw).slice(0, 6)) {
    n++;
    await page.evaluate((b) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      g.resting = { x: b.x, z: b.z, yaw: b.yaw };
      g.player.pos.set(b.x, 0.02, b.z);
      g.player.yaw = b.yaw;
      // True side: offset camera along right vector of sit facing
      const side = b.yaw + Math.PI / 2;
      g.cam.yaw = side;
      g.cam.pitch = 0.05;
      g.cam.dist = 4.2;
    }, b);
    await shot(page, `04-bench-side-${n}-yaw${b.yaw.toFixed(2)}`, 900);
  }

  // Potion shop panel
  await page.evaluate(() => {
    document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
    window.__hv.panels.openShop();
  });
  await shot(page, '01-shop-no-potion-buy', 800);
  await page.evaluate(() => document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove()));

  // Potion drop: grant via economy then show bag
  const drop = await page.evaluate(() => {
    const g = window.__hv;
    // simulate drop
    g.commit({ ...g.save, bag: { ...g.save.bag, flygedrikk: (g.save.bag.flygedrikk ?? 0) + 1 } });
    g.panels.openBag?.() || g.panels.openBackpack?.();
    return g.save.bag.flygedrikk;
  });
  console.log('bag flygedrikk', drop);
  // open bag via dock
  await page.evaluate(() => document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove()));
  await page.locator('.dock-btn').filter({ hasText: 'Sekk' }).click();
  await page.waitForTimeout(500);
  await shot(page, '01-potion-in-bag-after-drop', 600);
  await page.evaluate(() => document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove()));

  // Flying with pet for drop context
  await page.evaluate(() => {
    const g = window.__hv;
    const pet = g.save.pets[0];
    if (pet) {
      g.commit({
        ...g.save,
        pets: g.save.pets.map((p) => (p.uid === pet.uid ? { ...p, flyable: true } : p)),
        equipped: [pet.uid],
      }, { pets: true });
    }
    g.flying = true;
    g.riding = g.actors?.find?.((a) => a.kind === 'pet') || g.riding;
    g.player.pos.set(0, 10, 0);
    g.cam.yaw = 0.8;
    g.cam.pitch = 0.35;
    g.cam.dist = 14;
  });
  await shot(page, '01-flying-pet-drop-context', 700);

  await ctx.close();
}

// MP
{
  const A = await boot('MP-A', { viewport: { width: 1100, height: 800 } });
  const B = await boot('MP-B', { viewport: { width: 1100, height: 800 } });
  async function openMp(page) {
    await page.locator('.dock-btn.mp').click();
    await page.waitForTimeout(400);
  }
  await A.page.evaluate(() => {
    const g = window.__hv;
    const h0 = g.save.houses[0];
    const h = { ...h0, style: 'villa' };
    g.commit({ ...g.save, bucks: 9000, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id }, { house: true });
  });
  await openMp(A.page);
  await A.page.locator('input.field').first().fill('Ada');
  await A.page.getByRole('button', { name: 'Lag rom' }).click();
  await A.page.waitForTimeout(2500);
  const code = await A.page.evaluate(() => window.__hv.mp?.session?.code ?? '');
  console.log('room', code);
  if (code) {
    await B.page.evaluate(() => {
      const g = window.__hv;
      const h0 = g.save.houses[0];
      const h = { ...h0, style: 'slott' };
      g.commit({ ...g.save, bucks: 9000, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id }, { house: true });
    });
    await openMp(B.page);
    const inputs = B.page.locator('input.field');
    await inputs.nth(0).fill('Bo');
    await inputs.nth(1).fill(code);
    await B.page.getByRole('button', { name: 'Bli med' }).click();
    await B.page.waitForTimeout(4000);
    const syncA = await A.page.evaluate(() => [...window.__hv.mp.session.remotes.values()].map((r) => ({ name: r.name, plot: r.plot, style: r.house?.style || r.houseStyle })));
    const syncB = await B.page.evaluate(() => [...window.__hv.mp.session.remotes.values()].map((r) => ({ name: r.name, plot: r.plot, style: r.house?.style || r.houseStyle })));
    const localA = await A.page.evaluate(() => window.__hv.save.houses.find((h) => h.id === window.__hv.save.activeHouseId)?.style);
    const localB = await B.page.evaluate(() => window.__hv.save.houses.find((h) => h.id === window.__hv.save.activeHouseId)?.style);
    console.log({ syncA, syncB, localA, localB });
    fs.writeFileSync(`${out}/03-mp-sync.json`, JSON.stringify({ syncA, syncB, localA, localB, code }, null, 2));

    await A.page.evaluate(() => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      const remotes = [...g.mp.session.remotes.values()];
      const joiner = remotes[0];
      const p0 = g.town.housePlots[0];
      const pJ = g.town.housePlots[joiner?.plot ?? 1];
      g.player.pos.set((p0.x + pJ.x) / 2 + 28, 0, (p0.z + pJ.z) / 2 + 32);
      g.cam.yaw = Math.atan2((p0.x + pJ.x) / 2 - g.player.pos.x, (p0.z + pJ.z) / 2 - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.9;
      g.cam.dist = 60;
    });
    await shot(A.page, '03-mp-host-sees-both-houses', 1100);

    await B.page.evaluate(() => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      const remotes = [...g.mp.session.remotes.values()];
      const host = remotes[0];
      const p0 = g.town.housePlots[0];
      const pH = g.town.housePlots[host?.plot ?? 1];
      g.player.pos.set((p0.x + pH.x) / 2 + 28, 0, (p0.z + pH.z) / 2 + 32);
      g.cam.yaw = Math.atan2((p0.x + pH.x) / 2 - g.player.pos.x, (p0.z + pH.z) / 2 - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.9;
      g.cam.dist = 60;
    });
    await shot(B.page, '03-mp-joiner-sees-both-houses', 1100);

    await A.page.evaluate(() => {
      const g = window.__hv;
      const plot = g.town.housePlots[[...g.mp.session.remotes.values()][0]?.plot ?? 1];
      g.player.pos.set(plot.x + 12, 0, plot.z + 18);
      g.cam.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.4;
      g.cam.dist = 20;
    });
    await shot(A.page, '03-mp-host-view-joiner-slott', 900);

    await B.page.evaluate(() => {
      const g = window.__hv;
      const plot = g.town.housePlots[[...g.mp.session.remotes.values()][0]?.plot ?? 1];
      g.player.pos.set(plot.x + 12, 0, plot.z + 18);
      g.cam.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.4;
      g.cam.dist = 20;
    });
    await shot(B.page, '03-mp-joiner-view-host-villa', 900);
  }
  await A.ctx.close();
  await B.ctx.close();
}

await browser.close();
console.log('done');
