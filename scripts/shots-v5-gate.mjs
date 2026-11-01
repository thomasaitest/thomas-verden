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
      wallColor: '#c5ccd4',
      floorColor: '#8a929c',
      locked: false,
      createdAt: now,
      items: [
        { uid: 'it1', itemId: 'seng', x: 8.2, z: -5.5, rot: 1.57, scale: 1, color: '#e8eef6', floor: 0 },
        { uid: 'it3', itemId: 'langsofa', x: -2.8, z: 0.2, rot: 0.35, scale: 1.4, color: '#d8dde4', floor: 0 },
        { uid: 'it9', itemId: 'rundtteppe', x: -2.2, z: 1.0, rot: 0, scale: 1.7, color: '#3a4450', floor: 0 },
        { uid: 'it11', itemId: 'salongbord', x: -1.6, z: 2.2, rot: 0.2, scale: 1.15, color: '#c8d0d8', floor: 0 },
        { uid: 'it7', itemId: 'benk', x: 3.2, z: -1.5, rot: 0, scale: 1.4, color: '#1a2230', floor: 0 },
        { uid: 'it8', itemId: 'krakk', x: 2.4, z: -0.5, rot: 0, scale: 1, color: '#1a2230', floor: 0 },
        { uid: 'it8b', itemId: 'krakk', x: 4.0, z: -0.5, rot: 0, scale: 1, color: '#1a2230', floor: 0 },
        { uid: 'it10', itemId: 'potteplante', x: 5.5, z: -5.5, rot: 0, scale: 1.15, color: '#5cc36b', floor: 0 },
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
        accessory: 'sekk-stjerne',
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
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 120000 });
  await page.evaluate(async () => {
    const g = window.__hv;
    await g.assetsReady;
    g.rebuildAvatar?.();
    if (!g.highQuality) g.toggleQuality();
    g.lighting?.setExposure?.(0.58);
    // slot 2 = clear (see weatherAt); freeze near midday clear
    g.setWeatherElapsed?.(100);
    g.weatherLocked = 'clear';
    g.editingAvatar = false;
    g.paused = false;
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
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 90000, animations: 'disabled' });
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
  g.commit?.({ ...g.save, equipped: [] });
  g.syncPets?.();
  // Stand on south approach facing fountain — DEFAULT third-person cam
  // From south of plaza face +Z (fountain). three.js yaw 0 = -Z, so use PI.
  g.player.pos.set(0.5, 0, -7.5);
  g.player.yaw = Math.PI;
  g.cam.yaw = Math.PI;
  g.cam.pitch = 0.4;
  g.cam.dist = 14;
  g.camShown = 14;
  g.rebuildAvatar?.();
  await new Promise((r) => setTimeout(r, 2800));
  if (g.avatarHolder) g.avatarHolder.visible = true;
  for (const a of g.actors.values()) { a.rig.root.visible = false; a.shadow.visible = false; }
  g.editingAvatar = false;
  g.hud?.setWhere?.('Dag · Sol');
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
});
await shot(page, '01-gate-plaza', 2200);

// Car chase framing — on approach road looking toward plaza, car in lower center
await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  const bag = { ...g.save.bag };
  for (const k of Object.keys(bag)) if (k.startsWith('bil-')) delete bag[k];
  bag['bil-bla'] = 1;
  g.commit({ ...g.save, bag });
  if (g.driving) g.toggleDrive();
  // yaw 0 faces -Z (plaza); yaw PI faces +Z (was hitting Dørspillet)
  g.player.pos.set(0, 0, 28);
  g.player.yaw = 0;
  g.toggleDrive();
});
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const g = window.__hv;
  if (!g.driving) g.toggleDrive();
  g.player.pos.set(0, 0, 28);
  g.player.yaw = 0;
  g.cam.yaw = 0;
  g.cam.pitch = 0.24;
  g.cam.dist = 10.5;
  g.camShown = 10.5;
  if (g.vehicleMesh) {
    g.vehicleMesh.position.set(0, 0, 28);
    g.vehicleMesh.rotation.y = 0;
  }
  g.hud?.setWhere?.('Dag · Sol');
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
});
await shot(page, '02-car-street', 2200);

// Interior — eye-level dollhouse-ish but concept-like living view
await page.evaluate(async () => {
  const g = window.__hv;
  g.freezeCam = null;
  if (g.driving) g.toggleDrive();
  g.commit?.({ ...g.save, equipped: [] });
  g.syncPets?.();
  g.enterHouse(); // sets default interior cam
  for (const a of g.actors.values()) { a.rig.root.visible = false; a.shadow.visible = false; }
  // Walk into living — sofa left, island mid, holo+skyline ahead
  // Door at +Z; back wall / holo / skyline at -Z — face yaw 0
  g.player.pos.set(2.5, 0, 2.8);
  g.player.yaw = -0.35;
  g.cam.yaw = -0.35;
  g.cam.pitch = 0.34;
  g.cam.dist = 7.8;
  if (g.avatarHolder) g.avatarHolder.visible = true;
  await new Promise((r) => setTimeout(r, 800));
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
});
await shot(page, '03-house-interior', 2200);

// Avatar framing outdoors — human in foreground, plaza behind
await page.evaluate(async () => {
  const g = window.__hv;
  g.freezeCam = null;
  if (g.mode === 'house') g.exitHouse();
  // Neon Tech look for avatar compare
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
    },
  });
  g.rebuildAvatar?.();
  g.player.pos.set(0.4, 0, -5.5);
  g.player.yaw = Math.PI;
  g.cam.yaw = Math.PI + 0.45;
  g.cam.pitch = 0.28;
  g.cam.dist = 6.8;
  g.camShown = 6.8;
  await new Promise((r) => setTimeout(r, 3500));
  if (g.avatarHolder) g.avatarHolder.visible = true;
  g.editingAvatar = false;
  g.hud?.setWhere?.('Dag · Sol');
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.modal').forEach((el) => el.remove());
});
await shot(page, '04-avatar', 2000);

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
  g.cam.pitch = 0.42;
  g.cam.dist = 16;
  g.camShown = 16;
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(p2, '05-iphone-plaza', 1600);
await browser2.close();

compare('01-gate-plaza', '1-gate.jpg', 'compare-gate');
compare('03-house-interior', '2-hus-inne.jpg', 'compare-interior');
compare('02-car-street', '4-bil.jpg', 'compare-car');
compare('04-avatar', '3-figurer.jpg', 'compare-avatar');
console.log('done', out);
