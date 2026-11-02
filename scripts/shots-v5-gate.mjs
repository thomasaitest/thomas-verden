import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const url = process.argv[2] ?? 'http://127.0.0.1:4750/';
const out = process.argv[3] ?? '/workspace/thomas-verden-shots/v5';
const concepts = '/workspace/thomas-verden/konsept/v2';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function prep(page) {
  await page.addInitScript(() => {
    const now = Date.now();
    const house = {
      id: 'house-shot',
      style: 'moderne',
      ownerId: 'player-shot',
      editors: [],
      editRequests: [],
      wallColor: '#4e555e',
      floorColor: '#5a626c',
      locked: false,
      createdAt: now,
      items: [
        // Pod only in left-back alcove (peeked through doorway) — living sofa is interior vignette
        { uid: 'it1', itemId: 'seng', x: 1.85, z: -4.4, rot: 0, scale: 0.82, color: '#c8e4ff', floor: 0 },
        // Kitchen dining (not living) so ensureStarterFurniture won't drop a table in the bay
        { uid: 'it2', itemId: 'spisebord', x: 5.2, z: 0.4, rot: 0, scale: 0.9, color: '#2a3344', floor: 0 },
      ],
    };
    const save = {
      version: 1,
      playerId: 'player-shot',
      bucks: 2480,
      avatar: {
        skin: '#f3c9a4',
        hair: 'kort',
        hairColor: '#2b2118',
        face: 'smil',
        shirt: '#2a6fd8',
        print: 'lyn',
        pants: '#1a2230',
        bottom: 'bukse',
        shoes: '#c8d0d8',
        shoeStyle: 'sneakers',
        hat: 'ingen',
        accessory: 'ingen',
      },
      avatarDone: true,
      pets: [{ uid: 'pet1', speciesId: 'hund', name: 'Byte', flyable: false, rideable: false, obtainedAt: now - 60000, xp: 80 }],
      equipped: [],
      inventory: { sofa: 1, ball: 1, tv: 1, salongbord: 1, benk: 1, bokhylle: 1, langsofa: 1 },
      bag: { eple: 2, vann: 2, 'bil-bla': 1, 'leke-ball': 1 },
      houses: [house],
      activeHouseId: 'house-shot',
      stats: { tasks: 0, hatched: 1, doorWins: 0 },
      sound: false,
      starterClaimed: true,
      toysGiven: true,
    };
    localStorage.setItem('thomasverden-save-v1', JSON.stringify(save));
  });
  // Bust PWA SW so preview always serves the just-built JS/assets
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
      await Promise.all(regs.map((r) => r.unregister()));
      if (window.caches?.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 120000 });
  await page.evaluate(async () => {
    const g = window.__hv;
    await g.assetsReady;
    // ez-tree + Quaternius NPC walkers settle
    await new Promise((r) => setTimeout(r, 2800));
    g.rebuildAvatar?.();
    if (!g.highQuality) g.toggleQuality();
    g.lighting?.setExposure?.(0.58);
    // slot 2 = clear (see weatherAt); freeze near midday clear
    g.setWeatherElapsed?.(100);
    g.weatherLocked = 'clear';
    g.editingAvatar = false;
    g.paused = false;
    document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
    g.hud?.setWhere?.('Dag · Sol');
    document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
    g.syncPets?.();
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const g = window.__hv;
    g.editingAvatar = false;
    document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
    // pets off for clean plaza framing
    g.commit?.({ ...g.save, equipped: [] });
    g.syncPets?.();
  });
}


const cleanHud = (g) => {
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal,.prompt').forEach((el) => el.remove());
  g.hud?.prompt && (g.hud.prompt.style.display = 'none');
  // hide 3D need bubbles on pets/actors
  try {
    for (const a of g.actors?.values?.() ?? []) {
      if (a.bubble) a.bubble.visible = false;
      if (a.rig?.root) { /* keep */ }
    }
    g.town?.group?.traverse?.((o) => {
      if (o.isSprite) o.visible = false;
    });
    g.scene?.traverse?.((o) => {
      if (o.isSprite && o !== g.sleepZzz) o.visible = false;
    });
  } catch {}
};

