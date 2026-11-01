import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Tree } from '@dgreenheck/ez-tree';

const PRESETS = [
  { name: 'oak-a', preset: 'Oak Small', seed: 1201, leaf: 0x5fa84a, bark: 0x6a4a32, scale: 0.18 },
  { name: 'oak-b', preset: 'Oak Medium', seed: 3403, leaf: 0x6bb854, bark: 0x5a3d28, scale: 0.14 },
  { name: 'aspen-a', preset: 'Aspen Small', seed: 5507, leaf: 0x7ac45c, bark: 0xd8d0c0, scale: 0.17 },
  { name: 'aspen-b', preset: 'Aspen Medium', seed: 7709, leaf: 0x58a048, bark: 0xc8c0b0, scale: 0.13 },
  { name: 'pine-a', preset: 'Pine Small', seed: 9911, leaf: 0x4e9a40, bark: 0x5a4030, scale: 0.17 },
  { name: 'pine-b', preset: 'Pine Medium', seed: 1313, leaf: 0x3d7a38, bark: 0x4a3828, scale: 0.13 },
] as const;

function yieldFrame() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()));
}

async function waitTextures(root: THREE.Object3D, ms = 8000) {
  const maps: THREE.Texture[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'alphaMap'] as const) {
        const t = (std as any)[k] as THREE.Texture | undefined;
        if (t) maps.push(t);
      }
    }
  });
  const start = performance.now();
  while (performance.now() - start < ms) {
    if (maps.every((t) => (t.image && (t.image as HTMLImageElement).width > 0) || (t.source?.data && (t.source.data as any).width > 0))) {
      return true;
    }
    await yieldFrame();
  }
  return false;
}

/** Replace materials with export-safe MeshStandardMaterial (valid maps only). */
function sanitizeForExport(root: THREE.Object3D, leafHex: number, barkHex: number) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const isLeaf = /leaf/i.test(m.name) || m === (root as any).leavesMesh;
    const old = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    const map = old?.map;
    const hasMap = !!(map && ((map.image as HTMLImageElement)?.width > 0 || (map.source?.data as any)?.width > 0));
    // Solid PBR only — no leaf maps (keeps GLB free of webp/png decode issues under SwiftShader)
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(isLeaf ? leafHex : barkHex),
      roughness: isLeaf ? 0.78 : 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    m.material = mat;
    m.castShadow = true;
    m.receiveShadow = true;
  });
}

async function exportGlb(root: THREE.Object3D): Promise<string> {
  const exporter = new GLTFExporter();
  const ab = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      root,
      (res) => resolve(res as ArrayBuffer),
      (err) => reject(err),
      { binary: true, onlyVisible: true },
    );
  });
  const bytes = new Uint8Array(ab);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(bin);
}

async function bake() {
  const out: Record<string, string> = {};
  for (const spec of PRESETS) {
    const tree = new Tree();
    try {
      tree.loadPreset(spec.preset);
    } catch (e) {
      console.warn('preset fail', spec.preset, e);
    }
    tree.options.seed = spec.seed;
    tree.options.leaves.tint = spec.leaf;
    tree.options.bark.tint = spec.bark;
    tree.options.bark.textured = true;
    if (tree.options.leaves.count > 48) tree.options.leaves.count = 48;
    // Keep branch complexity moderate for file size
    if (tree.options.branch?.sections) {
      for (const k of Object.keys(tree.options.branch.sections)) {
        const key = Number(k);
        tree.options.branch.sections[key] = Math.min(tree.options.branch.sections[key], 8);
      }
    }
    tree.generate();
    await waitTextures(tree, 12000);
    sanitizeForExport(tree, spec.leaf, spec.bark);
    // Hide trellis if present
    if ((tree as any).trellisMesh) (tree as any).trellisMesh.visible = false;

    const wrap = new THREE.Group();
    wrap.name = spec.name;
    wrap.add(tree);
    wrap.scale.setScalar(spec.scale);
    wrap.updateMatrixWorld(true);
    out[spec.name] = await exportGlb(wrap);
    console.log('baked', spec.name, Math.round(out[spec.name].length / 1024), 'KB b64');
    await yieldFrame();
  }
  (window as any).__baked = out;
  (window as any).__bakeDone = true;
  document.title = 'bake-done';
  document.body.textContent = 'bake-done ' + Object.keys(out).join(',');
}

bake().catch((e) => {
  console.error(e);
  (window as any).__bakeError = String(e?.stack || e);
  (window as any).__bakeDone = true;
});
