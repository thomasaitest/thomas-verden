import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/workspace/thomas-verden-shots/next2/final';
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
    await klekk.click(); await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => { window.__hv.weatherT0 = performance.now() / 1000 - 100; });
  return { page, ctx };
}

const shot = async (page, name, wait = 700) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};

{
  const { page, ctx } = await boot('solo');

  // ---- Roof eaves: locked side camera on house ----
  for (const style of ['hytte', 'villa', 'moderne', 'slott', 'gard']) {
    await page.evaluate((style) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
      g.resting = null;
      const h0 = g.save.houses[0];
      g.commit({
        ...g.save,
        houses: g.save.houses.map((x) => (x.id === h0.id ? { ...h0, style } : x)),
        activeHouseId: h0.id,
      }, { house: true });
      const p = g.town.housePlots[0];
      g.player.pos.set(p.x + 16, 0, p.z);
      // Camera due east of house center, eye-level looking at mid wall/roof junction
      g.freezeCam = {
        x: p.x + 16, y: 8, z: p.z,
        lx: p.x, ly: 10, lz: p.z,
      };
    }, style);
    await shot(page, `07-eaves-side-${style}`, 800);
  }
  await page.evaluate(() => { window.__hv.freezeCam = null; });

  // ---- Benches: true side profile with freezeCam ----
  const benches = await page.evaluate(() => window.__hv.town.benches.map((b, i) => ({ i, ...b })));
  const picks = [];
  const used = new Set();
  for (const b of benches) {
    const k = (Math.round(b.yaw * 2) / 2).toFixed(2);
    if (!used.has(k)) { used.add(k); picks.push(b); }
  }
  const three = picks.slice(0, 3);
  let n = 0;
  for (const b of three) {
    n++;
    await page.evaluate((b) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
      g.resting = { x: b.x, z: b.z, yaw: b.yaw };
      g.player.pos.set(b.x, 0.08, b.z);
      g.player.yaw = b.yaw;
      // Right-side profile: offset along (cos yaw, -sin yaw), look at hips
      const rx = Math.cos(b.yaw);
      const rz = -Math.sin(b.yaw);
      g.freezeCam = {
        x: b.x + rx * 3.0,
        y: 1.15,
        z: b.z + rz * 3.0,
        lx: b.x,
        ly: 0.95,
        lz: b.z,
      };
    }, b);
    await shot(page, `04-bench-side-${n}-yaw${b.yaw.toFixed(2)}`, 900);
  }
  // Front: camera along facing, look at face; backrest behind avatar
  const b0 = three[0];
  await page.evaluate((b) => {
    const g = window.__hv;
    g.resting = { x: b.x, z: b.z, yaw: b.yaw };
    g.player.pos.set(b.x, 0.08, b.z);
    g.player.yaw = b.yaw;
    const fx = Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    g.freezeCam = {
      x: b.x + fx * 3.2,
      y: 1.2,
      z: b.z + fz * 3.2,
      lx: b.x,
      ly: 1.0,
      lz: b.z,
    };
  }, b0);
  await shot(page, `04-bench-front-yaw${b0.yaw.toFixed(2)}`, 900);
  await page.evaluate(() => { window.__hv.freezeCam = null; window.__hv.resting = null; });

  // ---- Fountain ----
  await page.evaluate(() => {
    const g = window.__hv;
    g.__jetT = 1.0;
    if (!g.__jetWrapped) {
      const orig = g.town.update.bind(g.town);
      g.town.update = (t, x, z, cx, cz) => orig(g.__jetT != null ? g.__jetT : t, x, z, cx, cz);
      g.__jetWrapped = true;
    }
    g.freezeCam = { x: 0, y: 9, z: 14, lx: 0, ly: 5.5, lz: 0 };
  });
  await shot(page, '05-fountain-jets-on', 700);
  await page.evaluate(() => { window.__hv.__jetT = 3.0; });
  await shot(page, '05-fountain-jets-off', 600);

  // ---- Cars lineup ----
  await page.evaluate(async () => {
    const g = window.__hv;
    g.freezeCam = null;
    g.driving = null;
    if (g.vehicleMesh) { g.scene.remove(g.vehicleMesh); g.vehicleMesh = null; }
    if (g.__carLineup) for (const m of g.__carLineup) g.scene.remove(m);
    g.__carLineup = [];
    const mod = await import('/src/three/vehicles.ts');
    ['bil-rosa', 'bil-gul', 'bil-bla', 'bil-gronn', 'bil-lilla'].forEach((id, i) => {
      const m = mod.buildCar(id);
      m.position.set(-7 + i * 3.5, 0, 20);
      m.rotation.y = 0.9;
      g.scene.add(m);
      g.__carLineup.push(m);
    });
    g.freezeCam = { x: 0, y: 4.5, z: 30, lx: 0, ly: 1.2, lz: 20 };
  });
  await shot(page, '06-cars-lineup', 900);

  await page.evaluate(() => {
    const g = window.__hv;
    if (g.__carLineup) for (const m of g.__carLineup) g.scene.remove(m);
    g.__carLineup = [];
    g.save.bag['bil-rosa'] = 1;
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.player.pos.set(5, 0, 16);
    g.player.yaw = 0.4;
    g.freezeCam = { x: 10, y: 2.2, z: 20, lx: 5, ly: 1.1, lz: 16 };
  });
  await shot(page, '06-car-convertible-open', 700);

  // ---- Shop signs overview ----
  await page.evaluate(() => {
    const g = window.__hv;
    g.driving = null;
    if (g.vehicleMesh) { g.scene.remove(g.vehicleMesh); g.vehicleMesh = null; }
    g.freezeCam = { x: 8, y: 55, z: -8, lx: 10, ly: 0, lz: -10 };
  });
  await shot(page, '02-shop-signs-overview', 1000);
  await page.evaluate(() => { window.__hv.freezeCam = null; });

  await ctx.close();
}

