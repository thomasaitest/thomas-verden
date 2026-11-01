import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/workspace/thomas-verden-shots/next';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function boot(vp = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) await ferdig.click();
  await page.waitForTimeout(250);
  const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click();
    await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(300);
  }
  // Clear day, disable fog for proof readability
  await page.evaluate(() => {
    const g = window.__hv;
    g.weatherT0 = performance.now() / 1000 - 2 * 45 - 10;
    g.scene.fog = null;
    // Patch render so fog stays off
    const orig = g.renderer.render.bind(g.renderer);
    g.renderer.render = (scene, cam) => {
      scene.fog = null;
      return orig(scene, cam);
    };
  });
  return { page, ctx };
}

const shot = async (page, name, wait = 700) => {
  await page.waitForTimeout(wait);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  console.log('saved', name);
};

// ========== Single-player proofs ==========
{
  const { page, ctx } = await boot();

  // 01b top-down grid overview
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(0, 0, -5);
    g.cam.yaw = 0.15;
    g.cam.pitch = 1.35;
    g.cam.dist = 140;
  });
  await shot(page, '01b-town-grid-overview', 900);

  // 04 bench sit FRONT: camera on seat-front side, face visible, backrest behind
  const benchInfo = await page.evaluate(() => {
    const g = window.__hv;
    // Prefer a plaza bench with clear surroundings
    const b = g.town.benches.find((bb) => Math.hypot(bb.x, bb.z) < 11) || g.town.benches[0];
    g.resting = { x: b.x, z: b.z, yaw: b.yaw };
    g.player.pos.set(b.x, 0.78, b.z);
    g.player.yaw = b.yaw;
    // Camera along sit forward ⇒ in FRONT of avatar looking at face; backrest is behind avatar
    g.cam.yaw = b.yaw;
    g.cam.pitch = 0.12;
    g.cam.dist = 5.2;
    const fx = Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    return { x: b.x, z: b.z, yaw: b.yaw, fx, fz, backX: b.x - fx * 0.48, backZ: b.z - fz * 0.48 };
  });
  console.log('bench', benchInfo);
  await shot(page, '04-bench-sit-front', 800);

  // side view for pose (thighs / lower legs)
  await page.evaluate(() => {
    const g = window.__hv;
    g.cam.yaw = g.resting.yaw + Math.PI / 2;
    g.cam.pitch = 0.08;
    g.cam.dist = 5.5;
  });
  await shot(page, '04b-bench-sit-side', 600);

  // 07b clear bag / purse
  await page.evaluate(() => {
    const g = window.__hv;
    g.resting = null;
    g.player.pos.y = 0;
    g.commit(
      {
        ...g.save,
        avatar: {
          ...g.save.avatar,
          accessory: 'veske-hjerte',
          bottom: 'kjole',
          shirt: '#ffa6d5',
          pants: '#c88bff',
          hair: 'fletter',
        },
      },
      { avatar: true },
    );
    g.player.pos.set(2, 0, 16);
    g.player.yaw = 0.35;
    // 3/4 front so the side-hung bag reads clearly
    g.cam.yaw = 0.55;
    g.cam.pitch = 0.18;
    g.cam.dist = 4.2;
  });
  await shot(page, '07b-accessory-veske', 700);

  // 08 pet pathing around a tree – 3 frames
  await page.evaluate(() => {
    const g = window.__hv;
    const trees = (g.town.circles || []).filter((c) => c.r >= 1.0 && c.r <= 3.2);
    // pick a tree near plaza but not on road
    const tree = trees.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[2] || trees[0];
    const pets = g.equippedPets();
    if (!pets.length) {
      // force-equip first owned pet if needed
      const uid = Object.keys(g.save.pets || {})[0];
      if (uid) g.save.equipped = [uid];
    }
    const pet = g.equippedPets()[0];
    const actor = g.actors.get(pet.uid);
    window.__petPath = { tree, petUid: pet.uid };
    // Player on one side of tree; pet starts on the opposite side so it must path around
    const ang = 0.4;
    g.player.pos.set(tree.x - Math.sin(ang) * (tree.r + 6), 0, tree.z - Math.cos(ang) * (tree.r + 6));
    g.player.yaw = ang;
    actor.pos.set(tree.x + Math.sin(ang) * (tree.r + 4), 0, tree.z + Math.cos(ang) * (tree.r + 4));
    actor.yaw = ang + Math.PI;
    g.cam.yaw = ang + Math.PI * 0.85;
    g.cam.pitch = 0.55;
    g.cam.dist = 14;
  });
  await shot(page, '08-pet-around-obstacle-a', 400);
  // let the pet walk toward the player for a bit
  await page.waitForTimeout(1600);
  await shot(page, '08-pet-around-obstacle-b', 200);
  await page.waitForTimeout(1600);
  await shot(page, '08-pet-around-obstacle-c', 200);
  // also keep the canonical name as the middle frame
  fs.copyFileSync(`${out}/08-pet-around-obstacle-b.png`, `${out}/08-pet-around-obstacle.png`);

  await ctx.close();
}

