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
| `buildings/building-*.glb`, skyscrapers | [Kenney City Kit Commercial](https://kenney.nl/assets/city-kit-commercial) | CC0 | Optional scenery (disabled for main plaza façades — custom arch used) |
| `buildings/building-type-*.glb`, planter | [Kenney City Kit Suburban](https://kenney.nl/assets/city-kit-suburban) | CC0 | Near home plots |
| `street/*.glb` | Quaternius Street Pack | CC0 | Street lights / traffic light |

## Animals

| File(s) | Source | License | Notes |
|---|---|---|---|
| `animals/husky.glb`, `shibainu.glb`, `pug.glb`, `fox.glb`, `wolf.glb`, `deer.glb` | [Quaternius Animals Pack](https://quaternius.com/) | CC0 | Dog/cat/fox pets; robot dog remains procedural |

## Nature

| File(s) | Source | License | Notes |
|---|---|---|---|
| `nature/tree_*.glb`, bushes, flowers | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | CC0 | Optional; procedural `buildNaturalTree` used for vertical slice |

## Furniture (interiors)

| File(s) | Source | License | Notes |
|---|---|---|---|
| `furniture/*.glb` | Quaternius Ultimate House Interior Pack (June 2020) | CC0 | Sofas, beds, kitchen, plants, lights |
| `furniture2/*.glb` | Quaternius Furniture Pack (March 2019) | CC0 | Extra sofa/table/closet variants |
| `scifi/props-*.glb` | Quaternius Ultimate Modular Sci-Fi | CC0 | Computer / pod accents |

## Runtime

- Loader: `three/examples/jsm/loaders/GLTFLoader` + Draco decoder (Google gstatic)
- Lazy-loaded / prefetched; procedural primitives remain as sync fallback for tests and offline failures

## Procedural (authored in-repo, no third-party models)

| Module | Notes |
|---|---|
| `src/three/futuristicArch.ts` | Curved white+wood+glass shops, sleek fountain, paving/grass/wood textures, natural trees, skyline towers, planters, benches |
| `src/three/vehicles.ts` | Custom low/wide hover-cars with glass canopy + thrusters (Kenney cars no longer primary) |
