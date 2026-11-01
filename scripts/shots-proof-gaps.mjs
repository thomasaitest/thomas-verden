
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
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) await ferdig.click();
  await page.waitForTimeout(250);
  const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click(); await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => { window.__hv.weatherT0 = performance.now()/1000 - 100; });
  return { page, ctx };
}
const shot = async (page, name, w=700) => {
  await page.waitForTimeout(w);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};

{
  const { page, ctx } = await boot();

  // Debug vet entrance
  const vetInfo = await page.evaluate(() => {
    const g = window.__hv;
    const door = g.town.entrances.vet;
    const z = g.town.zones.find(z => z.kind==='vet');
    return { door, zone: z, places: null };
  });
  console.log('vet', vetInfo);

  // Stand on plaza side of vet door, looking at FRONT facade
  await page.evaluate(() => {
    const g = window.__hv;
    const door = g.town.entrances.vet;
    // vet door.yaw points outward/away from plaza (into building). Plaza side = yaw + PI
    const plazaDir = door.yaw + Math.PI;
    g.player.pos.set(
      door.x + Math.sin(plazaDir) * 14,
      0,
      door.z + Math.cos(plazaDir) * 14,
    );
    // face the building (toward door from plaza)
    g.player.yaw = door.yaw; // for vet, door.yaw faces into building from outside? 
    // Actually: if door.yaw = f.rot+PI points away from plaza, then from plaza looking at building = door.yaw
    g.player.yaw = door.yaw;
    g.cam.yaw = door.yaw + Math.PI; // camera on plaza side behind player
    g.cam.pitch = 0.4;
    g.cam.dist = 18;
  });
  await shot(page, '03-vet-cross-sign', 900);

  // Also try alternate if first is wrong – shoot from zone marker
  await page.evaluate(() => {
    const g = window.__hv;
    const z = g.town.zones.find((z) => z.kind === 'vet');
    // zone is near door inside; back up along vector from building centre to zone
    const bx = 46, bz = 12; // PLACES.vet
    const dx = z.x - bx, dz = z.z - bz;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx/len, uz = dz/len;
    g.player.pos.set(z.x + ux * 12, 0, z.z + uz * 12);
    g.player.yaw = Math.atan2(-ux, -uz); // face building
    g.cam.yaw = Math.atan2(ux, uz); // behind player
    g.cam.pitch = 0.4;
    g.cam.dist = 17;
  });
  await shot(page, '03b-vet-front-alt', 800);

  // Accessories via commit + close orbit on character
  for (const [acc, name, yaw] of [
    ['vinger-regnbue', '07a-accessory-vinger', Math.PI * 0.75],
    ['veske-hjerte', '07b-accessory-veske', 0.55],
    ['halskjede', '07c-accessory-halskjede', 0.1],
    ['sekk-stjerne', '07e-accessory-sekk', Math.PI * 0.8],
  ]) {
    await page.evaluate(({ acc, yaw }) => {
      const g = window.__hv;
      g.commit({
        ...g.save,
        avatar: { ...g.save.avatar, accessory: acc, bottom: 'ballerinaskjort', shirt: '#ffa6d5', pants: '#c88bff', hair: 'fletter' },
      }, { avatar: true });
      g.player.pos.set(0, 0, 15);
      g.player.yaw = 0;
      g.cam.yaw = yaw;
      g.cam.pitch = 0.18;
      g.cam.dist = 4.8;
    }, { acc, yaw });
    await page.waitForTimeout(200);
    await shot(page, name, 450);
  }

  // Pet + tree clearly
  await page.evaluate(() => {
    const g = window.__hv;
    const trees = (g.town.circles||[]).filter(c => c.r>=1.5 && c.r<=3);
    const tree = trees[5] || trees[0];
    const pet = g.equippedPets()[0];
    const a = g.actors.get(pet.uid);
    // Player west, pet east, tree middle
    g.player.pos.set(tree.x - 6, 0, tree.z);
    a.pos.set(tree.x + 0.2, 0, tree.z); // start overlapping → resolve pushes out
    g.cam.yaw = Math.PI / 2;
    g.cam.pitch = 0.6;
    g.cam.dist = 11;
  });
  await page.waitForTimeout(2000);
  await shot(page, '08-pet-around-obstacle', 400);

  await ctx.close();
}

