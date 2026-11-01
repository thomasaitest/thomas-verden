// Proof screenshots for the "next" round. Usage: node scripts/shots-next.mjs [url] [outDir]
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

async function boot(label, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(label, 'PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  await page.waitForTimeout(600);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) {
    await ferdig.click();
    await page.waitForTimeout(300);
  }
  const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click();
    await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(400);
  }
  // Force clear daytime (weather slot 2 / 4 / 6 = clear)
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

// ---------- Solo proof ----------
{
  const { page, ctx } = await boot('A');

  // 01 High overview of whole town / road grid (maxDist now 140)
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(-5, 0, -10);
    g.cam.yaw = 0.55;
    g.cam.pitch = 1.25;
    g.cam.dist = 125;
  });
  await shot(page, '01-plaza-day-roads', 900);

  // 01b angled overview showing streets connect shops/houses
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(0, 0, -5);
    g.cam.yaw = -0.7;
    g.cam.pitch = 1.15;
    g.cam.dist = 115;
  });
  await shot(page, '01b-town-grid-overview', 700);

  // 02 Shop 3D sign
  await page.evaluate(() => {
    const g = window.__hv;
    const door = g.town.entrances.shop;
    const faceYaw = door.yaw; // shop entrance yaw faces outward already? check: yaw: f.rot
    // shop: entrances.shop yaw = f.rot (facing plaza / outward from building front? door is in front)
    // Stand outside looking at facade
    g.player.pos.set(door.x + Math.sin(door.yaw) * 9, 0, door.z + Math.cos(door.yaw) * 9);
    g.player.yaw = door.yaw + Math.PI;
    g.cam.yaw = door.yaw;
    g.cam.pitch = 0.28;
    g.cam.dist = 15;
  });
  await shot(page, '02-shop-3d-sign');

  // 03 Vet: stand in front of facade so Dyrlegen + red cross are visible
  await page.evaluate(() => {
    const g = window.__hv;
    const door = g.town.entrances.vet;
    // Face the building (entrance yaw points outward; flip it)
    const faceYaw = door.yaw + Math.PI;
    // Step a bit further out from the door toward the plaza
    const out = door.yaw; // outward direction
    g.player.pos.set(door.x + Math.sin(out) * 10, 0, door.z + Math.cos(out) * 10);
    g.player.yaw = faceYaw;
    // Camera behind the player (toward plaza) looking at facade
    g.cam.yaw = faceYaw + Math.PI;
    g.cam.pitch = 0.32;
    g.cam.dist = 18;
  });
  await shot(page, '03-vet-cross-sign', 800);

  // Shop-sign montage pieces
  for (const [kind, name] of [
    ['eggs', '03b-sign-eggbutikk'],
    ['cars', '03c-sign-bilbutikk'],
    ['pets', '03d-sign-dyrebutikk'],
  ]) {
    await page.evaluate((kind) => {
      const g = window.__hv;
      const door = g.town.entrances[kind];
      const out = door.yaw;
      g.player.pos.set(door.x + Math.sin(out) * 10, 0, door.z + Math.cos(out) * 10);
      g.player.yaw = out + Math.PI;
      g.cam.yaw = out;
      g.cam.pitch = 0.28;
      g.cam.dist = 15;
    }, kind);
    await shot(page, name);
  }

  // 04 Bench – FRONT view (avatar centred on seat, back against backrest, same yaw)
  const benchInfo = await page.evaluate(() => {
    const g = window.__hv;
    // Prefer a plaza lawn bench (facing fountain)
    let b = g.town.benches.find((bb) => Math.hypot(bb.x, bb.z) < 11) ?? g.town.benches[0];
    g.resting = { x: b.x, z: b.z, yaw: b.yaw };
    g.player.pos.set(b.x, 0.85, b.z);
    g.player.yaw = b.yaw;
    // Camera sits in front of the avatar (along sit facing) so we see their face + bench front
    g.cam.yaw = b.yaw;
    g.cam.pitch = 0.18;
    g.cam.dist = 6.2;
    return { x: b.x, z: b.z, yaw: b.yaw, n: g.town.benches.length };
  });
  console.log('bench', benchInfo);
  await shot(page, '04-bench-sit-front', 700);

  // 04b Bench – SIDE view (profile: backrest behind, legs forward)
  await page.evaluate(() => {
    const g = window.__hv;
    const b = g.resting;
    g.cam.yaw = b.yaw + Math.PI / 2;
    g.cam.pitch = 0.14;
    g.cam.dist = 6.8;
  });
  await shot(page, '04b-bench-sit-side', 600);

  // 04c Confirm plaza benches not on road – overview of plaza edge
  await page.evaluate(() => {
    const g = window.__hv;
    g.resting = null;
    g.player.pos.y = 0;
    g.player.pos.set(0, 0, 18);
    g.cam.yaw = Math.PI;
    g.cam.pitch = 0.7;
    g.cam.dist = 32;
  });
  await shot(page, '04c-plaza-benches-off-road');

  // 05 Playground no logo
  await page.evaluate(() => {
    const g = window.__hv;
    const z = g.town.zones.find((z) => z.kind === 'play');
    g.player.pos.set(z.x, 0, z.z + 14);
    g.cam.yaw = Math.PI;
    g.cam.pitch = 0.45;
    g.cam.dist = 22;
  });
  await shot(page, '05-playground-no-sign');

  // 06 Sleep
  await page.evaluate(() => {
    const g = window.__hv;
    g.enterHouse();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const g = window.__hv;
    const house = g.guestHouse ?? g.save.houses.find((h) => h.id === g.save.activeHouseId) ?? g.save.houses[0];
    const bed = house.items.find((i) => i.id === 'seng') ?? house.items[0];
    if (!bed) return;
    const y = (bed.floor ?? 0) * 4.2 + 0.55;
    g.sleeping = { x: bed.x, y, z: bed.z, yaw: bed.rot ?? 0, itemUid: bed.uid };
    g.player.pos.set(bed.x, y, bed.z);
    g.player.yaw = bed.rot ?? 0;
    g.cam.yaw = (bed.rot ?? 0) + 0.9;
    g.cam.pitch = 0.35;
    g.cam.dist = 8;
  });
  await shot(page, '06-sleep-in-bed-zzz');

  // 07 Accessories: wings, bag, jewellery (item 3)
  await page.evaluate(() => {
    const g = window.__hv;
    g.sleeping = null;
    g.exitHouse();
  });
  await page.waitForTimeout(300);

  const accessories = [
    ['vinger', '07a-accessory-vinger'],
    ['veske-hjerte', '07b-accessory-veske'],
    ['halskjede', '07c-accessory-halskjede'],
    ['perlekjede', '07d-accessory-perlekjede'],
  ];
  for (const [acc, name] of accessories) {
    await page.evaluate((acc) => {
      const g = window.__hv;
      const av = { ...g.save.avatar, accessory: acc, bottom: 'kjole', shirt: '#ffa6d5' };
      g.commit({ ...g.save, avatar: av }, { avatar: true });
      g.rebuildAvatar?.();
      // force rebuild if method differs
      if (typeof g.setAvatar === 'function') g.setAvatar(av);
      g.player.pos.set(2, 0, 20);
      g.player.yaw = 0.2;
      g.cam.yaw = 0.2 + Math.PI * 0.15;
      g.cam.pitch = 0.2;
      g.cam.dist = 7;
    }, acc);
    // trigger avatar mesh refresh via known path
    await page.evaluate((acc) => {
      const g = window.__hv;
      g.save.avatar.accessory = acc;
      // Many builds expose refresh through commit + sync
      g.commit({ ...g.save, avatar: { ...g.save.avatar, accessory: acc } }, { avatar: true });
    }, acc);
    await page.waitForTimeout(400);
    await shot(page, name);
  }

  // 08 Pet goes around obstacle (item 5) – tree/bush between pet and player
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(-8, 0, 8);
    g.player.yaw = 0;
    // Find a solid circle collider (tree) near plaza
    const circles = g.town.circles || [];
    let tree = circles.find((c) => c.r >= 1.2 && c.r <= 4 && Math.hypot(c.x - (-8), c.z - 8) > 5 && Math.hypot(c.x, c.z) < 55);
    if (!tree) tree = circles.find((c) => c.r >= 1.0) || circles[0];
    const pet = g.equippedPets?.()[0] ?? g.save.pets[0];
    const actor = pet && g.actors.get(pet.uid);
    if (tree && actor) {
      // Put pet on far side of tree from player so path must go around
      const ang = Math.atan2(tree.x - g.player.pos.x, tree.z - g.player.pos.z);
      actor.pos.set(tree.x + Math.sin(ang) * (tree.r + 2.5), 0, tree.z + Math.cos(ang) * (tree.r + 2.5));
      g.player.pos.set(tree.x - Math.sin(ang) * (tree.r + 4), 0, tree.z - Math.cos(ang) * (tree.r + 4));
      g.cam.yaw = ang + Math.PI;
      g.cam.pitch = 0.55;
      g.cam.dist = 14;
      window.__petObstacle = { tree, petUid: pet.uid };
    }
  });
  // let pet AI walk a bit
  await page.waitForTimeout(2500);
  await shot(page, '08-pet-around-obstacle');

  // Cars still
  await page.evaluate(() => {
    const g = window.__hv;
    for (const id of ['bil-rosa', 'bil-gul', 'bil-bla', 'bil-gronn', 'bil-lilla']) g.save.bag[id] = 1;
    g.driving = null;
    if (g.vehicleMesh) {
      g.scene.remove(g.vehicleMesh);
      g.vehicleMesh = null;
    }
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.player.pos.set(8, 0, 22);
    g.player.yaw = 0.35;
    g.cam.yaw = 0.95;
    g.cam.pitch = 0.22;
    g.cam.dist = 8;
  });
  await shot(page, '09-car-rosa-cabin');

  await ctx.close();
}