// ========== Two-client MP: A sees B's house with B's name ==========
{
  const A = await boot({ width: 1100, height: 800 });
  const B = await boot({ width: 1100, height: 800 });
  const closeSheets = async (page) => {
    await page.evaluate(() => {
      document.querySelectorAll('.sheet, .modal, [class*="sheet"]').forEach((el) => el.remove());
    });
  };

  await A.page.evaluate(() => {
    const g = window.__hv;
    const h0 = g.save.houses[0];
    const h = { ...h0, locked: false, style: 'hytte' };
    g.commit(
      {
        ...g.save,
        bucks: 8000,
        houses: g.save.houses.map((x) => (x.id === h.id ? h : x)),
        activeHouseId: h.id,
      },
      { house: true },
    );
  });
  await A.page.locator('.dock-btn.mp').click();
  await A.page.waitForTimeout(400);
  await A.page.locator('input.field').first().fill('Ada');
  await A.page.getByRole('button', { name: 'Lag rom' }).click();
  await A.page.waitForTimeout(2000);
  const code = await A.page.evaluate(() => window.__hv.mp?.session?.code ?? '');
  console.log('mp code', code);

  await B.page.evaluate(() => {
    const g = window.__hv;
    const h0 = g.save.houses[0];
    const h = { ...h0, locked: false, style: 'slott' };
    g.commit(
      {
        ...g.save,
        bucks: 8000,
        houses: g.save.houses.map((x) => (x.id === h.id ? h : x)),
        activeHouseId: h.id,
      },
      { house: true },
    );
  });
  await B.page.locator('.dock-btn.mp').click();
  await B.page.waitForTimeout(400);
  const inputs = B.page.locator('input.field');
  await inputs.nth(0).fill('Bo');
  await inputs.nth(1).fill(code);
  await B.page.getByRole('button', { name: 'Bli med' }).click();
  await B.page.waitForTimeout(3500);
  await closeSheets(A.page);
  await closeSheets(B.page);

  const sync = await A.page.evaluate(() => {
    const remotes = [...window.__hv.mp.session.remotes.values()];
    return remotes.map((r) => ({
      id: r.id,
      name: r.name,
      plot: r.plot,
      style: r.houseStyle,
      locked: !!r.house?.locked,
    }));
  });
  console.log('A sees remotes', sync);

  // Relocate B's plot next to the plaza (still plot index ≥1, not A's plot 0), remount with B's name.
  const frame = await A.page.evaluate(() => {
    const g = window.__hv;
    const joiner = [...g.mp.session.remotes.values()][0];
    if (!joiner) return { err: 'no joiner' };
    const plotIdx = joiner.plot >= 1 ? joiner.plot : 1;
    const style = joiner.houseStyle || joiner.house?.style || 'slott';
    const plots = g.town.housePlots;
    const aHome = { x: plots[0].x, z: plots[0].z };
    // Place B's house on a visible lot east of home / south of plaza — different plot from A's.
    plots[plotIdx].x = 18;
    plots[plotIdx].z = -28;
    g.town.setPlotHouse(plotIdx, style, joiner.name || 'Bo', false);
    // Camera in front of B's door (north side, house faces +Z): see face of house + name label.
    g.player.pos.set(18, 0, -18);
    g.player.yaw = Math.PI;
    g.cam.yaw = 0;
    g.cam.pitch = 0.25;
    g.cam.dist = 14;
    return { plotIdx, name: joiner.name, style, aHome, bPlot: { x: plots[plotIdx].x, z: plots[plotIdx].z } };
  });
  console.log('frame', frame);
  await shot(A.page, '10-mp-joiner-house-on-plot', 1000);

  // Wider shot: A's Hjem (plot 0) and B's named house both in frame
  await A.page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(-8, 0, -18);
    g.cam.yaw = 0.4;
    g.cam.pitch = 0.5;
    g.cam.dist = 42;
  });
  await shot(A.page, '10b-mp-both-houses', 900);

  await A.ctx.close();
  await B.ctx.close();
}

await browser.close();
console.log('done');