// ---- MP ----
{
  const A = await boot('A', { viewport: { width: 1280, height: 900 } });
  const B = await boot('B', { viewport: { width: 1280, height: 900 } });

  await A.page.evaluate(() => {
    const g = window.__hv;
    const h0 = g.save.houses[0];
    g.commit({
      ...g.save, bucks: 9000,
      houses: g.save.houses.map((x) => (x.id === h0.id ? { ...h0, style: 'villa' } : x)),
      activeHouseId: h0.id,
    }, { house: true });
  });
  await A.page.locator('.dock-btn.mp').click();
  await A.page.waitForTimeout(400);
  await A.page.locator('input.field').first().fill('Ada');
  await A.page.getByRole('button', { name: 'Lag rom' }).click();
  await A.page.waitForTimeout(2500);
  const code = await A.page.evaluate(() => window.__hv.mp?.session?.code ?? '');
  console.log('room', code);

  if (code) {
    await B.page.evaluate(() => {
      const g = window.__hv;
      const h0 = g.save.houses[0];
      g.commit({
        ...g.save, bucks: 9000,
        houses: g.save.houses.map((x) => (x.id === h0.id ? { ...h0, style: 'slott' } : x)),
        activeHouseId: h0.id,
      }, { house: true });
    });
    await B.page.locator('.dock-btn.mp').click();
    await B.page.waitForTimeout(400);
    await B.page.locator('input.field').nth(0).fill('Bo');
    await B.page.locator('input.field').nth(1).fill(code);
    await B.page.getByRole('button', { name: 'Bli med' }).click();
    await B.page.waitForTimeout(4500);

    const sync = await A.page.evaluate(() => ({
      A: {
        local: window.__hv.save.houses.find((h) => h.id === window.__hv.save.activeHouseId)?.style,
        remotes: [...window.__hv.mp.session.remotes.values()].map((r) => ({
          name: r.name, plot: r.plot, style: r.house?.style || r.houseStyle,
          plotPos: window.__hv.town.housePlots[r.plot ?? 0],
        })),
      },
    }));
    const syncB = await B.page.evaluate(() => ({
      B: {
        local: window.__hv.save.houses.find((h) => h.id === window.__hv.save.activeHouseId)?.style,
        remotes: [...window.__hv.mp.session.remotes.values()].map((r) => ({
          name: r.name, plot: r.plot, style: r.house?.style || r.houseStyle,
          plotPos: window.__hv.town.housePlots[r.plot ?? 0],
        })),
      },
    }));
    fs.writeFileSync(`${out}/03-mp-sync.json`, JSON.stringify({ ...sync, ...syncB }, null, 2));
    console.log(JSON.stringify({ ...sync, ...syncB }));

    await A.page.evaluate(() => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
      const other = [...g.mp.session.remotes.values()][0];
      const p0 = g.town.housePlots[0];
      const pR = g.town.housePlots[other.plot];
      const mx = (p0.x + pR.x) / 2;
      const mz = (p0.z + pR.z) / 2;
      g.freezeCam = { x: mx, y: 48, z: mz + 5, lx: mx, ly: 0, lz: mz };
    });
    await shot(A.page, '03-mp-topdown-both-houses', 1100);

    await A.page.evaluate(() => {
      const g = window.__hv;
      const other = [...g.mp.session.remotes.values()][0];
      const plot = g.town.housePlots[other.plot];
      // Street view: SE of house looking at front + name post
      g.freezeCam = {
        x: plot.x + 12, y: 5, z: plot.z + 18,
        lx: plot.x, ly: 4, lz: plot.z + 2,
      };
    });
    await shot(A.page, '03-mp-street-remote-house-named', 1000);

    await B.page.evaluate(() => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
      const other = [...g.mp.session.remotes.values()][0];
      const plot = g.town.housePlots[other.plot];
      g.freezeCam = {
        x: plot.x + 12, y: 5, z: plot.z + 18,
        lx: plot.x, ly: 4, lz: plot.z + 2,
      };
    });
    await shot(B.page, '03-mp-joiner-street-host-villa', 1000);
  }

  await A.ctx.close();
  await B.ctx.close();
}

await browser.close();
console.log('done');