// ---------- Montage of shop signs ----------
try {
  execSync(`python3 scripts/make-signs-montage.py ${out}`, { stdio: 'inherit' });
} catch (e) {
  console.log('montage skipped', e.message);
}

// ---------- Two-client MP (items 10/12/13) ----------
{
  const A = await boot('MP-A', { viewport: { width: 960, height: 720 } });
  const B = await boot('MP-B', { viewport: { width: 960, height: 720 } });

  async function openMp(page) {
    await page.locator('.dock-btn.mp').click();
    await page.waitForTimeout(500);
  }

  // Host A: villa + locked
  await A.page.evaluate(() => {
    const g = window.__hv;
    const h0 = g.save.houses[0];
    const h = { ...h0, locked: true, style: 'villa' };
    g.commit(
      { ...g.save, bucks: 8000, bag: { ...g.save.bag, 'bil-rosa': 1, 'bil-lilla': 1 }, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id },
      { house: true },
    );
    g.player.pos.set(-5, 0, 6);
  });
  await openMp(A.page);
  await A.page.locator('input.field').first().fill('Ada');
  await A.page.getByRole('button', { name: 'Lag rom' }).click();
  await A.page.waitForTimeout(2000);
  const code = await A.page.evaluate(() => window.__hv.mp?.session?.code ?? '');
  console.log('room code', code);
  if (!code) {
    console.log('MP create failed – skipping MP shots');
  } else {
    // Joiner B: slott unlocked
    await B.page.evaluate(() => {
      const g = window.__hv;
      const h0 = g.save.houses[0];
      const h = { ...h0, locked: false, style: 'slott' };
      g.commit(
        { ...g.save, bucks: 8000, bag: { ...g.save.bag, 'bil-bla': 1 }, houses: g.save.houses.map((x) => (x.id === h.id ? h : x)), activeHouseId: h.id },
        { house: true },
      );
      g.player.pos.set(5, 0, 6);
    });
    await openMp(B.page);
    const inputs = B.page.locator('input.field');
    await inputs.nth(0).fill('Bo');
    // code field is the second input
    await inputs.nth(1).fill(code);
    await B.page.getByRole('button', { name: 'Bli med' }).click();
    await B.page.waitForTimeout(3000);

    const sync = await A.page.evaluate(() => {
      const g = window.__hv;
      const remotes = [...g.mp.session.remotes.values()];
      return {
        remoteCount: remotes.length,
        plots: remotes.map((r) => ({ name: r.name, plot: r.plot, style: r.houseStyle || r.house?.style, locked: !!r.house?.locked })),
        youCode: g.mp.session.code,
      };
    });
    console.log('MP sync', JSON.stringify(sync));

    // 10: overview of neighbourhood with joiner's house on its plot (from host)
    await A.page.evaluate(() => {
      const g = window.__hv;
      const remotes = [...g.mp.session.remotes.values()];
      const joiner = remotes[0];
      const plot = joiner?.plot != null ? g.town.housePlots[joiner.plot] : g.town.housePlots[1];
      g.player.pos.set(plot.x + 18, 0, plot.z + 22);
      g.cam.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z) + Math.PI;
      g.cam.pitch = 0.75;
      g.cam.dist = 42;
    });
    await shot(A.page, '10-mp-joiner-house-on-plot', 900);

    // 12: lock visible on host house from joiner's view
    await B.page.evaluate(() => {
      const g = window.__hv;
      const remotes = [...g.mp.session.remotes.values()];
      const host = remotes[0];
      const plot = host?.plot != null ? g.town.housePlots[host.plot] : null;
      // Host's local home is plot 0 on host; on joiner client host is assigned a plot ≥1
      if (plot) {
        g.player.pos.set(plot.x + Math.sin(0.4) * 14, 0, plot.z + Math.cos(0.4) * 14);
        g.cam.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z) + Math.PI;
        g.cam.pitch = 0.28;
        g.cam.dist = 15;
      }
    });
    await shot(B.page, '12-mp-house-lock', 900);

    // 13: remote car – A drives, B photographs A
    await A.page.evaluate(() => {
      const g = window.__hv;
      // close any sheets
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      g.driving = 'bil-rosa';
      g.syncVehicleMesh();
      g.player.pos.set(4, 0, 16);
      g.player.yaw = 0.5;
      g.cam.yaw = 1.1;
      g.cam.pitch = 0.22;
      g.cam.dist = 8;
    });
    await A.page.waitForTimeout(1200);
    await B.page.evaluate(() => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel').forEach((el) => el.remove());
      const live = [...g.mp.session.tickRemotes()];
      const host = live[0];
      if (host) {
        g.player.pos.set(host.x + 7, 0, host.z + 5);
        g.cam.yaw = Math.atan2(host.x - g.player.pos.x, host.z - g.player.pos.z) + Math.PI;
        g.cam.pitch = 0.18;
        g.cam.dist = 9;
      }
    });
    await shot(B.page, '13-mp-remote-car', 1000);
    await shot(A.page, '13b-mp-local-driving', 400);
  }

  await A.ctx.close();
  await B.ctx.close();
}

await browser.close();
console.log('done');
