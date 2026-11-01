// Camera + collision check in headless Chrome. Usage: node scripts/camera-shots.mjs [url] [outDir]
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/workspace/heddas-mockups';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
const check = (name, ok, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);
  if (!ok) failed++;
};

async function start(opts) {
  const ctx = await browser.newContext({ viewport: opts.viewport, hasTouch: !!opts.touch, isMobile: !!opts.touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Ferdig ✓' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Klekk egget! 🐣' }).click();
  await page.waitForTimeout(2600);
  await page.getByRole('button', { name: 'Hurra! 🎉' }).click();
  await page.waitForTimeout(800);
  return { page, ctx };
}
const cam = (page) => page.evaluate(() => ({ ...window.__hv.cam }));
const shot = async (page, name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', `${out}/${name}.png`);
};
const where = (page) => page.evaluate(() => { const p = window.__hv.player.pos; return { x: p.x, z: p.z }; });

// ---------- desktop: mouse ----------
{
  const { page, ctx } = await start({ viewport: { width: 1180, height: 820 } });
  // a spot on the plaza ring, in the open, so the view is not blocked by a building
  await page.evaluate(() => { const g = window.__hv; g.player.pos.set(-9, 0, 13); g.cam.yaw = 0.55; g.cam.pitch = 0.38; g.cam.dist = 15; });
  await page.waitForTimeout(1500);
  await shot(page, 'desktop-1-default');
  const c0 = await cam(page);
  await page.mouse.move(600, 300);
  await page.mouse.down();
  await page.mouse.move(600 + 520, 300, { steps: 12 });
  await page.mouse.up();
  const c1 = await cam(page);
  check('left-drag rotates the camera', Math.abs(c1.yaw - c0.yaw) > 1.5, `yaw ${c0.yaw.toFixed(2)} -> ${c1.yaw.toFixed(2)}`);
  await shot(page, 'desktop-2-rotated');
  // right-drag, also tilting up
  await page.mouse.move(600, 300);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(500, 380, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  const c2 = await cam(page);
  check('right-drag rotates and tilts', c2.yaw !== c1.yaw && c2.pitch > c1.pitch, `pitch ${c1.pitch.toFixed(2)} -> ${c2.pitch.toFixed(2)}`);
  // limits
  await page.mouse.move(600, 300); await page.mouse.down(); await page.mouse.move(600, 820, { steps: 5 }); await page.mouse.move(600, 0, { steps: 5 }); await page.mouse.move(600, 820, { steps: 5 }); await page.mouse.up();
  await page.mouse.move(600, 300); await page.mouse.down(); await page.mouse.move(600, 820, { steps: 20 }); await page.mouse.up();
  const c3 = await cam(page);
  check('pitch limited (never below ground / past straight down)', c3.pitch <= 1.35 + 1e-6 && c3.pitch >= 0.12 - 1e-6, `pitch ${c3.pitch.toFixed(2)}`);
  await shot(page, 'desktop-3-high');
  await page.mouse.move(600, 300);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  const c4 = await cam(page);
  check('wheel zooms out to the limit', c4.dist === 34, `dist ${c4.dist}`);
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -400);
  await page.waitForTimeout(300);
  const c5 = await cam(page);
  check('wheel zooms in to the limit', c5.dist === 5, `dist ${c5.dist}`);
  // low pitch: camera must stay above ground
  await page.mouse.move(600, 300); await page.mouse.down(); await page.mouse.move(600, 0, { steps: 30 }); await page.mouse.up();
  const camY = await page.evaluate(() => window.__hv.camera.position.y);
  check('camera stays above the ground at the lowest pitch', camY > 0.5, `y=${camY.toFixed(2)}`);
  await shot(page, 'desktop-4-low-close');

  // drags must not tap: count taps
  await page.evaluate(() => { window.__taps = 0; const i = window.__hv.input; const o = i.onTap; i.onTap = (t) => { window.__taps++; o?.(t); }; });
  await page.mouse.move(500, 400); await page.mouse.down(); await page.mouse.move(560, 420, { steps: 6 }); await page.mouse.up();
  check('a drag is not a tap', (await page.evaluate(() => window.__taps)) === 0);
  await page.mouse.click(500, 400);
  check('a click is a tap', (await page.evaluate(() => window.__taps)) === 1);
  await page.mouse.move(500, 400); await page.mouse.down(); await page.mouse.move(503, 402); await page.mouse.up();
  check('tiny jitter (<6px) still counts as a tap', (await page.evaluate(() => window.__taps)) === 2);

  // camera-relative movement: face the camera away then press W; player must move away from camera
  await page.evaluate(() => { const g = window.__hv; g.cam.yaw = 2.2; g.cam.pitch = 0.4; g.cam.dist = 15; g.teleport('shop'); });
  await page.waitForTimeout(800);
  const a = await where(page);
  const camPos = await page.evaluate(() => { const p = window.__hv.camera.position; return { x: p.x, z: p.z }; });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  const b = await where(page);
  const toCam = { x: camPos.x - a.x, z: camPos.z - a.z };
  const moved = { x: b.x - a.x, z: b.z - a.z };
  const dot = (toCam.x * moved.x + toCam.z * moved.z) / (Math.hypot(toCam.x, toCam.z) * Math.hypot(moved.x, moved.z));
  check('W moves away from the camera after rotating', dot < -0.95, `cos=${dot.toFixed(2)}`);
  await ctx.close();
}

