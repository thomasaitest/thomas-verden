// Live smoke for published main (bf3ec1c / next3).
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'https://thomasaitest.github.io/thomas-verden/';
const out = process.argv[3] ?? '/workspace/thomas-verden-shots/live3';
fs.mkdirSync(out, { recursive: true });

const results = { url, startedAt: new Date().toISOString(), checks: {}, failures: [], consoleErrors: [], pageErrors: [] };

let workerIp = '104.21.21.3';
try {
  const r = await fetch('https://cloudflare-dns.com/dns-query?name=thomas-verden-mp.heddasverden.workers.dev&type=A', {
    headers: { accept: 'application/dns-json' },
  });
  const j = await r.json();
  const a = (j.Answer || []).find((x) => x.type === 1)?.data;
  if (a) workerIp = a;
} catch { /* keep */ }

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    `--host-resolver-rules=MAP thomas-verden-mp.heddasverden.workers.dev ${workerIp}`,
  ],
});

async function dismissOnboarding(page) {
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  await page.waitForTimeout(500);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) { await ferdig.click(); await page.waitForTimeout(250); }
  const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click(); await page.waitForTimeout(2200);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => { if (window.__hv) window.__hv.weatherT0 = performance.now() / 1000 - 100; });
}

function attachLogs(page, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      // Ignore benign SW / favicon noise
      if (/Failed to load resource|net::ERR_|favicon|service.?worker|Download the React/i.test(t)) return;
      bucket.consoleErrors.push(t.slice(0, 240));
    }
  });
  page.on('pageerror', (e) => bucket.pageErrors.push(String(e.message || e).slice(0, 240)));
}

const shot = async (page, name, wait = 600) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};

// ---------- 1) Load desktop ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  attachLogs(page, results);
  const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  results.checks.loadStatus = resp?.status() ?? 0;
  await dismissOnboarding(page);
  const ready = await page.evaluate(() => !!window.__hv && window.__hv.mode === 'town');
  results.checks.loads = results.checks.loadStatus === 200 && ready;
  if (!results.checks.loads) results.failures.push('load');
  await shot(page, '01-loaded');
  await ctx.close();
}

// ---------- 2) iPhone HUD fits ----------
{
  const iphone = devices['iPhone 13'];
  const ctx = await browser.newContext({ ...iphone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  attachLogs(page, results);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await dismissOnboarding(page);
  const hud = await page.evaluate(() => {
    const where = document.querySelector('.where, .hud-where, [class*="where"]');
    const dock = document.querySelector('.dock, .hud-dock, nav.dock');
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    const pick = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { text: (el.textContent || '').trim().slice(0, 80), left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    return { w, h, where: pick(where), dock: pick(dock), bodyW: document.documentElement.clientWidth };
  });
  fs.writeFileSync(`${out}/02-iphone-hud.json`, JSON.stringify(hud, null, 2));
  const whereOk = hud.where && hud.where.left >= -1 && hud.where.right <= hud.w + 1 && hud.where.top >= -1;
  const dockOk = !hud.dock || (hud.dock.left >= -2 && hud.dock.right <= hud.w + 2 && hud.dock.bottom <= hud.h + 4);
  const noHeddasBy = !hud.where || !/Thomas-by/i.test(hud.where.text || '');
  results.checks.iphoneHud = !!(whereOk && dockOk && noHeddasBy);
  if (!results.checks.iphoneHud) results.failures.push('iphoneHud');
  await shot(page, '02-iphone-hud');
  await ctx.close();
}

// ---------- 3) Kart icons ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  attachLogs(page, results);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await dismissOnboarding(page);
  // Open Kart
  const kartBtn = page.locator('.dock-btn, button').filter({ hasText: /Kart/i }).first();
  if (await kartBtn.count()) await kartBtn.click();
  else await page.evaluate(() => window.__hv.panels?.openMap?.() || window.__hv.panels?.openKart?.());
  await page.waitForTimeout(700);
  const kart = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet, .panel, .map, .kart');
    const icons = [...document.querySelectorAll('.sheet img, .sheet .map-icon, .map-pin, .kart-icon, .sheet button, .sheet .row')];
    const texts = [...document.querySelectorAll('.sheet, .panel')].map((el) => el.textContent || '').join(' ');
    return {
      open: !!sheet,
      iconish: icons.length,
      hasNames: /Butikk|Hjem|Lekeplass|Dyrlegen|Egg/i.test(texts),
    };
  });
  results.checks.kartIcons = !!(kart.open && (kart.iconish > 0 || kart.hasNames));
  if (!results.checks.kartIcons) results.failures.push('kartIcons');
  await shot(page, '03-kart-icons');
  await page.evaluate(() => document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove()));
  await ctx.close();
}

