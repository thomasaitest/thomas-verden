// Two-client multiplayer e2e. Needs vite on :4740 and wrangler on :8787.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/workspace/heddas-mockups/mp';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function bootFixed(label, x) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(label, 'PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) {
    await ferdig.click();
    await page.waitForTimeout(400);
    const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
    if (await klekk.count()) {
      await klekk.click();
      await page.waitForTimeout(2600);
      const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
      if (await hurra.count()) await hurra.click();
      await page.waitForTimeout(500);
    }
  }
  await page.evaluate((spawnX) => {
    const g = window.__hv;
    if (g.save.pets[0] && g.save.equipped.length === 0) {
      g.commit({ ...g.save, equipped: [g.save.pets[0].uid] }, { pets: true });
    }
    g.player.pos.set(spawnX, 0, 0);
    g.player.yaw = spawnX < 0 ? Math.PI / 2 : -Math.PI / 2;
  }, x);
  return { page, ctx, label };
}

const A = await bootFixed('A', -6);
const B = await bootFixed('B', 6);

await A.page.locator('.dock-btn.mp').click();
await A.page.waitForTimeout(300);
await A.page.screenshot({ path: `${out}/join-dialog.png` });
console.log('saved join-dialog');

await A.page.locator('input.field').first().fill('Ada');
await A.page.getByRole('button', { name: 'Lag rom' }).click();
await A.page.waitForTimeout(1000);

const code = (await A.page.locator('.mp-code').innerText()).trim();
console.log('room code', code);
await A.page.screenshot({ path: `${out}/room-created.png` });
await A.page.locator('.btn.close').click();
await A.page.waitForTimeout(200);

await B.page.locator('.dock-btn.mp').click();
await B.page.waitForTimeout(300);
await B.page.locator('input.field').first().fill('Bo');
await B.page.locator('input.field.mono').fill(code);
await B.page.getByRole('button', { name: 'Bli med' }).click();
await B.page.waitForTimeout(1500);
if (await B.page.locator('.btn.close').count()) await B.page.locator('.btn.close').click();

await A.page.waitForFunction(() => window.__hv.mp?.session.remotes.size >= 1, null, { timeout: 10000 });
await B.page.waitForFunction(() => window.__hv.mp?.session.remotes.size >= 1, null, { timeout: 10000 });
console.log('both see each other');

for (let i = 0; i < 40; i++) {
  await A.page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.x += 0.35;
    g.player.speed = 1;
  });
  await A.page.waitForTimeout(40);
}
await A.page.waitForTimeout(600);

await A.page.locator('.dock-btn.emote').click();
await A.page.waitForTimeout(250);
await A.page.getByRole('button', { name: /Hei!/ }).click();
await A.page.waitForTimeout(800);

await A.page.screenshot({ path: `${out}/client-a.png` });
await B.page.screenshot({ path: `${out}/client-b.png` });
await B.page.screenshot({ path: `${out}/emoji-bubble.png` });
console.log('saved client + emoji shots');

execFileSync('python3', ['-c', `
from PIL import Image
a = Image.open('${out}/client-a.png')
b = Image.open('${out}/client-b.png')
out = Image.new('RGB', (a.width + b.width, max(a.height, b.height)), (159, 220, 255))
out.paste(a, (0, 0)); out.paste(b, (a.width, 0))
out.save('${out}/side-by-side.png')
print('side-by-side', out.size)
`]);

const bx = await B.page.evaluate(() => {
  const r = [...window.__hv.mp.session.remotes.values()][0];
  return r ? r.interp.to.x : null;
});
const remoteCountA = await A.page.evaluate(() => window.__hv.mp.session.remotes.size);
const remoteCountB = await B.page.evaluate(() => window.__hv.mp.session.remotes.size);
console.log('B sees remote x', bx, 'counts', remoteCountA, remoteCountB);
const ok = remoteCountA === 1 && remoteCountB === 1 && typeof bx === 'number';
console.log(ok ? 'E2E_OK' : 'E2E_FAIL');

await A.ctx.close();
await B.ctx.close();
await browser.close();
process.exit(ok ? 0 : 1);
