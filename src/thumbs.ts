import * as THREE from 'three';

/** Renders small pictures of 3D models for menus (shop items, pets), cached by key. */
export class Thumbs {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  private target: THREE.WebGLRenderTarget;
  private cache = new Map<string, string>();
  private canvas = document.createElement('canvas');
  private size: number;

  constructor(private renderer: THREE.WebGLRenderer, size = 128) {
    this.size = size;
    this.target = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace });
    this.canvas.width = this.canvas.height = size;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b0a0c0', 2.2));
    const d = new THREE.DirectionalLight('#ffffff', 1.6);
    d.position.set(3, 5, 4);
    this.scene.add(d);
  }

  get(key: string, make: () => THREE.Object3D, opts: { yaw?: number; pitch?: number; /** Frame this point and radius instead of the whole model (e.g. just the head). */ focus?: { y: number; r: number }; size?: number } = {}): string {
    const hit = this.cache.get(key);
    if (hit) return hit;
    return this.renderObj(key, make(), opts);
  }

  /** Async thumb (e.g. Quaternius outfit preview). Caches like get(). */
  async getAsync(
    key: string,
    make: () => Promise<THREE.Object3D>,
    opts: { yaw?: number; pitch?: number; focus?: { y: number; r: number }; size?: number } = {},
  ): Promise<string> {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const obj = await make();
    return this.renderObj(key, obj, opts);
  }

  private renderObj(
    key: string,
    obj: THREE.Object3D,
    opts: { yaw?: number; pitch?: number; focus?: { y: number; r: number }; size?: number },
  ): string {
    const sz = opts.size ?? this.size;
    const useCustom = sz !== this.size;
    const target = useCustom
      ? new THREE.WebGLRenderTarget(sz, sz, { colorSpace: THREE.SRGBColorSpace })
      : this.target;
    const canvas = useCustom ? document.createElement('canvas') : this.canvas;
    if (useCustom) {
      canvas.width = canvas.height = sz;
    }
    const holder = new THREE.Group();
    holder.add(obj);
    holder.rotation.y = opts.yaw ?? -0.6;
    this.scene.add(holder);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    let radius = Math.max(size.x, size.y, size.z) * 0.62 + 0.05;
    if (opts.focus) {
      center.set(0, opts.focus.y, 0);
      radius = opts.focus.r;
    }
    const dist = radius / Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    const pitch = opts.pitch ?? 0.35;
    this.cam.position.set(center.x, center.y + Math.sin(pitch) * dist, center.z + Math.cos(pitch) * dist);
    this.cam.lookAt(center);
    const prevTarget = this.renderer.getRenderTarget();
    const prevClear = new THREE.Color();
    this.renderer.getClearColor(prevClear);
    const prevAlpha = this.renderer.getClearAlpha();
    const prevShadow = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.cam);
    const px = new Uint8Array(sz * sz * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, sz, sz, px);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(prevClear, prevAlpha);
    this.renderer.shadowMap.enabled = prevShadow;
    this.scene.remove(holder);
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(sz, sz);
    for (let y = 0; y < sz; y++) {
      const src = (sz - 1 - y) * sz * 4;
      img.data.set(px.subarray(src, src + sz * 4), y * sz * 4);
    }
    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    this.cache.set(key, url);
    if (useCustom) target.dispose();
    return url;
  }
}