// ---------- desktop: collisions by real keyboard walking ----------
{
  const { page, ctx } = await start({ viewport: { width: 1180, height: 820 } });
  const walk = async (from, key, ms, yaw = 0) => {
    await page.evaluate(([x, z, yaw]) => { const g = window.__hv; g.cam.yaw = yaw; g.player.pos.set(x, 0, z); g.player.vy = 0; }, [from[0], from[1], yaw]);
    await page.waitForTimeout(150);
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    return where(page);
  };
  // camera yaw 0 => W walks towards -z
  const tests = [
    ['fountain', [0, 14], 'KeyW', (p) => Math.hypot(p.x, p.z) > 5.0],
    ['shop (walking at it)', [38, -24], 'KeyW', (p) => p.z > -34 && Math.hypot(p.x - 38, p.z + 34) > 5],
    ['egg shop', [0, -38], 'KeyW', (p) => p.z > -50 + 4.4],
  ];
  for (const [name, from, key, ok] of tests) {
    const p = await walk(from, key, 3000);
    check(`cannot walk through ${name}`, ok(p), `ended ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
  }
  // vet side wall: vet at (46,12) faces the plaza (-x,-z). Walk +x from the west... aim at the front half of the left/right wall
  const vetRot = Math.atan2(-46, -12);
  const side = { x: 46 + 9 * Math.cos(vetRot) + 3 * Math.sin(vetRot), z: 12 - 9 * Math.sin(vetRot) + 3 * Math.cos(vetRot) }; // local (9, 3)
  // walk towards the building centre horizontally: keys relative to camera, so set yaw to point at it
  const dirYaw = Math.atan2(46 - side.x, 12 - side.z); // heading to centre
  await page.evaluate(([x, z, yaw]) => { const g = window.__hv; g.cam.yaw = yaw + Math.PI; g.player.pos.set(x, 0, z); }, [side.x, side.z, dirYaw]);
  await page.waitForTimeout(150);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2200); await page.keyboard.up('KeyW');
  const pv = await where(page);
  const lx = (pv.x - 46) * Math.cos(vetRot) - (pv.z - 12) * Math.sin(vetRot);
  check('cannot walk through the vet side wall (front half)', Math.abs(lx) > 7, `local x=${lx.toFixed(1)}`);
  await page.evaluate(() => window.__hv.teleport('vet'));
  await page.waitForTimeout(600);
  await ctx.close();
}

// ---------- iPad: touch ----------
{
  const { page, ctx } = await start({ viewport: { width: 1180, height: 820 }, touch: true });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  await page.evaluate(() => window.__hv.teleport('play'));
  await page.waitForTimeout(1500);
  await shot(page, 'ipad-1-default');
  const c0 = await cam(page);
  await touch('touchStart', [[700, 250]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[700 + i * 40, 250 + i * 6]]);
  await touch('touchEnd', []);
  const c1 = await cam(page);
  check('one-finger drag rotates the camera', Math.abs(c1.yaw - c0.yaw) > 1, `yaw ${c0.yaw.toFixed(2)} -> ${c1.yaw.toFixed(2)}`);
  await shot(page, 'ipad-2-rotated');
  // pinch out = zoom in, pinch in = zoom out
  await page.evaluate(() => { window.__hv.cam.dist = 15; });
  await touch('touchStart', [[500, 300], [700, 300]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[500 - i * 30, 300], [700 + i * 30, 300]]);
  await touch('touchEnd', []);
  const c2 = await cam(page);
  check('pinch out zooms in', c2.dist < 15, `dist ${c2.dist.toFixed(1)}`);
  await touch('touchStart', [[300, 300], [900, 300]]);
  for (let i = 1; i <= 12; i++) await touch('touchMove', [[300 + i * 40, 300], [900 - i * 40, 300]]);
  await touch('touchEnd', []);
  const c3 = await cam(page);
  check('pinch in zooms out', c3.dist > c2.dist, `dist ${c2.dist.toFixed(1)} -> ${c3.dist.toFixed(1)}`);
  // pinch must not count as a tap
  await page.evaluate(() => { window.__taps = 0; const i = window.__hv.input; const o = i.onTap; i.onTap = (t) => { window.__taps++; o?.(t); }; });
  await touch('touchStart', [[500, 300], [700, 300]]);
  await touch('touchEnd', []);
  check('lifting a pinch is not a tap', (await page.evaluate(() => window.__taps)) === 0);
  await touch('touchStart', [[640, 300]]);
  await touch('touchEnd', []);
  check('a touch tap is a tap', (await page.evaluate(() => window.__taps)) === 1);
  await touch('touchStart', [[640, 300]]);
  for (let i = 1; i <= 5; i++) await touch('touchMove', [[640 + i * 12, 300]]);
  await touch('touchEnd', []);
  check('a touch drag is not a tap', (await page.evaluate(() => window.__taps)) === 1);
  check('canvas has touch-action none', (await page.evaluate(() => getComputedStyle(document.querySelector('#world canvas')).touchAction)) === 'none');
  await ctx.close();
}
// ---------- iPad portrait, other angle ----------
{
  const { page, ctx } = await start({ viewport: { width: 820, height: 1180 }, touch: true });
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate(() => { const g = window.__hv; g.player.pos.set(9, 0, -9); g.cam.yaw = 0.8; g.cam.dist = 20; });
  await page.waitForTimeout(1200);
  await shot(page, 'ipad-portrait-1-front');
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  await touch('touchStart', [[300, 400]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[300 + i * 36, 400 - i * 10]]);
  await touch('touchEnd', []);
  await shot(page, 'ipad-portrait-2-from-side');
  await ctx.close();
}
// ---------- inside the house: furniture is solid ----------
{
  const { page, ctx } = await start({ viewport: { width: 1180, height: 820 } });
  await page.evaluate(() => { const g = window.__hv; g.teleport('home'); g.enterHouse(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__hv.debugFurnish());
  await page.waitForTimeout(1200);
  const rects = await page.evaluate(() => window.__hv.interior.rects.length);
  check('house furniture has colliders', rects >= 8, `${rects} solid items`);
  await shot(page, 'house-1-default');
  // sofa is at (2,-4.9) in the debug layout: walk from the front straight at it with W (camera yaw 0 => -z)
  await page.evaluate(() => { const g = window.__hv; g.cam.yaw = 0; g.player.pos.set(2, 0, 2.5); g.player.vy = 0; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
  const p = await where(page);
  check('cannot walk through the sofa/coffee table', p.z > -4.2, `ended ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
  await page.evaluate(() => { window.__hv.cam.yaw = 2.4; });
  await shot(page, 'house-2-rotated');
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
