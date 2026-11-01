// Proof screenshots for next2 (t58u). Usage: node scripts/shots-next2.mjs [url] [outDir]
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
  await page.waitForTimeout(500);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) {
    await ferdig.click();
    await page.waitForTimeout(250);
  }
  const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click();
    await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => {
    const g = window.__hv;
    g.weatherT0 = performance.now() / 1000 - 2 * 45 - 10;
  });
  return { page, ctx };
}

const shot = async (page, name, wait = 500) => {
  await page.waitForTimeout(wait);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  console.log('saved', path);
  return path;
};

const faceEntrance = (doorKey, dist = 12, pitch = 0.35) => ({
  doorKey, dist, pitch,
});

// ---------- Solo ----------
{
  const { page, ctx } = await boot('solo');

  // Shop signs: street + above for each shop
  for (const [key, name, dist, pitchStreet, pitchAbove] of [
    ['shop', 'butikk', 14, 0.32, 0.95],
    ['vet', 'dyrlegen', 14, 0.32, 0.95],
    ['eggs', 'eggbutikk', 13, 0.35, 1.0],
    ['cars', 'bilbutikk', 16, 0.3, 0.9],
    ['pets', 'dyrebutikk', 15, 0.32, 0.95],
    ['doors', 'dorspillet', 13, 0.35, 1.0],
  ]) {
    await page.evaluate(({ key, dist, pitch }) => {
      const g = window.__hv;
      const door = g.town.entrances[key];
      if (!door) return;
      g.player.pos.set(door.x + Math.sin(door.yaw) * dist, 0, door.z + Math.cos(door.yaw) * dist);
      g.player.yaw = door.yaw + Math.PI;
      g.cam.yaw = door.yaw;
      g.cam.pitch = pitch;
      g.cam.dist = dist + 2;
    }, { key, dist, pitch: pitchStreet });
    await shot(page, `02-sign-${name}-street`, 700);
    await page.evaluate(({ key, dist, pitch }) => {
      const g = window.__hv;
      const door = g.town.entrances[key];
      if (!door) return;
      g.player.pos.set(door.x + Math.sin(door.yaw) * (dist + 4), 0, door.z + Math.cos(door.yaw) * (dist + 4));
      g.cam.yaw = door.yaw;
      g.cam.pitch = pitch;
      g.cam.dist = dist + 8;
    }, { key, dist, pitch: pitchAbove });
    await shot(page, `02-sign-${name}-above`, 700);
  }

  // Benches: side views at several orientations
  const benches = await page.evaluate(() => {
    const g = window.__hv;
    return g.town.benches.map((b, i) => ({ i, x: b.x, z: b.z, yaw: b.yaw }));
  });
  // Pick plaza-ish and street-ish by distance from origin
  const sorted = [...benches].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const pick = [sorted[0], sorted[Math.floor(sorted.length / 3)], sorted[Math.floor((2 * sorted.length) / 3)], sorted[sorted.length - 1]].filter(Boolean);
  let bi = 0;
  for (const b of pick) {
    bi++;
    // Sit
    await page.evaluate((b) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      g.resting = { x: b.x, z: b.z, yaw: b.yaw };
      g.player.pos.set(b.x, 0.02, b.z);
      g.player.yaw = b.yaw;
      // Side view: camera to the right of facing
      const side = b.yaw + Math.PI / 2;
      g.cam.yaw = side;
      g.cam.pitch = 0.12;
      g.cam.dist = 5.5;
    }, b);
    await shot(page, `04-bench-side-${bi}-yaw${b.yaw.toFixed(2)}`, 800);
  }

  // Fountain jets on and off
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(2, 0, 8);
    g.cam.yaw = 0.2;
    g.cam.pitch = 0.45;
    g.cam.dist = 16;
    // Freeze time so jet phase is deterministic: t%4 < 2.2 => on
    g.__shotT = 1.0;
  });
  // Force update with jet on by calling town.update with t where (t%4)<2.2
  await page.evaluate(() => {
    const g = window.__hv;
    g.town.update(1.0, g.player.pos.x, g.player.pos.z, g.camera.position.x, g.camera.position.z);
  });
  await shot(page, '05-fountain-jets-on', 400);
  await page.evaluate(() => {
    const g = window.__hv;
    g.town.update(3.0, g.player.pos.x, g.player.pos.z, g.camera.position.x, g.camera.position.z);
  });
  await shot(page, '05-fountain-jets-off', 400);

  // Unique cars
  for (const id of ['bil-rosa', 'bil-gul', 'bil-bla', 'bil-gronn', 'bil-lilla']) {
    await page.evaluate((id) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      g.save.bag[id] = 1;
      g.driving = null;
      if (g.vehicleMesh) {
        g.scene.remove(g.vehicleMesh);
        g.vehicleMesh = null;
      }
      g.driving = id;
      g.syncVehicleMesh();
      g.player.pos.set(6, 0, 20);
      g.player.yaw = 0.4;
      g.cam.yaw = 1.05;
      g.cam.pitch = 0.22;
      g.cam.dist = 8;
    }, id);
    await shot(page, `06-car-${id}`, 600);
  }

  // Roof overhang – street and top
  await page.evaluate(() => {
    const g = window.__hv;
    const h0 = g.save.houses[0];
    const h = { ...h0, style: 'hytte' };
    g.commit({ ...g.save, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id }, { house: true });
    const door = g.town.entrances.home;
    g.player.pos.set(door.x + Math.sin(door.yaw) * 16, 0, door.z + Math.cos(door.yaw) * 16);
    g.cam.yaw = door.yaw;
    g.cam.pitch = 0.4;
    g.cam.dist = 18;
  });
  await shot(page, '07-roof-overhang-street', 700);
  await page.evaluate(() => {
    const g = window.__hv;
    const door = g.town.entrances.home;
    g.player.pos.set(door.x, 0, door.z + 2);
    g.cam.yaw = 0.3;
    g.cam.pitch = 1.15;
    g.cam.dist = 28;
  });
  await shot(page, '07-roof-overhang-above', 700);

  // Different floor plans – enter two styles and shoot interiors
  for (const style of ['hytte', 'moderne', 'slott']) {
    await page.evaluate((style) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      const h0 = g.save.houses[0];
      const h = { ...h0, style };
      g.commit({ ...g.save, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id }, { house: true });
      g.enterHouse();
      g.player.pos.set(0, 0, 4);
      g.player.yaw = Math.PI;
      g.cam.yaw = Math.PI;
      g.cam.pitch = 0.25;
      g.cam.dist = 10;
    }, style);
    await shot(page, `08-floorplan-${style}`, 900);
    await page.evaluate(() => {
      const g = window.__hv;
      if (g.mode === 'house') g.exitHouse();
    });
  }

  // Potion not in shop
  await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
  });
  await page.locator('.dock-btn').filter({ hasText: 'Kart' }).count().catch(() => 0);
  // Open shop via zone API if available
  await page.evaluate(() => {
    const g = window.__hv;
    // open shop panel directly
    import('/src/ui/panels.ts').catch(() => {});
  });
  // Use keyboard path: call openShop if exposed
  await page.evaluate(async () => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
    const mod = await import('/src/ui/panels.ts');
    mod.openShop(g);
  });
  await shot(page, '01-shop-no-potion-buy', 700);

  // Force potion drop toast / bag after flight drop
  await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
    // grant flyable pet and simulate many drops
    const pet = g.save.pets[0];
    if (pet) {
      g.commit({
        ...g.save,
        pets: g.save.pets.map((p) => (p.uid === pet.uid ? { ...p, flyable: true } : p)),
        equipped: [pet.uid],
      }, { pets: true });
    }
    let got = null;
    for (let i = 0; i < 40; i++) {
      const r = g.__dropPotionTest
        ? g.__dropPotionTest()
        : null;
    }
  });
  // Call maybeDropPotionFromFlight via injecting
  const drop = await page.evaluate(async () => {
    const mod = await import('/src/logic/economy.ts');
    const g = window.__hv;
    let last = null;
    for (let i = 0; i < 60; i++) {
      const r = mod.maybeDropPotionFromFlight(g.save, () => Math.random());
      if (r.ok) {
        g.commit(r.save);
        last = r.potionId;
        break;
      }
    }
    return last;
  });
  console.log('potion drop', drop);
  await page.evaluate(() => {
    const g = window.__hv;
    g.flying = true;
    g.player.pos.set(0, 8, 0);
    g.cam.yaw = 0.5;
    g.cam.pitch = 0.4;
    g.cam.dist = 12;
  });
  await shot(page, '01-potion-fly-drop-bag', 600);

  await ctx.close();
}

