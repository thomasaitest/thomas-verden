/**
 * Standalone tree material lab against a dark backdrop.
 * Compares ez hardened leaf cards vs procedural spheres, bloom on/off.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4750/';
const out = process.argv[3] ?? '/workspace/thomas-verden-shots/v5/tree-lab';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForFunction(() => !!window.__hv, null, { timeout: 120000 });
await page.evaluate(async () => {
  const g = window.__hv;
  await g.assetsReady;
  // unregister SW already done by reload path; settle
  await new Promise((r) => setTimeout(r, 1500));
});

async function shoot(name, { bloom }) {
  await page.evaluate(({ bloom }) => {
    const g = window.__hv;
    g.lighting?.applyQuality?.(bloom);
    g.lighting?.setExposure?.(0.58);
    g.paused = false;
    // Steal THREE from any mesh
    let THREE = null;
    g.scene.traverse((o) => {
      if (THREE) return;
      if (o.isMesh && o.material) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        THREE = m.constructor.name ? o.material.constructor : null;
        // better: get from geometry
        if (o.geometry?.type) {
          // access via global not available — reconstruct from prototypes
        }
      }
    });
    // Use game's module: clone an existing town tree into a lab rig
    // Hide town, add dark stage
    if (g.town?.group) g.town.group.visible = false;
    if (g.interior?.group) g.interior.group.visible = false;

    // Remove previous lab
    const old = g.scene.getObjectByName('__treeLab');
    if (old) g.scene.remove(old);

    // Find THREE via renderer / shared
    const anyMesh = (() => {
      let hit = null;
      g.scene.traverse((o) => { if (!hit && o.isMesh) hit = o; });
      return hit;
    })();
    const BoxGeometry = anyMesh.geometry.constructor;
    // Can't easily get THREE namespace — build lab from cloned trees in town before hide
  }, { bloom });

  // Better approach from node side: use exposed helpers
  await page.evaluate(({ bloom }) => {
    const g = window.__hv;
    g.lighting?.applyQuality?.(!!bloom);
    g.lighting?.setExposure?.(0.58);

    // Make town invisible except we pull tree clones
    const labParent = g.scene.getObjectByName('__treeLab');
    if (labParent) g.scene.remove(labParent);

    // Collect a few trees from town
    const trees = [];
    g.town?.group?.traverse?.((o) => {
      if (o.userData?.ezTree || o.userData?.treeKind !== undefined) {
        if (o.parent === g.town.group || o.parent?.parent === g.town.group) trees.push(o);
      }
    });
    // Also match by name
    g.town?.group?.children?.forEach?.((c) => {
      if (c.name?.startsWith?.('ez-') || c.userData?.ezTree) trees.push(c);
    });

    // Walk all groups looking for ez-
    const found = [];
    g.town?.group?.traverse?.((o) => {
      if (o.name && o.name.startsWith('ez-') && o.parent) found.push(o);
    });

    // Build dark backdrop using cloned materials from scene
    let darkMat = null;
    let greenCheck = null;
    g.scene.traverse((o) => {
      if (o.isMesh && o.material && !darkMat) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m?.clone) {
          darkMat = m.clone();
          if (darkMat.color) darkMat.color.set('#101418');
          if ('map' in darkMat) darkMat.map = null;
          if ('emissive' in darkMat) darkMat.emissive?.set?.('#000000');
          if ('envMapIntensity' in darkMat) darkMat.envMapIntensity = 0;
        }
      }
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m?.type === 'MeshBasicMaterial' && m.toneMapped === false && m.color) {
            const hex = m.color.getHexString?.();
            // leaf-like
            if (m.map || (hex && hex.match(/^2|^3|^4/))) greenCheck = m;
          }
        }
      }
    });

    // Position camera toward a known roadside tree cluster
    g.mode = 'town';
    g.town.group.visible = true;
    g.player.pos.set(8.5, 0, 20);
    g.player.yaw = Math.PI;
    g.cam.yaw = Math.PI;
    g.cam.pitch = 0.18;
    g.cam.dist = 9;
    // Darken sky intensity to reduce wash for bloom-off compare
    if (!bloom) {
      g.scene.backgroundIntensity = 0.35;
      g.scene.environmentIntensity = 0.25;
    } else {
      g.scene.backgroundIntensity = 1.15;
      g.scene.environmentIntensity = 1.05;
    }
    // Count leaf materials
    let basicLeaves = 0, stdLeaves = 0, whiteBase = 0;
    g.town.group.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.type === 'MeshBasicMaterial' && m.toneMapped === false) basicLeaves++;
        if (m.type === 'MeshStandardMaterial' || m.type === 'MeshPhysicalMaterial') {
          stdLeaves++;
          if (m.color && (m.color.r + m.color.g + m.color.b) / 3 > 0.85) whiteBase++;
        }
      }
    });
    window.__treeLabStats = { basicLeaves, stdLeaves, whiteBase, found: found.length, bloom };
  }, { bloom });

  const stats = await page.evaluate(() => window.__treeLabStats);
  console.log(name, stats);
  await page.waitForTimeout(1200);
  // Render a few frames
  await page.evaluate(async () => {
    for (let i = 0; i < 8; i++) {
      window.__hv.tick?.(0.016);
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  await page.screenshot({ path: `${out}/${name}.png`, type: 'png' });
}

await shoot('ez-bloom-off', { bloom: false });
await shoot('ez-bloom-on', { bloom: true });

// Extreme close-up on one canopy
await page.evaluate(() => {
  const g = window.__hv;
  g.player.pos.set(7.2, 0, 18.5);
  g.cam.yaw = Math.PI * 0.92;
  g.cam.pitch = 0.35;
  g.cam.dist = 4.5;
  g.lighting?.applyQuality?.(true);
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/ez-canopy-close.png`, type: 'png' });

console.log('wrote', out);
await browser.close();
