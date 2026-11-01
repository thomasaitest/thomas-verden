# Third-party 3D assets (Thomas-verden)

All models below are **CC0 / public domain**. No attribution required; credited here for provenance.

Compressed copies live in `public/models/` (Draco + resized textures via `@gltf-transform/cli`).
Raw downloads (not shipped) are under `vendor/raw/` (gitignored if large).

## Characters (rigged + animated)

| File(s) | Source | License | Notes |
|---|---|---|---|
| `characters/m-*.glb`, `characters/w-*.glb` | [Quaternius Ultimate Modular Men / Women](https://quaternius.com/) via [gamedev.trebeljahr.com mirror](https://gamedev.trebeljahr.com/quaternius) | CC0 | Idle/Walk/Run/Wave clips embedded; recolored at runtime |

## Vehicles

| File(s) | Source | License | Notes |
|---|---|---|---|
| `cars/*.glb` | [Kenney Car Kit](https://kenney.nl/assets/car-kit) (OpenGameArt mirror) | CC0 | Hovered in-game (lift + thrusters + glass canopy); wheels hidden |

## Buildings & props

| File(s) | Source | License | Notes |
|---|---|---|---|
| `buildings/building-*.glb`, skyscrapers | [Kenney City Kit Commercial](https://kenney.nl/assets/city-kit-commercial) | CC0 | Plaza / skyline props |
| `buildings/building-type-*.glb`, planter | [Kenney City Kit Suburban](https://kenney.nl/assets/city-kit-suburban) | CC0 | Near home plots |
| `street/*.glb` | Quaternius Street Pack | CC0 | Street lights / traffic light |

## Nature

| File(s) | Source | License | Notes |
|---|---|---|---|
| `nature/tree_*.glb`, bushes, flowers | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | CC0 | Replaces candy sphere trees where loaded |

## Furniture (interiors)

| File(s) | Source | License | Notes |
|---|---|---|---|
| `furniture/*.glb` | Quaternius Ultimate House Interior Pack (June 2020) | CC0 | Sofas, beds, kitchen, plants, lights |
| `furniture2/*.glb` | Quaternius Furniture Pack (March 2019) | CC0 | Extra sofa/table/closet variants |
| `scifi/props-*.glb` | Quaternius Ultimate Modular Sci-Fi | CC0 | Computer / pod accents |

## Runtime

- Loader: `three/examples/jsm/loaders/GLTFLoader` + Draco decoder (Google gstatic)
- Lazy-loaded / prefetched; procedural primitives remain as sync fallback for tests and offline failures
