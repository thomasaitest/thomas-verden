import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4742/';
const out = process.argv[3] ?? '/workspace/thomas-verden-shots/v2';
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
        skin: '#f0c7a0', hair: '#3b2a1e', shirt: '#3a6fd8', pants: '#2b2b38', shoes: '#1a1a22',
        hairStyle: 'kort', face: 'smil', top: 'hettegenser', bottom: 'bukse', shoe: 'sneakers', accessory: 'ryggsekk',
      },
      avatarDone: true,
      pets: [{
        uid: 'pet1', speciesId: 'katt', name: 'Mjaur', bornAt: Date.now() - 60000,
        needs: { mat: 0.8, drikke: 0.8, soving: 0.8, hygiene: 0.8, kos: 0.8, lek: 0.8, helse: 1 },
        traits: {}, eggId: null, color: '#c98a55',
      }],
      equipped: ['pet1'],
      inventory: { sofa: 1, ball: 1, seng: 1, salongbord: 1 },
      bag: { eple: 2, vann: 2, 'bil-lilla': 1, 'leke-ball': 1 },
      houses: [],
      activeHouseId: '',
      stats: { tasks: 0, hatched: 1, doorWins: 0 },
      sound: false,
      starterClaimed: true,
      toysGiven: true,
    };
    // house filled by parseSave if empty — leave empty to get fresh house
    localStorage.setItem('thomasverden-save-v1', JSON.stringify(save));
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 120000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const g = window.__hv;
    g.weatherT0 = performance.now() / 1000 - 120;
    document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
    g.paused = false;
    // keep LQ for readable SwiftShader shots (no bloom wash)
    // seed robot dog equipped for plaza vibes
    if (g.save.pets && !g.save.pets.some(p => p.speciesId === 'robothund')) {
      const robot = {
        uid: 'robo1', speciesId: 'robothund', name: 'Byte', bornAt: Date.now() - 60000,
        needs: { mat: 0.9, drikke: 0.9, soving: 0.9, hygiene: 0.9, kos: 0.9, lek: 0.9, helse: 1 },
        traits: {}, eggId: null, color: '#d8e0e8',
      };
      g.commit({ ...g.save, pets: [...g.save.pets, robot], equipped: [...(g.save.equipped || []), 'robo1'] }, { pets: true });
    }
  });
}

const shot = async (page, name, wait = 850) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await prep(page);

await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  if (g.mode === 'house') g.exitHouse();
  // look toward shop row from plaza edge (concept: fountain + shops + cars)
  g.player.pos.set(8, 0, 6);
  g.player.yaw = -0.6;
  g.freezeCam = { x: 2, y: 2.8, z: 12, lx: 18, ly: 2.2, lz: -18 };
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(page, '01-gate-plaza', 1200);

await page.evaluate(() => {
  const g = window.__hv;
  g.player.pos.set(30, 0, 2);
  g.player.yaw = -Math.PI / 2;
  g.freezeCam = { x: 22, y: 3.4, z: 6, lx: 8, ly: 1.4, lz: 0 };
});
await shot(page, '02-street-roads', 1000);

await page.evaluate(() => {
  const g = window.__hv;
  const e = g.town.entrances.home;
  g.player.pos.set(e.x, 0, e.z);
  g.player.yaw = e.yaw + Math.PI;
  g.freezeCam = { x: e.x + 6, y: 3.6, z: e.z + 9, lx: e.x, ly: 2.2, lz: e.z - 1 };
});
await shot(page, '03-house-exterior', 1000);

await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  // ensure some furniture for the shot
  const h = g.save.houses.find((x) => x.id === g.save.activeHouseId) || g.save.houses[0];
  if (h && (!h.items || h.items.length < 2)) {
    const items = [
      { uid: 'sofa1', id: 'sofa', x: 0, z: -1.5, yaw: 0, floor: 0 },
      { uid: 'table1', id: 'salongbord', x: 0, z: 0.4, yaw: 0, floor: 0 },
      { uid: 'tv1', id: 'tv', x: 0, z: -3.2, yaw: 0, floor: 0 },
      { uid: 'bed1', id: 'seng', x: 4.5, z: -2.5, yaw: 0, floor: 0 },
      { uid: 'cnt1', id: 'benk', x: -4.2, z: 1.5, yaw: 0, floor: 0 },
    ];
    g.commit({ ...g.save, houses: g.save.houses.map((hh) => hh.id === h.id ? { ...hh, items } : hh) });
  }
  g.enterHouse();
  g.interior.syncItems?.(g.save.houses.find((x) => x.id === g.save.activeHouseId) || g.save.houses[0]);
  const door = g.interior.door;
  g.player.pos.set(0, 0, door.z - 4);
  g.player.yaw = Math.PI;
  g.freezeCam = { x: 2.5, y: 2.4, z: 5.5, lx: 0, ly: 1.0, lz: -1.2 };
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(page, '04-house-interior', 1300);

await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = null;
  if (g.mode === 'house') g.exitHouse();
  document.querySelectorAll('.sheet,.sheet-wrap').forEach((el) => el.remove());
  g.panels.openAvatar();
});
await page.waitForTimeout(500);
await shot(page, '05-avatar-editor', 700);
await page.evaluate(() => document.querySelectorAll('.sheet,.sheet-wrap').forEach((el) => el.remove()));

await page.evaluate(() => {
  const g = window.__hv;
  const bag = { ...g.save.bag };
  for (const k of Object.keys(bag)) if (k.startsWith('bil-')) delete bag[k];
  bag['bil-bla'] = 1;
  g.commit({ ...g.save, bag });
  if (g.driving) g.toggleDrive();
  g.player.pos.set(6, 0, -22);
  g.player.yaw = 0.15;
  g.toggleDrive();
  // behind the car, slightly elevated — avoid looking into canopy glass
  g.freezeCam = { x: 9.5, y: 3.8, z: -32, lx: 6, ly: 0.9, lz: -18 };
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(page, '06-car-driving', 1200);

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
  g.player.pos.set(0, 0, 16);
  g.player.yaw = Math.PI;
  g.freezeCam = { x: 3.5, y: 2.8, z: 12, lx: 0, ly: 1.4, lz: 1 };
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
});
await shot(p2, '07-iphone-plaza', 1000);
await browser2.close();
console.log('done →', out);