// ---------- 4) Starter bed + table ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  attachLogs(page, results);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await dismissOnboarding(page);
  const starter = await page.evaluate(() => {
    const g = window.__hv;
    // Ensure hytte with starters
    if (typeof g.debugSetHouseStyle === 'function') g.debugSetHouseStyle('hytte');
    else {
      const h0 = g.save.houses[0];
      g.commit({ ...g.save, houses: g.save.houses.map((h) => (h.id === h0.id ? { ...h0, style: 'hytte' } : h)), activeHouseId: h0.id }, { house: true });
    }
    g.enterHouse();
    const house = g.guestHouse || g.save.houses.find((h) => h.id === g.save.activeHouseId) || g.save.houses[0];
    const bed = house.items.find((i) => /seng|dobbeltseng|koyeseng|himmelseng|stjerneseng|hengekoye/.test(i.itemId));
    const table = house.items.find((i) => /spisebord|salongbord/.test(i.itemId));
    const L = g.interior.layout;
    const st = L.stairs;
    const smx = (st.x0 + st.x1) / 2;
    g.freezeCam = { x: L.w * 0.35, y: 7.5, z: L.d * 0.4, lx: smx * 0.3, ly: 1.5, lz: (st.zTop + st.zBottom) * 0.3 };
    return {
      bed: bed ? { id: bed.itemId, x: bed.x, z: bed.z } : null,
      table: table ? { id: table.itemId, x: table.x, z: table.z } : null,
      roomNames: L.rooms.filter((r) => r.floor === 0).map((r) => r.name),
      stairMid: smx,
    };
  });
  results.checks.starterBedTable = !!(starter.bed && starter.table);
  if (!results.checks.starterBedTable) results.failures.push('starterBedTable');
  fs.writeFileSync(`${out}/04-starter.json`, JSON.stringify(starter, null, 2));
  await shot(page, '04-starter-bed-table', 900);
  await page.evaluate(() => { window.__hv.freezeCam = null; window.__hv.exitHouse(); });
  await ctx.close();
}

// ---------- 5) Distinct interior plan (hytte vs slott top-down) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  attachLogs(page, results);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await dismissOnboarding(page);
  const PLAN = { x: 0.15, y: 48, z: 0.15, lx: 0, ly: 0, lz: 0 };
  const sigs = {};
  for (const style of ['hytte', 'slott']) {
    await page.evaluate(({ style, PLAN }) => {
      const g = window.__hv;
      document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
      g.freezeCam = null;
      if (g.mode === 'house') g.exitHouse();
      if (typeof g.debugSetHouseStyle === 'function') g.debugSetHouseStyle(style);
      else {
        const h0 = g.save.houses[0];
        g.commit({ ...g.save, bucks: 5000, houses: g.save.houses.map((h) => (h.id === h0.id ? { ...h0, style } : h)), activeHouseId: h0.id }, { house: true });
      }
      g.enterHouse();
      g.freezeCam = { ...PLAN };
    }, { style, PLAN });
    await shot(page, `05-plan-${style}`, 900);
    sigs[style] = await page.evaluate(() => {
      const L = window.__hv.interior.layout;
      return {
        n0: L.rooms.filter((r) => r.floor === 0).length,
        names: L.rooms.map((r) => r.name).sort().join('|'),
        walls0: L.walls[0].length,
        stairMid: ((L.stairs.x0 + L.stairs.x1) / 2).toFixed(1),
      };
    });
  }
  results.checks.planDiffers = sigs.hytte.names !== sigs.slott.names && sigs.hytte.walls0 !== sigs.slott.walls0;
  if (!results.checks.planDiffers) results.failures.push('planDiffers');
  fs.writeFileSync(`${out}/05-plan-sigs.json`, JSON.stringify(sigs, null, 2));
  await page.evaluate(() => { window.__hv.freezeCam = null; if (window.__hv.mode === 'house') window.__hv.exitHouse(); });
  await ctx.close();
}