// MP house + lock + remote car (no overlays)
{
  const A = await boot({ width: 1100, height: 800 });
  const B = await boot({ width: 1100, height: 800 });
  const nukeUI = async (page) => {
    await page.evaluate(() => {
      document.querySelectorAll('.sheet,.modal,[class*=sheet]').forEach((e) => e.remove());
    });
  };
  await A.page.evaluate(() => {
    const g = window.__hv;
    const h = { ...g.save.houses[0], locked: true, style: 'villa' };
    g.commit({ ...g.save, bucks: 9000, bag: { ...g.save.bag, 'bil-rosa': 1 }, houses: [h, ...g.save.houses.slice(1)], activeHouseId: h.id }, { house: true });
  });
  await A.page.locator('.dock-btn.mp').click();
  await A.page.locator('input.field').first().fill('Ada');
  await A.page.getByRole('button', { name: 'Lag rom' }).click();
  await A.page.waitForTimeout(1600);
  const code = await A.page.evaluate(() => window.__hv.mp.session.code);
  await B.page.evaluate(() => {
    const g = window.__hv;
    const h = { ...g.save.houses[0], locked: false, style: 'slott' };
    g.commit({ ...g.save, bucks: 9000, bag: { ...g.save.bag, 'bil-bla': 1 }, houses: [h, ...g.save.houses.slice(1)], activeHouseId: h.id }, { house: true });
  });
  await B.page.locator('.dock-btn.mp').click();
  await B.page.locator('input.field').nth(0).fill('Bo');
  await B.page.locator('input.field').nth(1).fill(code);
  await B.page.getByRole('button', { name: 'Bli med' }).click();
  await B.page.waitForTimeout(3500);
  await nukeUI(A.page); await nukeUI(B.page);

  const info = await A.page.evaluate(() => {
    const g = window.__hv;
    const remotes = [...g.mp.session.remotes.values()];
    return {
      remotes: remotes.map(r => ({ name: r.name, plot: r.plot, style: r.house?.style || r.houseStyle, locked: r.house?.locked })),
      plots: g.town.housePlots.map((p,i)=>({i,x:p.x,z:p.z})),
    };
  });
  console.log(JSON.stringify(info, null, 2));

  // Frame joiner plot house – move near plot and look at it
  await A.page.evaluate(() => {
    const g = window.__hv;
    const j = [...g.mp.session.remotes.values()][0];
    const plot = g.town.housePlots[j.plot];
    // stand south-east of plot
    g.player.pos.set(plot.x + 16, 0, plot.z + 18);
    g.player.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z);
    g.cam.yaw = g.player.yaw + Math.PI;
    g.cam.pitch = 0.55;
    g.cam.dist = 28;
  });
  await shot(A.page, '10-mp-joiner-house-on-plot', 1000);

  // Host's locked house as seen by joiner (host is on a remote plot for B)
  await B.page.evaluate(() => {
    const g = window.__hv;
    const host = [...g.mp.session.remotes.values()][0];
    const plot = g.town.housePlots[host.plot];
    g.player.pos.set(plot.x + 11, 0, plot.z + 13);
    g.player.yaw = Math.atan2(plot.x - g.player.pos.x, plot.z - g.player.pos.z);
    g.cam.yaw = g.player.yaw + Math.PI;
    g.cam.pitch = 0.35;
    g.cam.dist = 18;
  });
  await shot(B.page, '12-mp-house-lock', 1000);

  // Remote car again (keep working)
  await A.page.evaluate(() => {
    const g = window.__hv;
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.player.pos.set(4, 0, 14);
    g.player.yaw = 0.6;
  });
  await A.page.waitForTimeout(1200);
  await B.page.evaluate(() => {
    const g = window.__hv;
    const host = [...g.mp.session.tickRemotes()][0];
    g.player.pos.set(host.x, 0, host.z);
    g.cam.yaw = host.yaw + 0.95;
    g.cam.pitch = 0.2;
    g.cam.dist = 8.5;
  });
  await shot(B.page, '13-mp-remote-car', 900);

  await A.ctx.close(); await B.ctx.close();
}
await browser.close();
console.log('gaps done');
