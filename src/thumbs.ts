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

  get(key: string, make: () => THREE.Object3D, opts: { yaw?: number; pitch?: number; /** Frame this point and radius instead of the whole model (e.g. just the head). */ focus?: { y: number; r: number } } = {}): string {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const obj = make();
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
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.cam);
    const px = new Uint8Array(this.size * this.size * 4);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, this.size, this.size, px);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(prevClear, prevAlpha);
    this.renderer.shadowMap.enabled = prevShadow;
    this.scene.remove(holder);
    const ctx = this.canvas.getContext('2d')!;
    const img = ctx.createImageData(this.size, this.size);
    // flip vertically
    for (let y = 0; y < this.size; y++) {
      const src = (this.size - 1 - y) * this.size * 4;
      img.data.set(px.subarray(src, src + this.size * 4), y * this.size * 4);
    }
    ctx.putImageData(img, 0, 0);
    const url = this.canvas.toDataURL('image/png');
    this.cache.set(key, url);
    return url;
  }
}
