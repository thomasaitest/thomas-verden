import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('vendor/raw/selected');
const outRoot = path.resolve('public/models');

const jobs = [];

function walk(dir, rel = '') {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    const r = path.join(rel, ent.name);
    if (ent.isDirectory()) walk(p, r);
    else if (ent.name.endsWith('.glb')) jobs.push({ src: p, rel: r });
  }
}
walk(root);

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

for (const { src, rel } of jobs) {
  const dest = path.join(outRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const isChar = rel.startsWith('characters/');
  // Characters: aggressive texture resize + draco
  const tex = isChar ? 512 : 1024;
  const cmd = `npx gltf-transform optimize "${src}" "${dest}" --compress draco --texture-compress webp --texture-size ${tex} --simplify false`;
  console.log('>>', rel);
  try {
    run(cmd);
  } catch {
    // fallback without webp
    try {
      run(`npx gltf-transform optimize "${src}" "${dest}" --compress draco --texture-size ${tex}`);
    } catch (e) {
      console.error('FAIL', rel, e.message);
      fs.copyFileSync(src, dest);
    }
  }
}

let total = 0;
for (const { rel } of jobs) {
  const dest = path.join(outRoot, rel);
  if (fs.existsSync(dest)) total += fs.statSync(dest).size;
}
console.log('TOTAL bytes', total, 'MB', (total / 1024 / 1024).toFixed(2));
