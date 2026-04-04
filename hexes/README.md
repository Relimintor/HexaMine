# Hexes

- `config.js`: central config/registry for all hex blocks and shared terrain defaults.
- `hex.js`: default block catalog (grass/dirt/stone/sand/etc) registered into `HEX_CONFIG`.
- `hex-types/regular-hex/`: standard 6-neighbor tiles.
- `hex-types/pentagon/`: 5-neighbor defect tiles.
- `hex-types/edge-hex/`: optional edge/trim tiles.
- `hex-types/cities/`: city/special feature tiles.

Add block definitions into the matching `hex-types/*` folder and register them through `HEX_CONFIG.addBlock(...)`.

## Layering model per tile

Each generated tile keeps a layered structure tied to `tile.id`:

- `biomeLayer` (surface biome metadata)
- `terrainMesh` (height/roughness)
- `subTerrain[]` (voxel/mineral/cave entries)
- `fluid[]` (water/lava/etc with volume)
- `resources[]` (resource density records)

## Coordinate model

Tiles include local cube coordinates:

- `tile.cube = { q, r, s }`
- invariant: `q + r + s = 0`
- `tile.cubeNeighborDirections` stores the 6 canonical neighbor offsets.

## Local 3D tile space

Each tile also stores a local basis for simulation and voxel editing:

- `normal` (local up direction)
- `tangent` (local X axis)
- `bitangent` (local Y axis)
- `chunk.voxels[]` for per-tile voxel payloads

## World layer architecture

The viewer organizes runtime data as:

- `topology` → icosphere vertices/faces + tile adjacency/state
- `topology.triangleNodes` → one node per subdivided triangle (`count = faces`)
- `geometry` → local per-tile frames (`center`, `normal`, `tangent`, `bitangent`)
- `volumetric` → per-tile voxel field containers
- `meshing` → visible triangle connectivity for rendering

Movement model:
`movement = standard FPS controller + dynamic gravity frame`.
