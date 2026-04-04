(function bootstrapHexConfig(global) {
  const HEX_TYPES = {
    REGULAR: "regular-hex",
    PENTAGON: "pentagon",
    EDGE: "edge-hex",
    CITY: "cities",
  };

  const config = {
    hexTypes: HEX_TYPES,
    blocks: {
      [HEX_TYPES.REGULAR]: [],
      [HEX_TYPES.PENTAGON]: [],
      [HEX_TYPES.EDGE]: [],
      [HEX_TYPES.CITY]: [],
    },
    terrain: {
      defaultBiome: "grassland",
      elevationRange: { min: -1, max: 1 },
      fluidTypes: ["water", "lava"],
      resourceTypes: ["iron", "coal", "copper", "gold"],
    },
    addBlock(type, block) {
      if (!this.blocks[type]) {
        throw new Error(`Unknown hex type: ${type}`);
      }

      this.blocks[type].push({
        id: block.id ?? `${type}-${this.blocks[type].length}`,
        ...block,
      });
    },
  };

  global.HEX_CONFIG = config;
}(window));
