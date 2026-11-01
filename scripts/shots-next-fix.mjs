import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/workspace/thomas-verden-shots/next';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function boot(vp = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  await page.waitForTimeout(500);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) await ferdig.click();
  await page.waitForTimeout(300);
  const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click();
    await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => {
    window.__hv.weatherT0 = performance.now() / 1000 - 2 * 45 - 10;
  });
  return { page, ctx };
}
const shot = async (page, name, wait = 600) => {
  await page.waitForTimeout(wait);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  console.log('saved', path);
};

{
  const { page, ctx } = await boot();

  // Overview again
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(-5, 0, -10);
    g.cam.yaw = 0.55;
    g.cam.pitch = 1.25;
    g.cam.dist = 125;
  });
  await shot(page, '01-plaza-day-roads', 800);

  // Vet OUTSIDE facade
  await page.evaluate(() => {
    const g = window.__hv;
    const door = g.town.entrances.vet;
    const outYaw = door.yaw;
    // well outside the building footprint
    g.player.pos.set(door.x + Math.sin(outYaw) * 16, 0, door.z + Math.cos(outYaw) * 16);
    g.player.yaw = outYaw + Math.PI;
    g.cam.yaw = outYaw;
    g.cam.pitch = 0.38;
    g.cam.dist = 20;
  });
  await shot(page, '03-vet-cross-sign', 900);

  // Shop signs – close-ups of 3D boards
  for (const [kind, name] of [
    ['shop', '02-shop-3d-sign'],
    ['eggs', '03b-sign-eggbutikk'],
    ['cars', '03c-sign-bilbutikk'],
    ['pets', '03d-sign-dyrebutikk'],
  ]) {
    await page.evaluate((kind) => {
      const g = window.__hv;
      const door = g.town.entrances[kind];
      const outYaw = door.yaw;
      g.player.pos.set(door.x + Math.sin(outYaw) * 12, 0, door.z + Math.cos(outYaw) * 12);
      g.player.yaw = outYaw + Math.PI;
      g.cam.yaw = outYaw;
      g.cam.pitch = 0.42;
      g.cam.dist = 14;
    }, kind);
    await shot(page, name, 500);
  }

  // Bench front + side on plaza
  await page.evaluate(() => {
    const g = window.__hv;
    const b = g.town.benches.find((bb) => Math.hypot(bb.x, bb.z) < 11);
    g.resting = { x: b.x, z: b.z, yaw: b.yaw };
    g.player.pos.set(b.x, 0.85, b.z);
    g.player.yaw = b.yaw;
    g.cam.yaw = b.yaw;
    g.cam.pitch = 0.16;
    g.cam.dist = 5.8;
  });
  await shot(page, '04-bench-sit-front', 700);
  await page.evaluate(() => {
    const g = window.__hv;
    g.cam.yaw = g.resting.yaw + Math.PI / 2;
    g.cam.pitch = 0.12;
    g.cam.dist = 6.2;
  });
  await shot(page, '04b-bench-sit-side', 600);
  await page.evaluate(() => {
    const g = window.__hv;
    g.resting = null;
    g.player.pos.y = 0;
    g.player.pos.set(0, 0, 0);
    g.cam.yaw = 0.2;
    g.cam.pitch = 0.95;
    g.cam.dist = 28;
  });
  await shot(page, '04c-plaza-benches-off-road', 600);

  // Accessories – close 3/4 views so wings/bag/jewellery read
  const accs = [
    ['vinger', '07a-accessory-vinger', Math.PI * 0.65], // show back wings
    ['veske-hjerte', '07b-accessory-veske', Math.PI * 0.35],
    ['halskjede', '07c-accessory-halskjede', 0.15],
    ['perlekjede', '07d-accessory-perlekjede', 0.15],
    ['sekk-stjerne', '07e-accessory-sekk', Math.PI * 0.7],
  ];
  for (const [acc, name, camOff] of accs) {
    await page.evaluate(({ acc, camOff }) => {
      const g = window.__hv;
      g.resting = null;
      g.commit({ ...g.save, avatar: { ...g.save.avatar, accessory: acc, bottom: 'kjole', shirt: '#ffa6d5', pants: '#c88bff' } }, { avatar: true });
      g.player.pos.set(3, 0, 18);
      g.player.yaw = 0;
      g.cam.yaw = camOff;
      g.cam.pitch = 0.22;
      g.cam.dist = 5.5;
    }, { acc, camOff });
    await shot(page, name, 500);
  }

  // Pet around tree – place tree between pet and player, wait for resolve/follow
  await page.evaluate(() => {
    const g = window.__hv;
    const tree = (g.town.circles || []).filter((c) => c.r >= 1.2 && c.r <= 3.5).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[3];
    const pet = g.equippedPets()[0];
    const actor = g.actors.get(pet.uid);
    const ang = 0.3;
    g.player.pos.set(tree.x - Math.sin(ang) * (tree.r + 5), 0, tree.z - Math.cos(ang) * (tree.r + 5));
    actor.pos.set(tree.x + Math.sin(ang) * (tree.r + 3), 0, tree.z + Math.cos(ang) * (tree.r + 3));
    // nudge pet into tree briefly so resolve pushes it out (proves collision)
    actor.pos.set(tree.x, 0, tree.z);
    g.cam.yaw = ang + Math.PI * 0.9;
    g.cam.pitch = 0.55;
    g.cam.dist = 12;
    window.__tree = tree;
  });
  await page.waitForTimeout(1800);
  await shot(page, '08-pet-around-obstacle', 400);

  // Cabin car close
  await page.evaluate(() => {
    const g = window.__hv;
    g.save.bag['bil-rosa'] = 1;
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.player.pos.set(6, 0, 20);
    g.player.yaw = 0.4;
    g.cam.yaw = 0.9;
    g.cam.pitch = 0.2;
    g.cam.dist = 7.5;
  });
  await shot(page, '09-car-rosa-cabin');

  await ctx.close();
}