const shot = async (page, name, wait = 1000) => {
  await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal,.prompt').forEach((el) => el.remove());
    if (g.hud?.prompt) g.hud.prompt.style.display = 'none';
    try {
      for (const a of g.actors?.values?.() ?? []) if (a.bubble) a.bubble.visible = false;
      g.scene?.traverse?.((o) => { if (o.isSprite) o.visible = false; });
    } catch {}
  });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 180000, animations: 'disabled' });
  console.log('saved', name);
};

function compare(shotName, conceptFile, outName) {
  const a = `${out}/${shotName}.png`;
  const b = `${concepts}/${conceptFile}`;
  const dest = `${out}/${outName}.png`;
  try {
    execSync(`python3 /workspace/thomas-verden/scripts/compare-pair.py "${b}" "${a}" "${dest}"`, { stdio: 'inherit' });
  } catch (e) {
    console.log('compare failed', outName, e.message);
  }
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await prep(page);

// Gate plaza — concept-like: behind avatar looking into plaza (fountain + façades)
await page.evaluate(async () => {
  const g = window.__hv;
  g.freezeCam = null;
  if (g.mode === 'house') g.exitHouse();
  if (g.driving) g.toggleDrive();
  g.clearVehicle?.();
  g.commit?.({ ...g.save, equipped: [] });
  g.syncPets?.();
  // Stand on south approach facing fountain — DEFAULT third-person cam
  // From south of plaza face +Z (fountain). three.js yaw 0 = -Z, so use PI.
  g.clearVehicle?.();
  g.player.pos.set(0.5, 0, -7.5);
  g.player.yaw = Math.PI;
  g.cam.yaw = Math.PI;
  g.cam.pitch = 0.145;
  g.cam.dist = 7.2;
  g.camShown = 7.2;
  g.rebuildAvatar?.();
  // Hide player vehicle + any ambient cars that still read as "on plaza" in this framing
  if (g.vehicleMesh) g.vehicleMesh.visible = false;
  g.town?.group?.traverse?.((o) => {
    if (!o.name) return;
    if (o.name.startsWith('traffic-') || o.name.startsWith('parked-')) {
      const x = o.position.x, z = o.position.z;
      if (Math.hypot(x, z) < 22) o.visible = false;
    }
  });
  await new Promise((r) => setTimeout(r, 2800));
  if (g.avatarHolder) g.avatarHolder.visible = true;
  for (const a of g.actors.values()) { a.rig.root.visible = false; a.shadow.visible = false; }
  g.editingAvatar = false;
  g.hud?.setWhere?.('Dag · Sol');
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
});
await shot(page, '01-gate-plaza', 2200);

// Car chase — DEFAULT gameplay chase cam (no freezeCam, real scene)
await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  g.editingAvatar = false;
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
  const bag = { ...g.save.bag };
  for (const k of Object.keys(bag)) if (k.startsWith('bil-')) delete bag[k];
  bag['bil-bla'] = 1;
  g.commit({ ...g.save, bag });
  if (g.driving) g.toggleDrive();
  // Open N–S road stretch: face plaza (−Z). Traffic kept off z∈[25,45] ahead.
  g.player.pos.set(0, 0, 36);
  g.player.yaw = 0;
  g.toggleDrive();
});
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  g.editingAvatar = false;
  if (!g.driving) g.toggleDrive();
  g.player.pos.set(0, 0, 36);
  g.player.yaw = 0;
  g.cam.yaw = 0.12;
  g.cam.pitch = 0.145;
  g.cam.dist = 12.0;
  g.camShown = 12.0;
  if (g.vehicleMesh) {
    g.vehicleMesh.position.set(0, 0, 36);
    g.vehicleMesh.rotation.y = 0;
  }
  g.hud?.setWhere?.('Dag · Sol');
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
});
await shot(page, '02-car-street', 2200);

