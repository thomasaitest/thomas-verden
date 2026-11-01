import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-512', 512, 0], ['icon-192', 192, 0], ['apple-touch-icon', 180, 0.04], ['icon-512-maskable', 512, 0.12]]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<body style="margin:0;background:${pad ? '#8fd8ff' : 'transparent'};display:grid;place-items:center;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body>`);
  await page.screenshot({ path: new URL(`../public/icons/${name}.png`, import.meta.url).pathname, omitBackground: !pad });
}
await browser.close();
console.log('icons done');
