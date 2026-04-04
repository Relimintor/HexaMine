(function registerDefaultHexBlocks(global) {
  const config = global.HEX_CONFIG;
  if (!config) {
    throw new Error("HEX_CONFIG must be loaded before hexes/hex.js");
  }

  const blocks = [
    {
      type: config.hexTypes.REGULAR,
      id: "grass-hex",
      name: "Grass Hex",
      material: "grass",
      biome: "grassland",
      colorTop: "#6dc76d",
      colorSide: "#6a4a2d",
      hardness: 1,
    },
    {
      type: config.hexTypes.REGULAR,
      id: "dirt-hex",
      name: "Dirt Hex",
      material: "dirt",
      biome: "temperate",
      colorTop: "#8c6a45",
      colorSide: "#5f442a",
      hardness: 1,
    },
    {
      type: config.hexTypes.REGULAR,
      id: "stone-hex",
      name: "Stone Hex",
      material: "stone",
      biome: "mountain",
      colorTop: "#8f9399",
      colorSide: "#63666b",
      hardness: 3,
    },
    {
      type: config.hexTypes.REGULAR,
      id: "sand-hex",
      name: "Sand Hex",
      material: "sand",
      biome: "desert",
      colorTop: "#d1be72",
      colorSide: "#9a8c53",
      hardness: 1,
    },
    {
      type: config.hexTypes.PENTAGON,
      id: "core-pentagon-hex",
      name: "Core Pentagon",
      material: "core",
      biome: "special",
      colorTop: "#73965d",
      colorSide: "#66452b",
      hardness: 4,
    },
  ];

  blocks.forEach((block) => {
    config.addBlock(block.type, block);
  });
}(window));