// Interior — DEFAULT enterHouse cam + walk into living (no freezeCam)
await page.evaluate(async () => {
  const g = window.__hv;
  g.freezeCam = null;
  g.editingAvatar = false;
  if (g.driving) g.toggleDrive();
  g.commit?.({ ...g.save, equipped: [] });
  g.syncPets?.();
  g.enterHouse(); // gameplay default interior cam facing window
  g.lighting?.setExposure?.(0.28);
  g.lighting?.setIndoor?.(true);
  if (g.sun) g.sun.intensity = 0.12;
  for (const a of g.actors.values()) { a.rig.root.visible = false; a.shadow.visible = false; }
  // Default enterHouse framing: sofa L-C, window C, kitchen R, pod doorway far R
  g.player.pos.set(-1.15, 0, 2.2);
  g.player.yaw = Math.PI; // face window; cam behind shows back (left third)
  g.cam.yaw = 0.08;
  g.cam.pitch = 0.06;
  g.cam.dist = 3.2;
  g.camShown = 3.2;
  if (g.avatarHolder) g.avatarHolder.visible = true;
  await new Promise((r) => setTimeout(r, 600));
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
});
await shot(page, '03-house-interior', 2200);

// Avatar editor — in-game Avatar button / openAvatar at default Neon Tech state
await page.evaluate(async () => {
  const g = window.__hv;
  g.freezeCam = null;
  if (g.mode === 'house') g.exitHouse();
  if (g.driving) g.toggleDrive();
  g.clearVehicle?.();
  // Park any leftover player vehicle well off plaza (south road)
  if (g.vehicleMesh) {
    g.vehicleMesh.position.set(1.7, 0, -28);
    g.vehicleMesh.visible = false;
  }
  // Neon Tech look — matches concept 3-figurer default stylish char
  g.commit?.({
    ...g.save,
    equipped: [],
    avatar: {
      ...g.save.avatar,
      skin: '#f3c9a4',
      shirt: '#2a6fd8',
      print: 'lyn',
      pants: '#1a2230',
      bottom: 'bukse',
      shoes: '#c8d0d8',
      shoeStyle: 'sneakers',
      accessory: 'sekk-stjerne',
      hat: 'ingen',
      hair: 'kort',
      hairColor: '#2b2118',
      face: 'smil',
    },
  });
  g.rebuildAvatar?.();
  // Stand on plaza approach first so studio pose restore is sane; editor teleports to studio
  g.player.pos.set(0.4, 0, -18);
  g.player.yaw = Math.PI;
  for (const a of g.actors.values()) { a.rig.root.visible = false; a.shadow.visible = false; }
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
  // Open real avatar editor sheet (Klær / Hår / Tilbehør + FERDIG)
  g.panels?.openAvatar?.() || g.openAvatar?.();
  await new Promise((r) => setTimeout(r, 3200));
  if (g.avatarHolder) g.avatarHolder.visible = true;
  // Hide dock/HUD chrome for concept-like framing
  document.querySelectorAll('.dock,.hud-top,.joy-base,.jump,.pet-bar,.prompt,.tasks,.speedo').forEach((el) => {
    el.style.visibility = 'hidden';
  });
});
// Keep the avatar-edit sheet (shot() strips .sheet-wrap by default)
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const g = window.__hv;
  // Strip only non-avatar chrome
  document.querySelectorAll('.toast,.modal,.prompt').forEach((el) => el.remove());
  document.querySelectorAll('.dock,.hud-top,.joy-base,.jump,.pet-bar,.tasks,.speedo').forEach((el) => {
    el.style.visibility = 'hidden';
  });
  // Ensure sheet is present
  if (!document.querySelector('.sheet-wrap.avatar-edit')) {
    g.panels?.openAvatar?.();
  }
});
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/04-avatar.png`, timeout: 180000, animations: 'disabled' });
console.log('saved', '04-avatar');

await browser.close();

const browser2 = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const iphone = await browser2.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const p2 = await iphone.newPage();
await prep(p2);
await p2.evaluate(() => {
  const g = window.__hv;
  if (g.highQuality) g.toggleQuality(); // LQ for iPhone
  g.freezeCam = null;
  g.player.pos.set(0.4, 0, -9);
  g.player.yaw = Math.PI;
  g.cam.yaw = Math.PI;
  g.cam.pitch = 0.2;
  g.cam.dist = 9;
  g.camShown = 9;
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(p2, '05-iphone-plaza', 1600);
await browser2.close();

compare('01-gate-plaza', '1-gate.jpg', 'compare-gate');
compare('03-house-interior', '2-hus-inne.jpg', 'compare-interior');
compare('02-car-street', '4-bil.jpg', 'compare-car');
compare('04-avatar', '3-figurer.jpg', 'compare-avatar');
console.log('done', out);
