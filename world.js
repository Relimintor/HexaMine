function vecAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function getHexConfig() {
  const fallback = {
    hexTypes: {
      REGULAR: "regular-hex",
      PENTAGON: "pentagon",
      EDGE: "edge-hex",
      CITY: "cities",
    },
    blocks: {
      "regular-hex": [],
      pentagon: [],
      "edge-hex": [],
      cities: [],
    },
    terrain: {
      defaultBiome: "grassland",
      elevationRange: { min: -1, max: 1 },
      fluidTypes: [],
      resourceTypes: [],
    },
  };

  if (typeof window !== "undefined" && window.HEX_CONFIG) {
    return window.HEX_CONFIG;
  }

  return fallback;
}

function vecScale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vecLength(v) {
  return Math.sqrt(vecDot(v, v));
}

function vecNormalize(v) {
  const length = vecLength(v);
  if (!length) {
    return [0, 0, 0];
  }
  return vecScale(v, 1 / length);
}

function triangleCircumcenter(a, b, c, radius) {
  const u = vecSub(b, a);
  const v = vecSub(c, a);
  const w = vecCross(u, v);
  const denominator = 2 * vecDot(w, w);

  if (denominator === 0) {
    const centroid = vecScale(vecAdd(vecAdd(a, b), c), 1 / 3);
    return vecScale(vecNormalize(centroid), radius);
  }

  const uLen2 = vecDot(u, u);
  const vLen2 = vecDot(v, v);
  const term1 = vecScale(vecCross(w, u), vLen2);
  const term2 = vecScale(vecCross(v, w), uLen2);
  const offset = vecScale(vecAdd(term1, term2), 1 / denominator);
  const center = vecAdd(a, offset);

  return vecScale(vecNormalize(center), radius);
}

function buildIcosahedron() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1],
  ].map((v) => vecNormalize(v));

  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  return { vertices, faces };
}

function subdivideMesh(mesh, subdivisions) {
  const vertices = [...mesh.vertices];
  let faces = [...mesh.faces];

  for (let level = 0; level < subdivisions; level += 1) {
    const midpointCache = new Map();
    const nextFaces = [];

    function getMidpointIndex(a, b) {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const existing = midpointCache.get(key);
      if (existing !== undefined) {
        return existing;
      }

      const midpoint = vecNormalize(vecScale(vecAdd(vertices[a], vertices[b]), 0.5));
      const index = vertices.length;
      vertices.push(midpoint);
      midpointCache.set(key, index);
      return index;
    }

    faces.forEach(([a, b, c]) => {
      const ab = getMidpointIndex(a, b);
      const bc = getMidpointIndex(b, c);
      const ca = getMidpointIndex(c, a);

      nextFaces.push([a, ab, ca]);
      nextFaces.push([b, bc, ab]);
      nextFaces.push([c, ca, bc]);
      nextFaces.push([ab, bc, ca]);
    });

    faces = nextFaces;
  }

  return { vertices, faces };
}

