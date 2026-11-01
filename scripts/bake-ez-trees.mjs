/**
 * Offline-bake @dgreenheck/ez-tree (MIT) → public/models/nature/ez/*.glb (Draco).
 * Run: node scripts/bake-ez-trees.mjs
 */
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public/models/nature/ez');
fs.mkdirSync(outDir, { recursive: true });

const bakeRoot = path.join(root, 'scripts/bake-src');
const server = await createServer({
  root: bakeRoot,
  configFile: false,
  clearScreen: false,
  logLevel: 'info',
  server: {
    host: '127.0.0.1',
    port: 4761,
    strictPort: true,
    fs: { allow: [root] },
  },
  resolve: {
    dedupe: ['three'],
    alias: {
      three: path.join(root, 'node_modules/three'),
      '@dgreenheck/ez-tree': path.join(root, 'node_modules/@dgreenheck/ez-tree'),
    },
  },
  optimizeDeps: {
    include: ['three', '@dgreenheck/ez-tree'],
  },
});
await server.listen();
const addr = server.httpServer?.address();
const url = typeof addr === 'string' ? addr : `http://127.0.0.1:${addr.port}/`;
console.log('bake server', url, addr);

// smoke check
try {
  const r = await fetch(url);
  console.log('fetch status', r.status);
} catch (e) {
  console.error('fetch fail', e);
  await server.close();
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
  ],
});
const page = await browser.newPage();
page.on('console', (m) => console.log('browser:', m.type(), m.text()));
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('requestfailed', (r) => console.log('REQFAIL', r.url(), r.failure()?.errorText));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__bakeDone === true, null, { timeout: 300000 });
const err = await page.evaluate(() => window.__bakeError || null);
if (err) {
  console.error('bake failed', err);
  await browser.close();
  await server.close();
  process.exit(1);
}
const baked = await page.evaluate(() => window.__baked);
await browser.close();
await server.close();

for (const [name, b64] of Object.entries(baked)) {
  const raw = path.join(outDir, `${name}.raw.glb`);
  const final = path.join(outDir, `${name}.glb`);
  fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
  console.log('wrote', raw, fs.statSync(raw).size);
  try {
    // Draco only — avoid EXT_texture_webp (SwiftShader/three decoder fails → trees fall back to cubes)
    execSync(
      `npx gltf-transform optimize "${raw}" "${final}" --compress draco --texture-compress false`,
      { stdio: 'inherit', cwd: root },
    );
  } catch (e) {
    fs.copyFileSync(raw, final);
    console.warn('optimize failed, using raw for', name, e?.message);
  }
  try { fs.unlinkSync(raw); } catch {}
  console.log('final', final, fs.statSync(final).size);
}
console.log('done', outDir);