// ---------- MP two clients different houses ----------
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
    const h = { ...h0, locked: false, style: 'villa' };
    g.commit({ ...g.save, bucks: 9000, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id }, { house: true });
    g.player.pos.set(-5, 0, 6);
  });
  await openMp(A.page);
  await A.page.locator('input.field').first().fill('Ada');
  await A.page.getByRole('button', { name: 'Lag rom' }).click();
  await A.page.waitForTimeout(2200);
  const code = await A.page.evaluate(() => window.__hv.mp?.session?.code ?? '');
  console.log('room', code);

  if (code) {
    await B.page.evaluate(() => {
      const g = window.__hv;
      const h0 = g.save.houses[0];
      const h = { ...h0, locked: false, style: 'slott' };
      g.commit({ ...g.save, bucks: 9000, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id }, { house: true });
      g.player.pos.set(5, 0, 6);
    });
    await openMp(B.page);
    const inputs = B.page.locator('input.field');
    await inputs.nth(0).fill('Bo');
    await inputs.nth(1).fill(code);
    await B.page.getByRole('button', { name: 'Bli med' }).click();
    await B.page.waitForTimeout(3500);

    const syncA = await A.page.evaluate(() => {
      const remotes = [...window.__hv.mp.session.remotes.values()];
      return remotes.map((r) => ({ name: r.name, plot: r.plot, style: r.house?.style || r.houseStyle }));
    });
    const syncB = await B.page.evaluate(() => {
      const remotes = [...window.__hv.mp.session.remotes.values()];
      return remotes.map((r) => ({ name: r.name, plot: r.plot, style: r.house?.style || r.houseStyle }));
    });
    console.log('syncA', JSON.stringify(syncA));
    console.log('syncB', JSON.stringify(syncB));
    fs.writeFileSync(`${out}/03-mp-sync.json`, JSON.stringify({ syncA, syncB, code }, null, 2));

    // Host view: own villa (plot0) + joiner slott on remote plot
    await A.page.evaluate(() => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      const remotes = [...g.mp.session.remotes.values()];
      const joiner = remotes[0];
      const p0 = g.town.housePlots[0];
      const pJ = joiner?.plot != null ? g.town.housePlots[joiner.plot] : g.town.housePlots[1];
      const midX = (p0.x + pJ.x) / 2;
      const midZ = (p0.z + pJ.z) / 2;
      g.player.pos.set(midX + 25, 0, midZ + 30);
      g.cam.yaw = Math.atan2(midX - g.player.pos.x, midZ - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.85;
      g.cam.dist = 55;
    });
    await shot(A.page, '03-mp-host-sees-both-houses', 1000);

    // Joiner view: own slott (plot0) + host villa on remote plot
    await B.page.evaluate(() => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      const remotes = [...g.mp.session.remotes.values()];
      const host = remotes[0];
      const p0 = g.town.housePlots[0];
      const pH = host?.plot != null ? g.town.housePlots[host.plot] : g.town.housePlots[1];
      const midX = (p0.x + pH.x) / 2;
      const midZ = (p0.z + pH.z) / 2;
      g.player.pos.set(midX + 25, 0, midZ + 30);
      g.cam.yaw = Math.atan2(midX - g.player.pos.x, midZ - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.85;
      g.cam.dist = 55;
    });
    await shot(B.page, '03-mp-joiner-sees-both-houses', 1000);

    // Close-ups of each remote house style
    await A.page.evaluate(() => {
      const g = window.__hv;
      const remotes = [...g.mp.session.remotes.values()];
      const joiner = remotes[0];
      const plot = g.town.housePlots[joiner?.plot ?? 1];
      g.player.pos.set(plot.x + 14, 0, plot.z + 16);
      g.cam.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.35;
      g.cam.dist = 18;
    });
    await shot(A.page, '03-mp-host-view-joiner-slott', 800);

    await B.page.evaluate(() => {
      const g = window.__hv;
      const remotes = [...g.mp.session.remotes.values()];
      const host = remotes[0];
      const plot = g.town.housePlots[host?.plot ?? 1];
      g.player.pos.set(plot.x + 14, 0, plot.z + 16);
      g.cam.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.35;
      g.cam.dist = 18;
    });
    await shot(B.page, '03-mp-joiner-view-host-villa', 800);
  } else {
    console.log('MP failed – no code');
  }

  await A.ctx.close();
  await B.ctx.close();
}

await browser.close();
console.log('done');
