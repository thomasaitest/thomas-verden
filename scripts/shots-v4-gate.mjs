import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const url = process.argv[2] ?? 'http://127.0.0.1:4744/';
const out = process.argv[3] ?? '/workspace/thomas-verden-shots/v4';
const concepts = '/workspace/thomas-verden/konsept/v2';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function prep(page) {
  await page.addInitScript(() => {
    const save = {
      version: 1,
      playerId: 'player-shot',
      bucks: 2480,
      avatar: {
        skin: '#f0c7a0', hair: '#3b2a1e', hairColor: '#3b2a1e', shirt: '#2a9a8a', pants: '#4a5568', shoes: '#1a1a22',
        hairStyle: 'kort', face: 'smil', top: 'hettegenser', bottom: 'bukse', shoe: 'sneakers',
        accessory: 'ryggsekk', hat: 'ingen', print: 'hjerte',
      },
      avatarDone: true,
      pets: [{
        uid: 'pet1', speciesId: 'hund', name: 'Byte', flyable: false, rideable: false, obtainedAt: Date.now() - 60000, xp: 80,
      }],
      equipped: ['pet1'],
      inventory: { sofa: 1, ball: 1, tv: 1, salongbord: 1, benk: 1, bokhylle: 1, langsofa: 1 },
      bag: { eple: 2, vann: 2, 'bil-bla': 1, 'leke-ball': 1 },
      houses: [],
      activeHouseId: '',
      stats: { tasks: 0, hatched: 1, doorWins: 0 },
      sound: false,
      starterClaimed: true,
      toysGiven: true,
    };
    localStorage.setItem('thomasverden-save-v1', JSON.stringify(save));
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const g = window.__hv;
    g.rebuildAvatar?.();
    await new Promise((r) => setTimeout(r, 3200));
    // force clear sunny day + HQ shadows
    g.setWeatherElapsed?.(100); // clear day slot
    if (!g.highQuality) g.toggleQuality();
    // max sun contrast
    if (g.sun) {
      g.sun.intensity = 2.1;
      g.sun.color.set('#ffd09a');
      g.sun.castShadow = true;
    }
    if (g.hemi) g.hemi.intensity = 0.45;
    document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
    g.paused = false;
    g.syncPets?.();
  });
}

const shot = async (page, name, wait = 900) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
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

// 01 plaza — look at Solvind + Nordic + fountain
await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  if (g.mode === 'house') g.exitHouse();
  if (g.driving) g.toggleDrive();
  g.player.pos.set(0, 0, -6);
  g.player.yaw = 0;
  // wide plaza overview from south looking north at Solvind/Nordic/Hav fronts
  g.freezeCam = { x: -10, y: 6.5, z: -12, lx: 2, ly: 3.5, lz: 14 };
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(page, '01-gate-plaza', 2800);

// 02 car: drive on open ring road west of plaza, cam behind vehicle looking past hover-cars
await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  const bag = { ...g.save.bag };
  for (const k of Object.keys(bag)) if (k.startsWith('bil-')) delete bag[k];
  bag['bil-bla'] = 1;
  g.commit({ ...g.save, bag });
  if (g.driving) g.toggleDrive();
  g.player.pos.set(12, 0, 10);
  g.player.yaw = -0.4;
  g.toggleDrive();
});
await page.waitForTimeout(2800);
await page.evaluate(() => {
  const g = window.__hv;
  if (!g.driving) g.toggleDrive();
  g.player.pos.set(11, 0, 9);
  g.player.yaw = -0.5;
  if (g.vehicleMesh) {
    g.vehicleMesh.position.set(11, 0, 9);
    g.vehicleMesh.rotation.y = -0.5;
  }
  // behind car looking toward plaza façades + parked cars
  g.freezeCam = { x: 14, y: 2.8, z: 16, lx: 2, ly: 1.3, lz: 2 };
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(page, '02-car-street', 2200);

// 03 house exterior
await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  if (g.driving) g.toggleDrive();
  const e = g.town.entrances.home;
  g.player.pos.set(e.x, 0, e.z);
  g.player.yaw = e.yaw + Math.PI;
  g.freezeCam = { x: e.x + 10, y: 6.0, z: e.z + 16, lx: e.x, ly: 4.0, lz: e.z - 2 };
});
await shot(page, '03-house-exterior', 1400);

// 04 interior — elevated corner looking at living room + panoramic back wall
await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  g.enterHouse();
  // place player mid living room
  const w = g.interior.w / 2;
  const d = g.interior.d / 2;
  g.player.pos.set(0.5, 0, d - 3.5);
  g.player.yaw = Math.PI;
  // elevated corner looking into living room toward panoramic back wall
  g.freezeCam = { x: w - 2.2, y: 2.8, z: d - 2.5, lx: -2.5, ly: 1.4, lz: -d + 2.5 };
  // hide avatar holder so room reads clearly
  if (g.avatarHolder) g.avatarHolder.visible = false;
  // hide lock prompt noise
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(page, '04-house-interior', 2800);

// 05 pets close-up near plaza
await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  if (g.mode === 'house') g.exitHouse();
  g.player.pos.set(1, 0, 8);
  g.player.yaw = 0;
  g.syncPets?.();
  g.freezeCam = { x: 5, y: 2.4, z: 12, lx: 0, ly: 0.7, lz: 7 };
});
await shot(page, '05-pets', 1400);

await browser.close();

const browser2 = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const iphone = await browser2.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p2 = await iphone.newPage();
await prep(p2);
await p2.evaluate(() => {
  const g = window.__hv;
  g.player.pos.set(0, 0, -6);
  g.player.yaw = 0;
  g.freezeCam = { x: -6, y: 5.0, z: -8, lx: 2, ly: 3.0, lz: 12 };
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(p2, '06-iphone-plaza', 1400);
await browser2.close();

compare('01-gate-plaza', '1-gate.jpg', 'compare-gate');
compare('04-house-interior', '2-hus-inne.jpg', 'compare-interior');
compare('02-car-street', '4-bil.jpg', 'compare-car');
console.log('done', out);
