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
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(label, 'PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) { await ferdig.click(); await page.waitForTimeout(200); }
  const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click(); await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => { window.__hv.weatherT0 = performance.now() / 1000 - 100; });
  return { page, ctx };
}
const shot = async (page, name, wait = 500) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};

{
  const { page, ctx } = await boot('fix');

  // Signs from the SIDE of each building so we don't shoot through another shop
  for (const [key, name] of [['shop','butikk'],['vet','dyrlegen'],['eggs','eggbutikk'],['cars','bilbutikk'],['pets','dyrebutikk'],['doors','dorspillet']]) {
    await page.evaluate(({ key }) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
      const door = g.town.entrances[key];
      const side = door.yaw + Math.PI / 2;
      // stand off to the side and a bit out front
      g.player.pos.set(
        door.x + Math.sin(side) * 11 + Math.sin(door.yaw) * 4,
        0,
        door.z + Math.cos(side) * 11 + Math.cos(door.yaw) * 4,
      );
      g.cam.yaw = Math.atan2(door.x - g.player.pos.x, door.z - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.48;
      g.cam.dist = 16;
    }, { key });
    await shot(page, `02-sign-${name}-street`, 650);
    await page.evaluate(({ key }) => {
      const g = window.__hv;
      const door = g.town.entrances[key];
      const side = door.yaw + Math.PI / 2;
      g.player.pos.set(door.x + Math.sin(side) * 8, 0, door.z + Math.cos(side) * 8);
      g.cam.yaw = Math.atan2(door.x - g.player.pos.x, door.z - g.player.pos.z) + Math.PI;
      g.cam.pitch = 1.05;
      g.cam.dist = 20;
    }, { key });
    await shot(page, `02-sign-${name}-above`, 650);
  }

  // Benches side views
  const benches = await page.evaluate(() => window.__hv.town.benches.map((b, i) => ({ i, ...b })));
  const picks = [];
  const used = new Set();
  for (const b of benches) {
    const k = (Math.round(b.yaw * 4) / 4).toFixed(2);
    if (!used.has(k)) { used.add(k); picks.push(b); }
  }
  let n = 0;
  for (const b of picks.slice(0, 6)) {
    n++;
    await page.evaluate((b) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
      g.resting = { x: b.x, z: b.z, yaw: b.yaw };
      g.player.pos.set(b.x, 0.18, b.z);
      g.player.yaw = b.yaw;
      g.cam.yaw = b.yaw + Math.PI / 2;
      g.cam.pitch = 0.08;
      g.cam.dist = 3.8;
    }, b);
    await shot(page, `04-bench-side-${n}-yaw${b.yaw.toFixed(2)}`, 850);
  }

  // Shop with potion hint scrolled into view
  await page.evaluate(() => {
    document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
    window.__hv.panels.openShop();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const body = document.querySelector('.sheet .body, .sheet-body, .sheet .scroll');
    const el = [...document.querySelectorAll('h3')].find((h) => h.textContent?.includes('Trylledrikker'));
    if (el) el.scrollIntoView({ block: 'center' });
    else if (body) body.scrollTop = body.scrollHeight;
  });
  await shot(page, '01-shop-no-potion-buy', 500);
  await page.evaluate(() => document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove()));

  // Bag with potion
  await page.evaluate(() => {
    const g = window.__hv;
    g.commit({ ...g.save, bag: { ...g.save.bag, flygedrikk: 1, ridedrikk: 1 } });
    g.panels.openBag();
  });
  await shot(page, '01-potion-in-bag-after-drop', 600);
  await page.evaluate(() => document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove()));

  // Roof overhang again
  await page.evaluate(() => {
    const g = window.__hv;
    const door = g.town.entrances.home;
    g.player.pos.set(door.x + 10, 0, door.z + 14);
    g.cam.yaw = Math.atan2(door.x - g.player.pos.x, door.z - 8 - g.player.pos.z) + Math.PI;
    g.cam.pitch = 0.55;
    g.cam.dist = 22;
  });
  await shot(page, '07-roof-overhang-street', 700);

  // Floor plans top-downish
  for (const style of ['hytte', 'moderne', 'gard', 'slott']) {
    await page.evaluate((style) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
      const h0 = g.save.houses[0];
      const h = { ...h0, style };
      g.commit({ ...g.save, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id }, { house: true });
      g.enterHouse();
      g.player.pos.set(2, 0, 3);
      g.cam.yaw = Math.PI * 0.85;
      g.cam.pitch = 0.85;
      g.cam.dist = 14;
    }, style);
    await shot(page, `08-floorplan-${style}`, 800);
    await page.evaluate(() => window.__hv.exitHouse());
  }

  // Fountain
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(3, 0, 10);
    g.cam.yaw = 0.15; g.cam.pitch = 0.5; g.cam.dist = 14;
    g.town.update(1.0, 0, 0, 0, 0);
  });
  await shot(page, '05-fountain-jets-on', 400);
  await page.evaluate(() => window.__hv.town.update(3.0, 0, 0, 0, 0));
  await shot(page, '05-fountain-jets-off', 400);

  // Cars lineup from outside
  for (const id of ['bil-rosa','bil-gul','bil-bla','bil-gronn','bil-lilla']) {
    await page.evaluate((id) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
      g.driving = null;
      if (g.vehicleMesh) { g.scene.remove(g.vehicleMesh); g.vehicleMesh = null; }
      g.save.bag[id] = 1;
      g.driving = id;
      g.syncVehicleMesh();
      g.player.pos.set(5, 0, 18);
      g.player.yaw = 0.5;
      g.cam.yaw = 1.2; g.cam.pitch = 0.25; g.cam.dist = 9;
    }, id);
    await shot(page, `06-car-${id}`, 500);
  }

  await ctx.close();
}