// Montage
try { execSync(`python3 scripts/make-signs-montage.py ${out}`, { stdio: 'inherit' }); } catch {}

// MP with sheets closed
{
  const A = await boot({ width: 960, height: 720 });
  const B = await boot({ width: 960, height: 720 });
  const closeSheets = async (page) => {
    await page.evaluate(() => {
      document.querySelectorAll('.sheet, .modal, [class*="sheet"]').forEach((el) => el.remove());
    });
  };

  await A.page.evaluate(() => {
    const g = window.__hv;
    const h0 = g.save.houses[0];
    const h = { ...h0, locked: true, style: 'villa' };
    g.commit({ ...g.save, bucks: 8000, bag: { ...g.save.bag, 'bil-rosa': 1 }, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id }, { house: true });
  });
  await A.page.locator('.dock-btn.mp').click();
  await A.page.waitForTimeout(400);
  await A.page.locator('input.field').first().fill('Ada');
  await A.page.getByRole('button', { name: 'Lag rom' }).click();
  await A.page.waitForTimeout(1800);
  const code = await A.page.evaluate(() => window.__hv.mp?.session?.code ?? '');
  console.log('code', code);

  await B.page.evaluate(() => {
    const g = window.__hv;
    const h0 = g.save.houses[0];
    const h = { ...h0, locked: false, style: 'slott' };
    g.commit({ ...g.save, bucks: 8000, bag: { ...g.save.bag, 'bil-bla': 1 }, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id }, { house: true });
  });
  await B.page.locator('.dock-btn.mp').click();
  await B.page.waitForTimeout(400);
  const inputs = B.page.locator('input.field');
  await inputs.nth(0).fill('Bo');
  await inputs.nth(1).fill(code);
  await B.page.getByRole('button', { name: 'Bli med' }).click();
  await B.page.waitForTimeout(3000);
  await closeSheets(A.page);
  await closeSheets(B.page);

  const sync = await A.page.evaluate(() => {
    const remotes = [...window.__hv.mp.session.remotes.values()];
    return remotes.map((r) => ({ name: r.name, plot: r.plot, style: r.houseStyle, locked: !!r.house?.locked }));
  });
  console.log('sync', sync);

  // 10 joiner house on plot – no overlay
  await A.page.evaluate(() => {
    const g = window.__hv;
    const joiner = [...g.mp.session.remotes.values()][0];
    const plot = g.town.housePlots[joiner.plot];
    g.player.pos.set(plot.x + 20, 0, plot.z + 24);
    g.cam.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z) + Math.PI;
    g.cam.pitch = 0.72;
    g.cam.dist = 40;
  });
  await shot(A.page, '10-mp-joiner-house-on-plot', 900);

  // 12 lock on host house from joiner
  await B.page.evaluate(() => {
    const g = window.__hv;
    const host = [...g.mp.session.remotes.values()][0];
    const plot = g.town.housePlots[host.plot];
    g.player.pos.set(plot.x + 12, 0, plot.z + 14);
    g.cam.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z) + Math.PI;
    g.cam.pitch = 0.3;
    g.cam.dist = 16;
  });
  await shot(B.page, '12-mp-house-lock', 900);

  // 13 remote car
  await A.page.evaluate(() => {
    const g = window.__hv;
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.player.pos.set(5, 0, 16);
    g.player.yaw = 0.5;
    g.cam.yaw = 1.0;
    g.cam.pitch = 0.2;
    g.cam.dist = 8;
  });
  await A.page.waitForTimeout(1500);
  await B.page.evaluate(() => {
    const g = window.__hv;
    const live = [...g.mp.session.tickRemotes()];
    const host = live.find((r) => r.mount === 'drive') || live[0];
    if (host) {
      g.player.pos.set(host.x - Math.sin(host.yaw + 1.1) * 8, 0, host.z - Math.cos(host.yaw + 1.1) * 8);
      g.cam.yaw = Math.atan2(host.x - g.player.pos.x, host.z - g.player.pos.z) + Math.PI;
      // actually cam.yaw is offset from target: point camera toward host from a side angle
      g.cam.yaw = host.yaw + 1.0;
      g.cam.pitch = 0.22;
      g.cam.dist = 9;
      g.player.pos.set(host.x, 0, host.z); // orbit around host
    }
  });
  await shot(B.page, '13-mp-remote-car', 1000);
  await shot(A.page, '13b-mp-local-driving', 400);

  await A.ctx.close();
  await B.ctx.close();
}

await browser.close();
console.log('fix shots done');
