export function buildIcosphereTopology(subdivisionLevel = 0) {
  const safeSubdivision = Math.max(0, Number(subdivisionLevel) || 0);
  const frequency = 2 ** safeSubdivision;

  const triangleFaces = 20 * frequency * frequency;
  const totalCells = 10 * frequency * frequency + 2;
  const pentagonCells = 12;
  const hexagonCells = Math.max(0, totalCells - pentagonCells);

  return {
    subdivisionLevel: safeSubdivision,
    frequency,
    triangleFaces,
    totalCells,
    pentagonCells,
    hexagonCells,
  };
}

export function mapSizeToSubdivision(size) {
  switch (size) {
    case "tiny":
      return 1;
    case "medium":
      return 2;
    case "large":
      return 3;
    case "colossal":
      return 4;
    default:
      return 2;
  }
}
