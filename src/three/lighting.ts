/**
 * Daytime HDRI + soft sun + HQ post (N8AO / SMAA / mild bloom).
 * Whites must not clip: exposure tuned, wall albedo ≤ ~0.8, no emissive walls.
 */
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { N8AOPass } from 'n8ao';

export const HDRI_URL = '/env/kloofendal_43d_clear_puresky_1k.hdr';
export const HDRI_FALLBACK = '/env/syferfontein_1d_clear_1k.hdr';
export const HDRI_FALLBACK2 = '/env/kloppenheim_06_puresky_1k.hdr';

export interface LightingRig {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  envReady: Promise<void>;
  applyQuality: (high: boolean) => void;
  resize: (w: number, h: number) => void;
  render: (high: boolean) => void;
  setExposure: (e: number) => void;
  setIndoor: (on: boolean) => void;
  dispose: () => void;
}

export function createLighting(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): LightingRig {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.62;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Soft ambient fill — keep low so HDRI + sun do the work
  const hemi = new THREE.HemisphereLight('#c8dff8', '#6a8a58', 0.32);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff2dc', 2.4);
  sun.position.set(35, 55, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  const sc = sun.shadow.camera;
  sc.left = -55;
  sc.right = 55;
  sc.top = 55;
  sc.bottom = -55;
  sc.near = 1;
  sc.far = 160;
  sc.updateProjectionMatrix();
  scene.add(sun, sun.target);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envReady = (async () => {
    const rgbe = new RGBELoader();
    const tryUrl = async (url: string) =>
      new Promise<THREE.DataTexture>((resolve, reject) => {
        rgbe.load(url, resolve, undefined, reject);
      });
    let tex: THREE.DataTexture | null = null;
    for (const url of [HDRI_URL, HDRI_FALLBACK, HDRI_FALLBACK2]) {
      try {
        tex = await tryUrl(url);
        break;
      } catch {
        /* next */
      }
    }
    if (!tex) return;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const env = pmrem.fromEquirectangular(tex).texture;
    scene.environment = env;
    // Solid sky — HDRI as background blows to pure white behind tree silhouettes (reads as white canopies)
    scene.background = new THREE.Color('#87b7e0');
    scene.backgroundBlurriness = 0.0;
    scene.backgroundIntensity = 1.0;
    scene.environmentIntensity = 1.0;
    tex.dispose();
  })();

  // Post stack (three EffectComposer + N8AOPass)
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  let n8: InstanceType<typeof N8AOPass> | null = null;
  let fxaa: ShaderPass | null = null;

  const setupComposer = (w: number, h: number) => {
    composer?.dispose();
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    try {
      n8 = new N8AOPass(scene, camera, w, h);
      // Tuned for soft contact AO without darkening whites too hard
      (n8 as any).configuration.aoRadius = 1.8;
      (n8 as any).configuration.distanceFalloff = 1.0;
      (n8 as any).configuration.intensity = 1.35;
      (n8 as any).configuration.color = new THREE.Color(0x000000);
      composer.addPass(n8 as any);
    } catch {
      n8 = null;
    }
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.0, 0.4, 0.92);
    composer.addPass(bloom);
    fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms['resolution'].value.set(1 / w, 1 / h);
    composer.addPass(fxaa);
  };

  setupComposer(
    Math.max(1, renderer.domElement.clientWidth || 1280),
    Math.max(1, renderer.domElement.clientHeight || 800),
  );

  let hq = true;
  let indoor = false;

  return {
    hemi,
    sun,
    envReady,
    setExposure(e) {
      renderer.toneMappingExposure = e;
    },
    setIndoor(on) {
      indoor = on;
      sun.intensity = on ? 0.12 : (hq ? 2.2 : 1.7);
      hemi.intensity = on ? 0.08 : (hq ? 0.25 : 0.35);
      if (bloom) {
        // Outdoor bloom OFF — any bloom was bleaching MeshBasic greens to white blobs
        bloom.strength = on ? 0.28 : 0.0;
        bloom.threshold = on ? 0.75 : 1.0;
      }
    },
    applyQuality(high) {
      hq = high;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1.15));
      renderer.shadowMap.enabled = high;
      sun.castShadow = high;
      if (!indoor) {
        sun.intensity = high ? 2.2 : 1.7;
        hemi.intensity = high ? 0.25 : 0.35;
      }
      renderer.toneMappingExposure = high ? 0.62 : 0.72;
      if (bloom) {
        bloom.strength = high ? (indoor ? 0.28 : 0.0) : 0.0;
        bloom.threshold = high ? (indoor ? 0.75 : 1.0) : 1.0;
        bloom.radius = 0.4;
      }
      if (n8) (n8 as any).enabled = high;
      if (fxaa) fxaa.enabled = high;
      scene.backgroundIntensity = high ? 0.95 : 0.85;
      scene.environmentIntensity = high ? 1.05 : 0.8;
    },
    resize(w, h) {
      composer?.setSize(w, h);
      bloom?.resolution.set(w, h);
      fxaa?.material.uniforms['resolution'].value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
      try {
        (n8 as any)?.setSize?.(w, h);
      } catch {
        /* */
      }
    },
    render(high) {
      if (high && composer) composer.render();
      else renderer.render(scene, camera);
    },
    dispose() {
      composer?.dispose();
      pmrem.dispose();
    },
  };
}