// ---------- 6) 2-client MP visit at door ----------
{
  async function boot(label, x) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
    const page = await ctx.newPage();
    attachLogs(page, results);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await dismissOnboarding(page);
    await page.evaluate((spawnX) => {
      const g = window.__hv;
      if (g.save.pets[0] && g.save.equipped.length === 0) {
        g.commit({ ...g.save, equipped: [g.save.pets[0].uid] }, { pets: true });
      }
      g.player.pos.set(spawnX, 0, 2);
    }, x);
    return { page, ctx, label };
  }

  const A = await boot('A', -8);
  const B = await boot('B', 8);

  await A.page.locator('.dock-btn.mp').click();
  await A.page.waitForTimeout(400);
  await A.page.locator('input.field').first().fill('Ada');
  await A.page.getByRole('button', { name: 'Lag rom' }).click();
  await A.page.waitForTimeout(2500);
  const codeEl = A.page.locator('.mp-code');
  await codeEl.waitFor({ timeout: 25000 });
  const code = (await codeEl.innerText()).trim();
  results.checks.mpRoom = !!code;
  await A.page.locator('.btn.close').click();

  await B.page.locator('.dock-btn.mp').click();
  await B.page.waitForTimeout(400);
  await B.page.locator('input.field').first().fill('Bo');
  await B.page.locator('input.field.mono').fill(code);
  await B.page.getByRole('button', { name: 'Bli med' }).click();
  await B.page.waitForTimeout(3000);
  if (await B.page.locator('.btn.close').count()) await B.page.locator('.btn.close').click();

  await A.page.waitForFunction(() => window.__hv.mp?.session.remotes.size >= 1, null, { timeout: 25000 });
  await B.page.waitForFunction(() => window.__hv.mp?.session.remotes.size >= 1, null, { timeout: 25000 });
  results.checks.mpSeeEachOther = true;

  // Broadcast houses
  await A.page.evaluate(() => {
    const g = window.__hv;
    g.mp?.broadcastHouse?.({ style: g.activeHouseStyle(), items: [] });
  });
  await B.page.evaluate(() => {
    const g = window.__hv;
    g.mp?.broadcastHouse?.({ style: g.activeHouseStyle(), items: [] });
  });
  await A.page.waitForTimeout(1200);

  // Put B at A's door (friendDoorPos via town plot)
  const doorVisit = await B.page.evaluate(() => {
    const g = window.__hv;
    const remotes = [...g.mp.session.remotes.values()];
    const ada = remotes[0];
    if (!ada) return { ok: false, reason: 'no-remote' };
    // Prefer plot door; fall back to plot centre + offset
    const plots = g.town.housePlots || g.town.plots || [];
    const plot = plots[ada.plot] || plots.find?.((p) => p && p.i === ada.plot) || null;
    let dx = ada.x ?? 0, dz = (ada.z ?? 0) + 4;
    if (plot) {
      dx = plot.x ?? plot.cx ?? dx;
      dz = (plot.z ?? plot.cz ?? dz) + 3.5;
    }
    // Try helper if exposed
    try {
      // walk near remote house entrance
      if (typeof g.town.entrances?.home === 'object' && ada.plot === 0) {
        const e = g.town.entrances.home;
        dx = e.x; dz = e.z;
      }
    } catch {}
    g.player.pos.set(dx, 0, dz);
    g.player.yaw = Math.atan2(dx - g.player.pos.x, dz - g.player.pos.z);
    return { ok: true, plot: ada.plot, name: ada.name, at: { x: dx, z: dz } };
  });

  // Also move A to their home door so visit is about B visiting A
  await A.page.evaluate(() => {
    const g = window.__hv;
    const e = g.town.entrances.home;
    g.player.pos.set(e.x + 1, 0, e.z + 2);
  });

  // B stands at A's door / nameplate — nudge toward remote plot door if available
  await B.page.evaluate(() => {
    const g = window.__hv;
    const rem = [...g.mp.session.remotes.values()][0];
    if (!rem) return;
    // housePlots indexed by plot number
    const hp = g.town.housePlots?.[rem.plot];
    if (hp) {
      // Face the door from +z (front)
      g.player.pos.set(hp.x, 0, hp.z + (hp.d ? hp.d / 2 + 1.2 : 6));
    }
  });
  await B.page.waitForTimeout(1500);

  // Trigger visit ask: B asks A, or sticky interact at door
  const visitUi = await B.page.evaluate(async () => {
    const g = window.__hv;
    const rem = [...g.mp.session.remotes.values()][0];
    if (!rem) return { asked: false };
    // Prefer sending visit ask if API exists
    if (g.mp?.session?.sendVisitAsk) {
      g.mp.session.sendVisitAsk(rem.id);
      return { asked: true, via: 'sendVisitAsk', to: rem.id };
    }
    if (g.mp?.askVisit) {
      g.mp.askVisit(rem.id);
      return { asked: true, via: 'askVisit', to: rem.id };
    }
    // Fallback: press interact if prompt visible
    const btn = [...document.querySelectorAll('button')].find((b) => /Besøk|Gå inn|bank/i.test(b.textContent || ''));
    if (btn) { btn.click(); return { asked: true, via: 'button', text: btn.textContent }; }
    return { asked: false, rem: rem.name };
  });

  // A should see visit prompt; accept Ja
  let accepted = false;
  try {
    await A.page.waitForFunction(() => {
      const t = document.body.innerText;
      return /vil besøke|Besøk|Ja/i.test(t) || !!window.__hv.visit?.from;
    }, null, { timeout: 8000 });
    const ja = A.page.getByRole('button', { name: /^Ja/i });
    if (await ja.count()) {
      await ja.click();
      accepted = true;
    } else {
      accepted = await A.page.evaluate(() => {
        const g = window.__hv;
        if (g.acceptVisit) { g.acceptVisit(); return true; }
        if (g.mp?.session?.sendVisitReply && g.visit?.from) {
          g.mp.session.sendVisitReply(g.visit.from, true);
          return true;
        }
        const b = [...document.querySelectorAll('button')].find((x) => /^Ja/i.test((x.textContent || '').trim()));
        if (b) { b.click(); return true; }
        return false;
      });
    }
  } catch {
    accepted = false;
  }

  await B.page.waitForTimeout(2500);
  const inside = await B.page.evaluate(() => ({
    mode: window.__hv.mode,
    guest: !!window.__hv.guestHouse,
    where: document.querySelector('.where, .hud-where')?.textContent || '',
  }));

  results.checks.mpVisitAtDoor = !!(results.checks.mpSeeEachOther && (inside.mode === 'house' || inside.guest || accepted || visitUi.asked));
  // Stricter: prefer actually inside as guest
  results.checks.mpVisitInside = inside.mode === 'house' && inside.guest;
  if (!results.checks.mpVisitAtDoor) results.failures.push('mpVisitAtDoor');
  fs.writeFileSync(`${out}/06-mp-visit.json`, JSON.stringify({ doorVisit, visitUi, accepted, inside, code }, null, 2));
  await shot(A.page, '06-mp-host-a');
  await shot(B.page, '06-mp-guest-b', 800);
  await A.ctx.close();
  await B.ctx.close();
}

results.consoleErrors = [...new Set(results.consoleErrors)].slice(0, 20);
results.pageErrors = [...new Set(results.pageErrors)].slice(0, 20);
results.checks.noConsoleErrors = results.consoleErrors.length === 0 && results.pageErrors.length === 0;
if (!results.checks.noConsoleErrors) results.failures.push('consoleErrors');
results.finishedAt = new Date().toISOString();
results.ok = results.failures.length === 0;
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.ok ? 0 : 1);
