/**
 * Daytime HDRI + soft sun. Bloom/FXAA only when the frame budget allows.
 * Whites must not clip: exposure tuned, wall albedo ≤ ~0.8, no emissive walls.
 * N8AO is intentionally not used — a full-screen AO pass made the town unplayable.
 */
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { publicUrl } from '../util/publicUrl';

export const HDRI_URL = publicUrl('env/kloofendal_43d_clear_puresky_1k.hdr');
export const HDRI_FALLBACK = publicUrl('env/syferfontein_1d_clear_1k.hdr');
export const HDRI_FALLBACK2 = publicUrl('env/kloppenheim_06_puresky_1k.hdr');

export interface LightingRig {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  envReady: Promise<void>;
  applyQuality: (high: boolean) => void;
  applyView: (opts: { shadows: boolean; bloom: boolean; pixelRatio: number }) => void;
  resize: (w: number, h: number) => void;
  render: () => void;
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
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Soft ambient fill — keep low so HDRI + sun do the work
  const hemi = new THREE.HemisphereLight('#c8dff8', '#6a8a58', 0.32);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff2dc', 2.4);
  sun.position.set(35, 55, 18);
  sun.castShadow = false;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  const sc = sun.shadow.camera;
  sc.left = -28;
  sc.right = 28;
  sc.top = 28;
  sc.bottom = -28;
  sc.near = 1;
  sc.far = 160;
  sc.updateProjectionMatrix();
  scene.add(sun, sun.target);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envReady = (async () => {
    const rgbe = new HDRLoader();
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

  // Post stack is created only while bloom is on, so the default path is a single forward render.
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  let fxaa: ShaderPass | null = null;
  let useBloom = false;

  const setupComposer = (w: number, h: number) => {
    composer?.dispose();
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.4, 0.88);
    composer.addPass(bloom);
    fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms['resolution'].value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
    composer.addPass(fxaa);
  };

  let hq = false;
  let indoor = false;

  const syncBloom = () => {
    if (!useBloom) {
      composer?.dispose();
      composer = null;
      bloom = null;
      fxaa = null;
      return;
    }
    if (!composer) {
      setupComposer(
        Math.max(1, renderer.domElement.clientWidth || 1280),
        Math.max(1, renderer.domElement.clientHeight || 800),
      );
    }
    if (bloom) {
      bloom.strength = indoor ? 0.28 : 0.22;
      bloom.threshold = indoor ? 0.78 : 0.88;
      bloom.radius = 0.4;
    }
  };

  return {
    hemi,
    sun,
    envReady,
    setExposure(e) {
      renderer.toneMappingExposure = e;
    },
    setIndoor(on) {
      indoor = on;
      sun.intensity = on ? 0.12 : (hq ? 2.05 : 1.7);
      hemi.intensity = on ? 0.08 : (hq ? 0.28 : 0.38);
      syncBloom();
    },
    applyView(opts) {
      hq = opts.shadows || opts.bloom;
      useBloom = opts.bloom;
      const cap = Math.max(0.7, Math.min(1.5, opts.pixelRatio));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
      renderer.shadowMap.enabled = opts.shadows;
      sun.castShadow = opts.shadows;
      if (!indoor) {
        sun.intensity = opts.shadows ? 2.05 : 1.7;
        hemi.intensity = opts.shadows ? 0.28 : 0.38;
      }
      renderer.toneMappingExposure = opts.shadows ? 0.62 : 0.72;
      scene.backgroundIntensity = opts.shadows ? 0.95 : 0.85;
      scene.environmentIntensity = opts.shadows ? 1.0 : 0.8;
      syncBloom();
    },
    applyQuality(high) {
      this.applyView({
        shadows: high,
        bloom: high,
        pixelRatio: Math.min(window.devicePixelRatio || 1, high ? 1.25 : 1),
      });
    },
    resize(w, h) {
      composer?.setSize(w, h);
      bloom?.resolution.set(w, h);
      fxaa?.material.uniforms['resolution'].value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
    },
    render() {
      if (useBloom && composer) composer.render();
      else renderer.render(scene, camera);
    },
    dispose() {
      composer?.dispose();
      pmrem.dispose();
    },
  };
}
