# Hexes

- `config.js`: central config/registry for all hex blocks and shared terrain defaults.
- `hex-types/regular-hex/`: standard 6-neighbor tiles.
- `hex-types/pentagon/`: 5-neighbor defect tiles.
- `hex-types/edge-hex/`: optional edge/trim tiles.
- `hex-types/cities/`: city/special feature tiles.

Add block definitions into the matching `hex-types/*` folder and register them through `HEX_CONFIG.addBlock(...)`.
