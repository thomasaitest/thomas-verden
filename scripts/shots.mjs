// Takes screenshots of the game with headless Chrome. Usage: node scripts/shots.mjs [url] [outPrefix]
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:4740/';
const out = process.argv[3] ?? '/workspace/hv-';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, hasTouch: true });
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__hv, null, { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('saved', `${out}${name}.png`);
};
await wait(2500);
// avatar creator: pick a few looks
await page.getByRole('button', { name: '💇 Hår' }).click();
await page.getByRole('button', { name: 'Musefletter' }).click();
await page.getByRole('button', { name: '👑 Hatt' }).click();
await page.getByRole('button', { name: 'Kaninører' }).click();
await page.getByRole('button', { name: '💇 Hår' }).click();
await wait(1200);
await shot('avatar');
await page.getByRole('button', { name: 'Ferdig ✓' }).click();
await wait(500);
// make the starter a fixed nice pet for screenshots
await page.evaluate(() => {
  let s = 0.37;
  window.__hv.rng = () => {
    s = (s * 9301 + 0.49297) % 1;
    return s;
  };
});
await page.getByRole('button', { name: 'Klekk egget! 🐣' }).click();
await wait(2600);
await shot('hatch');
await page.getByRole('button', { name: 'Hurra! 🎉' }).click();
await wait(300);
// give a second, rarer pet so the town shows more
await page.evaluate(() => {
  const g = window.__hv;
  g.rng = Math.random;
  g.commit({ ...g.save, bucks: 5000 });
});
await wait(2500);
await shot('town');

// vet: make a pet sick and stand on the vet pad
await page.evaluate(() => {
  const g = window.__hv;
  const uid = g.save.equipped[0];
  g.commit({ ...g.save, pets: g.save.pets.map((p) => (p.uid === uid ? { ...p, need: { kind: 'syk', since: Date.now(), progress: 0 } } : p)) });
  g.teleport('vet');
});
await wait(1500);
await page.evaluate(() => {
  const g = window.__hv;
  const z = g.town.zones.find((z) => z.kind === 'vet');
  g.player.pos.set(z.x + 1.5, 0, z.z + 1.5);
});
await wait(2200);
await shot('vet');

// shop
await page.evaluate(() => {
  const g = window.__hv;
  const uid = g.save.equipped[0];
  g.commit({ ...g.save, pets: g.save.pets.map((p) => (p.uid === uid ? { ...p, need: { kind: 'sulten', since: Date.now(), progress: 0 } } : p)) });
  g.teleport('shop');
});
await wait(1800);
await shot('shop-outside');
await page.getByRole('button', { name: 'Handle mat 🛒' }).click({ force: true });
await wait(600);
await shot('shop');
await page.locator('.sheet .btn.close').click();

// house with furniture
await page.evaluate(() => {
  const g = window.__hv;
  g.teleport('home');
  g.enterHouse();
});
await wait(500);
await page.evaluate(() => {
  const g = window.__hv;
  g.debugFurnish();
  const uid = g.save.equipped[0];
  g.commit({ ...g.save, pets: g.save.pets.map((p) => (p.uid === uid ? { ...p, need: { kind: 'trott', since: Date.now(), progress: 0 } } : p)) });
  g.player.pos.set(-1.5, 0, -1.5);
  g.player.yaw = Math.PI;
});
await wait(3000);
await shot('house');
await page.getByRole('button', { name: /Bygg/ }).click();
await wait(800);
await page.getByRole('button', { name: '🛋️ Stue' }).click();
await wait(1500);
await page.evaluate(() => {
  const g = window.__hv;
  const h = g.save.houses.find((x) => x.id === g.save.activeHouseId);
  g.selectItem(h.items.find((i) => i.itemId === 'sofa')?.uid ?? h.items[0].uid);
});
await wait(1000);
await shot('build');
await page.locator('.sheet .btn.close').click();

// door minigame
await page.evaluate(() => window.__hv.teleport('doors'));
await wait(1500);
await page.getByRole('button', { name: 'Spill Dørspillet 🚪' }).click({ force: true });
await wait(600);
await shot('doors');

await page.locator('.sheet .btn.close').click();
// ride and fly
await page.evaluate(() => {
  const g = window.__hv;
  const uid = g.save.equipped[0];
  g.commit({ ...g.save, pets: g.save.pets.map((p) => (p.uid === uid ? { ...p, rideable: true, flyable: true, need: null } : p)) }, { pets: true });
  g.teleport('play');
  g.toggleRide();
});
await page.keyboard.down('KeyW');
await wait(900);
await page.keyboard.up('KeyW');
await wait(300);
await shot('ride');
await page.evaluate(() => window.__hv.toggleFly());
await page.keyboard.down('Space');
await page.keyboard.down('KeyW');
await wait(1600);
await page.keyboard.up('KeyW');
await page.keyboard.up('Space');
await wait(200);
await shot('fly');

const perf = await page.evaluate(() => ({ calls: window.__hv.renderer.info.render.calls, tris: window.__hv.renderer.info.render.triangles }));
console.log('render info', JSON.stringify(perf));
console.log(logs.filter((l) => !l.includes('GPU stall')).slice(0, 30).join('\n'));
await browser.close();