function buildDualTiles(mesh, radius) {
  const hexConfig = getHexConfig();
  const cityTileIds = new Set((hexConfig.blocks[hexConfig.hexTypes.CITY] || []).map((block) => block.id));
  const normalizedVertices = mesh.vertices.map((v) => vecScale(vecNormalize(v), radius));
  const faceCenters = mesh.faces.map(([a, b, c]) => {
    return triangleCircumcenter(
      normalizedVertices[a],
      normalizedVertices[b],
      normalizedVertices[c],
      radius,
    );
  });

  const vertexFaces = Array.from({ length: normalizedVertices.length }, () => []);
  const vertexNeighbors = Array.from({ length: normalizedVertices.length }, () => new Set());

  mesh.faces.forEach(([a, b, c], faceIndex) => {
    vertexFaces[a].push(faceIndex);
    vertexFaces[b].push(faceIndex);
    vertexFaces[c].push(faceIndex);

    vertexNeighbors[a].add(b);
    vertexNeighbors[a].add(c);
    vertexNeighbors[b].add(a);
    vertexNeighbors[b].add(c);
    vertexNeighbors[c].add(a);
    vertexNeighbors[c].add(b);
  });

  const tiles = normalizedVertices.map((center, vertexIndex) => {
    const normal = vecNormalize(center);
    const up = Math.abs(normal[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const tangent = vecNormalize(vecCross(up, normal));
    const bitangent = vecNormalize(vecCross(normal, tangent));

    const corners = vertexFaces[vertexIndex]
      .map((faceIndex) => faceCenters[faceIndex])
      .sort((a, b) => {
        const aProj = vecNormalize(vecSub(a, vecScale(normal, vecDot(a, normal))));
        const bProj = vecNormalize(vecSub(b, vecScale(normal, vecDot(b, normal))));

        const aAngle = Math.atan2(vecDot(aProj, bitangent), vecDot(aProj, tangent));
        const bAngle = Math.atan2(vecDot(bProj, bitangent), vecDot(bProj, tangent));
        return aAngle - bAngle;
      });

    const neighbors = [...vertexNeighbors[vertexIndex]];
    const isPentagon = neighbors.length === 5;
    const type = isPentagon ? hexConfig.hexTypes.PENTAGON : hexConfig.hexTypes.REGULAR;
    const feature = cityTileIds.has(vertexIndex) ? "city" : null;

    return {
      id: vertexIndex,
      center,
      corners,
      neighbors,
      type,
      isPentagon,
      biome: hexConfig.terrain.defaultBiome,
      elevation: 0,
      feature,
      hiddenLayers: {
        subTerrain: [],
        fluid: [...hexConfig.terrain.fluidTypes],
        resources: [...hexConfig.terrain.resourceTypes],
      },
    };
  });

  return tiles;
}

function rotateY(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

function rotateX(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function project(v, canvas) {
  const cameraDistance = 3.2;
  const depth = v[2] + cameraDistance;
  const scale = 420 / depth;
  return {
    x: canvas.width * 0.5 + v[0] * scale,
    y: canvas.height * 0.5 - v[1] * scale,
    z: v[2],
  };
}

function parseSettings() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name") || "New World";
  const seed = params.get("seed") || "random";
  const size = params.get("size") || "large";
  const terrain = params.get("terrain") || "earthlike";
  return { name, seed, size, terrain };
}

function subdivisionFromSize(size) {
  switch (size) {
    case "tiny":
      return 1;
    case "medium":
      return 3;
    case "giant":
      return 5;
    case "collosal":
    case "colossal":
      return 10;
    case "large":
    default:
      return 3;
  }
}

function countUniqueEdges(faces) {
  const edges = new Set();
  faces.forEach(([a, b, c]) => {
    const pairs = [[a, b], [b, c], [c, a]];
    pairs.forEach(([x, y]) => {
      const key = x < y ? `${x}_${y}` : `${y}_${x}`;
      edges.add(key);
    });
  });
  return edges.size;
}

function validateTopology(mesh, tiles) {
  const euler = mesh.vertices.length - countUniqueEdges(mesh.faces) + mesh.faces.length;
  const pentagons = tiles.filter((tile) => tile.isPentagon).length;
  const invalidTiles = tiles.filter((tile) => tile.neighbors.length !== 5 && tile.neighbors.length !== 6).length;

  return {
    euler,
    pentagons,
    invalidTiles,
    isValid: euler === 2 && pentagons === 12 && invalidTiles === 0,
  };
}

function renderStats(tiles, facesCount, settings, subdivisions, topology) {
  const pentagons = tiles.filter((tile) => tile.isPentagon).length;
  const hexagons = tiles.filter((tile) => tile.neighbors.length === 6).length;

  document.getElementById("world-title").textContent = settings.name;
  document.getElementById("world-settings").textContent =
    `Seed: ${settings.seed} • Size: ${settings.size} • Terrain: ${settings.terrain}`;

  const stats = [
    `Subdivisions: ${subdivisions}`,
    `Triangles: ${facesCount}`,
    `Total tiles: ${tiles.length}`,
    `Pentagons: ${pentagons}`,
    `Hexagons: ${hexagons}`,
  ];

  document.getElementById("world-stats").innerHTML = stats
    .map((line) => `<li>${line}</li>`)
    .join("");

  const topologyStatus = document.getElementById("topology-status");
  if (topology.isValid) {
    topologyStatus.textContent = `Topology OK — Euler: ${topology.euler}, pentagons: ${topology.pentagons}.`;
    topologyStatus.style.color = "#8ee7a2";
    return;
  }

  topologyStatus.textContent = `Topology mismatch — Euler: ${topology.euler}, pentagons: ${topology.pentagons}, invalid tiles: ${topology.invalidTiles}.`;
  topologyStatus.style.color = "#ff8f8f";
}

function bootWorld() {
  const settings = parseSettings();
  const subdivisions = subdivisionFromSize(settings.size);

  const baseMesh = buildIcosahedron();
  const mesh = subdivideMesh(baseMesh, subdivisions);
  const tiles = buildDualTiles(mesh, 1);
  const topology = validateTopology(mesh, tiles);

  renderStats(tiles, mesh.faces.length, settings, subdivisions, topology);

  const canvas = document.getElementById("world-canvas");
  const ctx = canvas.getContext("2d");

  function draw(time) {
    const angle = time * 0.00025;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const polygons = tiles.map((tile) => {
      const rotatedCorners = tile.corners.map((corner) => rotateX(rotateY(corner, angle), -0.35));
      const projected = rotatedCorners.map((point) => project(point, canvas));
      const zAverage = rotatedCorners.reduce((sum, p) => sum + p[2], 0) / rotatedCorners.length;

      return {
        tile,
        projected,
        zAverage,
      };
    });

    polygons
      .filter((polygon) => polygon.zAverage > -0.65)
      .sort((a, b) => a.zAverage - b.zAverage)
      .forEach((polygon) => {
        const shade = Math.max(0.2, Math.min(0.95, (polygon.zAverage + 1.2) / 2.3));
        ctx.beginPath();
        polygon.projected.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.closePath();

        if (polygon.tile.isPentagon) {
          ctx.fillStyle = `rgba(252, 201, 92, ${shade})`;
        } else {
          ctx.fillStyle = `rgba(101, 196, 129, ${shade})`;
        }

        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

bootWorld();