// MP
{
  const A = await boot('A', { viewport: { width: 1100, height: 800 } });
  const B = await boot('B', { viewport: { width: 1100, height: 800 } });
  await A.page.evaluate(() => {
    const g = window.__hv;
    const h0 = g.save.houses[0];
    g.commit({ ...g.save, bucks: 9000, houses: g.save.houses.map((x) => (x.id === h0.id ? { ...h0, style: 'villa' } : x)), activeHouseId: h0.id }, { house: true });
  });
  await A.page.locator('.dock-btn.mp').click();
  await A.page.waitForTimeout(300);
  await A.page.locator('input.field').first().fill('Ada');
  await A.page.getByRole('button', { name: 'Lag rom' }).click();
  await A.page.waitForTimeout(2500);
  const code = await A.page.evaluate(() => window.__hv.mp?.session?.code ?? '');
  console.log('room', code);
  if (code) {
    await B.page.evaluate(() => {
      const g = window.__hv;
      const h0 = g.save.houses[0];
      g.commit({ ...g.save, bucks: 9000, houses: g.save.houses.map((x) => (x.id === h0.id ? { ...h0, style: 'slott' } : x)), activeHouseId: h0.id }, { house: true });
    });
    await B.page.locator('.dock-btn.mp').click();
    await B.page.waitForTimeout(300);
    const inputs = B.page.locator('input.field');
    await inputs.nth(0).fill('Bo');
    await inputs.nth(1).fill(code);
    await B.page.getByRole('button', { name: 'Bli med' }).click();
    await B.page.waitForTimeout(4000);
    const sync = {
      A: await A.page.evaluate(() => ({
        local: window.__hv.save.houses.find((h) => h.id === window.__hv.save.activeHouseId)?.style,
        remotes: [...window.__hv.mp.session.remotes.values()].map((r) => ({ name: r.name, plot: r.plot, style: r.house?.style || r.houseStyle })),
      })),
      B: await B.page.evaluate(() => ({
        local: window.__hv.save.houses.find((h) => h.id === window.__hv.save.activeHouseId)?.style,
        remotes: [...window.__hv.mp.session.remotes.values()].map((r) => ({ name: r.name, plot: r.plot, style: r.house?.style || r.houseStyle })),
      })),
    };
    console.log(JSON.stringify(sync));
    fs.writeFileSync(`${out}/03-mp-sync.json`, JSON.stringify(sync, null, 2));
    for (const [page, tag, remoteIdx] of [[A.page,'host',0],[B.page,'joiner',0]]) {
      await page.evaluate(() => document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove()));
      await page.evaluate(() => {
        const g = window.__hv;
        const remotes = [...g.mp.session.remotes.values()];
        const other = remotes[0];
        const p0 = g.town.housePlots[0];
        const pR = g.town.housePlots[other?.plot ?? 1];
        g.player.pos.set((p0.x + pR.x) / 2 + 30, 0, (p0.z + pR.z) / 2 + 35);
        g.cam.yaw = Math.atan2((p0.x + pR.x) / 2 - g.player.pos.x, (p0.z + pR.z) / 2 - g.player.pos.z) + Math.PI;
        g.cam.pitch = 0.92; g.cam.dist = 62;
      });
      await shot(page, `03-mp-${tag}-sees-both-houses`, 1000);
      await page.evaluate(() => {
        const g = window.__hv;
        const other = [...g.mp.session.remotes.values()][0];
        const plot = g.town.housePlots[other?.plot ?? 1];
        g.player.pos.set(plot.x + 14, 0, plot.z + 18);
        g.cam.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z) + Math.PI;
        g.cam.pitch = 0.38; g.cam.dist = 18;
      });
      await shot(page, `03-mp-${tag}-view-remote-house`, 800);
    }
  }
  await A.ctx.close(); await B.ctx.close();
}
await browser.close();
console.log('done');
