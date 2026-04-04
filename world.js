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

const CUBE_NEIGHBOR_DIRECTIONS = [
  { q: 1, r: -1, s: 0 },
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
];

function cubeRound(q, r, s) {
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  } else {
    rs = -rq - rr;
  }

  return { q: rq, r: rr, s: rs };
}

function sphereToCube(center, resolution) {
  const q = center[0] * resolution;
  const r = center[2] * resolution;
  const s = -q - r;
  return cubeRound(q, r, s);
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
  const cubeResolution = Math.max(6, Math.floor(Math.sqrt(mesh.vertices.length) / 2));
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
    const baseBiome = hexConfig.terrain.defaultBiome;
    const cube = sphereToCube(center, cubeResolution);

    return {
      id: vertexIndex,
      center,
      normal,
      tangent,
      bitangent,
      cube,
      corners,
      neighbors,
      cubeNeighborDirections: CUBE_NEIGHBOR_DIRECTIONS,
      type,
      isPentagon,
      biome: baseBiome,
      elevation: 0,
      feature,
      hiddenLayers: {
        biomeLayer: {
          tileID: vertexIndex,
          type: baseBiome,
        },
        terrainMesh: {
          tileID: vertexIndex,
          height: 0,
          roughness: 0,
        },
        subTerrain: [],
        fluid: [],
        resources: [],
      },
      chunk: {
        voxels: [],
      },
      addSubTerrain(layer) {
        this.hiddenLayers.subTerrain.push({ tileID: this.id, ...layer });
      },
      addFluid(layer) {
        this.hiddenLayers.fluid.push({ tileID: this.id, ...layer });
      },
      addResource(layer) {
        this.hiddenLayers.resources.push({ tileID: this.id, ...layer });
      },
    };
  });

  tiles.forEach((tile) => {
    hexConfig.terrain.fluidTypes.forEach((fluidType) => {
      tile.addFluid({ type: fluidType, volume: 0 });
    });
    hexConfig.terrain.resourceTypes.forEach((resourceType) => {
      tile.addResource({ type: resourceType, density: 0 });
    });
  });

  return tiles;
}

function buildTriangleNodeGraph(mesh, radius) {
  const normalizedVertices = mesh.vertices.map((v) => vecScale(vecNormalize(v), radius));
  const nodes = mesh.faces.map(([a, b, c], faceIndex) => {
    const centroid = vecScale(
      vecAdd(vecAdd(normalizedVertices[a], normalizedVertices[b]), normalizedVertices[c]),
      1 / 3,
    );

    return {
      id: faceIndex,
      center: vecScale(vecNormalize(centroid), radius),
      neighbors: [],
    };
  });

  const edgeToFaces = new Map();
  mesh.faces.forEach(([a, b, c], faceIndex) => {
    [[a, b], [b, c], [c, a]].forEach(([x, y]) => {
      const key = x < y ? `${x}_${y}` : `${y}_${x}`;
      if (!edgeToFaces.has(key)) {
        edgeToFaces.set(key, []);
      }
      edgeToFaces.get(key).push(faceIndex);
    });
  });

  edgeToFaces.forEach((linkedFaces) => {
    if (linkedFaces.length !== 2) {
      return;
    }
    const [f1, f2] = linkedFaces;
    nodes[f1].neighbors.push(f2);
    nodes[f2].neighbors.push(f1);
  });

  return nodes;
}

function buildDynamicGravityFrame(position) {
  const up = vecNormalize(position);
  const worldUp = Math.abs(up[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const surfaceRight = vecNormalize(vecCross(worldUp, up));
  const surfaceForward = vecNormalize(vecCross(up, surfaceRight));

  return {
    up,
    surfaceRight,
    surfaceForward,
  };
}

function rotateAroundAxis(vector, axis, angle) {
  const k = vecNormalize(axis);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const term1 = vecScale(vector, cosA);
  const term2 = vecScale(vecCross(k, vector), sinA);
  const term3 = vecScale(k, vecDot(k, vector) * (1 - cosA));
  return vecAdd(vecAdd(term1, term2), term3);
}

function buildCameraBasis(position, moveForward, pitch) {
  const frame = buildDynamicGravityFrame(position);
  const { up } = frame;

  const forwardFlatRaw = vecSub(moveForward, vecScale(up, vecDot(moveForward, up)));
  const forwardFlat = vecLength(forwardFlatRaw) > 0.0001 ? vecNormalize(forwardFlatRaw) : frame.surfaceForward;
  const right = vecNormalize(vecCross(forwardFlat, up));
  const forward = vecNormalize(vecAdd(vecScale(forwardFlat, Math.cos(pitch)), vecScale(up, Math.sin(pitch))));
  const cameraUp = vecNormalize(vecCross(right, forward));

  return {
    up,
    forwardFlat,
    forward,
    right,
    cameraUp,
  };
}

function cameraProject(worldPoint, camera, canvas) {
  const rel = vecSub(worldPoint, camera.position);
  const x = vecDot(rel, camera.right);
  const y = vecDot(rel, camera.up);
  const z = vecDot(rel, camera.forward);

  if (z <= 0.02) {
    return null;
  }

  const scale = 550 / z;
  return {
    x: canvas.width * 0.5 + x * scale,
    y: canvas.height * 0.5 - y * scale,
    z,
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

function buildWorldModel(mesh, tiles) {
  const triangleNodes = buildTriangleNodeGraph(mesh, 1);

  return {
    topology: {
      vertices: mesh.vertices,
      faces: mesh.faces,
      triangleNodes,
      tiles,
    },
    geometry: {
      localFrames: tiles.map((tile) => ({
        tileID: tile.id,
        center: tile.center,
        normal: tile.normal,
        tangent: tile.tangent,
        bitangent: tile.bitangent,
      })),
    },
    volumetric: {
      voxelFields: tiles.map((tile) => ({
        tileID: tile.id,
        voxels: tile.chunk.voxels,
        densityField: [],
      })),
    },
    meshing: {
      visibleTriangles: mesh.faces,
    },
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
    `Triangle nodes: ${topology.triangleNodeCount}`,
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

function createMiniMapCamera() {
  const position = vecNormalize([2.4, 1.7, 2.2]);
  const cameraPosition = vecScale(position, 3.2);
  const forward = vecScale(vecNormalize(cameraPosition), -1);
  const worldUp = [0, 1, 0];
  const right = vecNormalize(vecCross(forward, worldUp));
  const up = vecNormalize(vecCross(right, forward));
  return { position: cameraPosition, forward, right, up };
}

function drawMiniMap(minimapCtx, minimapCanvas, tiles, playerPosition) {
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  const miniCamera = createMiniMapCamera();

  const polygons = tiles.map((tile) => {
    const projected = tile.corners
      .map((corner) => cameraProject(corner, miniCamera, minimapCanvas))
      .filter(Boolean);
    if (projected.length < 3) return null;
    const zAverage = projected.reduce((sum, p) => sum + p.z, 0) / projected.length;
    return { tile, projected, zAverage };
  }).filter(Boolean);

  polygons.sort((a, b) => b.zAverage - a.zAverage).forEach((polygon) => {
    minimapCtx.beginPath();
    polygon.projected.forEach((point, index) => {
      if (index === 0) minimapCtx.moveTo(point.x, point.y);
      else minimapCtx.lineTo(point.x, point.y);
    });
    minimapCtx.closePath();
    minimapCtx.fillStyle = polygon.tile.isPentagon ? "#e6b04b" : "#67aa71";
    minimapCtx.fill();
    minimapCtx.strokeStyle = "rgba(0,0,0,0.28)";
    minimapCtx.stroke();
  });

  const playerPoint = cameraProject(vecNormalize(playerPosition), miniCamera, minimapCanvas);
  if (playerPoint) {
    minimapCtx.beginPath();
    minimapCtx.arc(playerPoint.x, playerPoint.y, 4, 0, Math.PI * 2);
    minimapCtx.fillStyle = "#ff4444";
    minimapCtx.fill();
  }
}

function bootWorld() {
  const settings = parseSettings();
  const subdivisions = subdivisionFromSize(settings.size);

  const baseMesh = buildIcosahedron();
  const mesh = subdivideMesh(baseMesh, subdivisions);
  const tiles = buildDualTiles(mesh, 1);
  const worldModel = buildWorldModel(mesh, tiles);
  const topology = validateTopology(mesh, tiles);
  topology.triangleNodeCount = worldModel.topology.triangleNodes.length;

  renderStats(worldModel.topology.tiles, worldModel.topology.faces.length, settings, subdivisions, topology);

  const canvas = document.getElementById("world-canvas");
  const ctx = canvas.getContext("2d");
  const hud = document.getElementById("hud");
  const pauseSidebar = document.getElementById("pause-sidebar");
  const backGameBtn = document.getElementById("back-game-btn");
  const exitWebBtn = document.getElementById("exit-web-btn");
  const exitBtn = document.getElementById("exit-btn");
  const minimapCanvas = document.getElementById("minimap-canvas");
  const minimapCtx = minimapCanvas.getContext("2d");
  const hotbar = document.getElementById("hotbar");

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function renderHotbar(activeSlot) {
    hotbar.innerHTML = "";
    for (let slot = 1; slot <= 9; slot += 1) {
      const slotEl = document.createElement("div");
      slotEl.className = `hotbar-slot${activeSlot === slot ? " active" : ""}`;
      slotEl.textContent = "";
      slotEl.title = `Slot ${slot}`;
      hotbar.appendChild(slotEl);
    }
  }

  const state = {
    keys: { w: false, a: false, s: false, d: false, space: false },
    selectedSlot: 1,
    paused: false,
    turnDelta: 0,
    pitch: 0,
    moveForward: [1, 0, 0],
    player: {
      position: [0, 1.08, 0],
      velocity: [0, 0, 0],
      onGround: false,
    },
  };
  renderHotbar(state.selectedSlot);

  const settingsPhysics = {
    planetRadius: 1,
    playerHeight: 0.08,
    gravity: 3.6,
    moveAccel: 6.2,
    jumpSpeed: 1.2,
    damping: 0.9,
  };

  function isLocked() {
    return document.pointerLockElement === canvas;
  }

  function setPaused(paused) {
    state.paused = paused;
    pauseSidebar.classList.toggle("open", paused);
    if (paused) {
      document.exitPointerLock();
      hud.textContent = "Paused • Escape to resume";
    } else {
      canvas.requestPointerLock();
    }
  }

  backGameBtn.addEventListener("click", () => setPaused(false));
  exitWebBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
  exitBtn.addEventListener("click", () => {
    document.exitPointerLock();
    hud.textContent = "Exited focus • use Exit to Web or close tab";
  });

  document.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      setPaused(!state.paused);
      return;
    }
    if (event.code === "KeyW") state.keys.w = true;
    if (event.code === "KeyA") state.keys.a = true;
    if (event.code === "KeyS") state.keys.s = true;
    if (event.code === "KeyD") state.keys.d = true;
    if (event.code === "Space") {
      state.keys.space = true;
      event.preventDefault();
    }
    if (/^Digit[1-9]$/.test(event.code)) {
      state.selectedSlot = Number(event.code.replace("Digit", ""));
      renderHotbar(state.selectedSlot);
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.code === "KeyW") state.keys.w = false;
    if (event.code === "KeyA") state.keys.a = false;
    if (event.code === "KeyS") state.keys.s = false;
    if (event.code === "KeyD") state.keys.d = false;
    if (event.code === "Space") state.keys.space = false;
  });

  canvas.addEventListener("click", () => {
    if (!isLocked()) {
      canvas.requestPointerLock();
    }
  });

  document.addEventListener("pointerlockchange", () => {
    if (!isLocked() && !state.paused) {
      state.paused = true;
      pauseSidebar.classList.add("open");
    }
    hud.textContent = isLocked()
      ? "Pointer locked • FPS movement + dynamic gravity frame • Space jump • Mouse look"
      : "Click to lock cursor • FPS movement + dynamic gravity frame";
  });

  document.addEventListener("mousemove", (event) => {
    if (!isLocked()) return;
    const sensitivity = 0.0025;
    state.turnDelta -= event.movementX * sensitivity;
    state.pitch += event.movementY * sensitivity;
    state.pitch = Math.max(-1.35, Math.min(1.35, state.pitch));
  });

  function updatePlayer(dt) {
    const up = vecNormalize(state.player.position);
    if (Math.abs(state.turnDelta) > 0.00001) {
      state.moveForward = rotateAroundAxis(state.moveForward, up, state.turnDelta);
      state.turnDelta = 0;
    }

    const basis = buildCameraBasis(state.player.position, state.moveForward, 0);
    let move = [0, 0, 0];

    if (state.keys.w) move = vecAdd(move, basis.forwardFlat);
    if (state.keys.s) move = vecSub(move, basis.forwardFlat);
    if (state.keys.d) move = vecAdd(move, basis.right);
    if (state.keys.a) move = vecSub(move, basis.right);

    if (vecLength(move) > 0) {
      move = vecNormalize(move);
      state.player.velocity = vecAdd(state.player.velocity, vecScale(move, settingsPhysics.moveAccel * dt));
    }

    state.player.velocity = vecAdd(state.player.velocity, vecScale(up, -settingsPhysics.gravity * dt));

    if (state.keys.space && state.player.onGround) {
      state.player.velocity = vecAdd(state.player.velocity, vecScale(up, settingsPhysics.jumpSpeed));
      state.player.onGround = false;
    }

    state.player.position = vecAdd(state.player.position, vecScale(state.player.velocity, dt));

    const distance = vecLength(state.player.position);
    const targetDistance = settingsPhysics.planetRadius + settingsPhysics.playerHeight;
    if (distance <= targetDistance) {
      const correctedUp = vecNormalize(state.player.position);
      state.player.position = vecScale(correctedUp, targetDistance);
      const inwardSpeed = vecDot(state.player.velocity, correctedUp);
      if (inwardSpeed < 0) {
        state.player.velocity = vecSub(state.player.velocity, vecScale(correctedUp, inwardSpeed));
      }
      state.player.onGround = true;
    } else {
      state.player.onGround = false;
    }

    const radial = vecNormalize(state.player.position);
    const radialComponent = vecScale(radial, vecDot(state.player.velocity, radial));
    const tangential = vecSub(state.player.velocity, radialComponent);
    state.player.velocity = vecAdd(radialComponent, vecScale(tangential, settingsPhysics.damping));
  }

  let previousTime = performance.now();
  function draw(time) {
    const dt = Math.min(0.033, (time - previousTime) / 1000);
    previousTime = time;
    if (!state.paused) {
      updatePlayer(dt);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const basis = buildCameraBasis(state.player.position, state.moveForward, state.pitch);
    const camera = {
      position: vecAdd(state.player.position, vecScale(basis.up, 0.02)),
      forward: basis.forward,
      right: basis.right,
      up: basis.cameraUp,
    };

    const polygons = worldModel.topology.tiles.map((tile) => {
      const projected = tile.corners
        .map((corner) => cameraProject(corner, camera, canvas))
        .filter(Boolean);
      if (projected.length < 3) {
        return null;
      }
      const zAverage = projected.reduce((sum, p) => sum + p.z, 0) / projected.length;

      return {
        tile,
        projected,
        zAverage,
      };
    }).filter(Boolean);

    polygons
      .sort((a, b) => b.zAverage - a.zAverage)
      .forEach((polygon) => {
        const shade = Math.max(0.25, Math.min(1, polygon.zAverage / 2.8));
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

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.5 - 7, canvas.height * 0.5);
    ctx.lineTo(canvas.width * 0.5 + 7, canvas.height * 0.5);
    ctx.moveTo(canvas.width * 0.5, canvas.height * 0.5 - 7);
    ctx.lineTo(canvas.width * 0.5, canvas.height * 0.5 + 7);
    ctx.stroke();

    drawMiniMap(minimapCtx, minimapCanvas, worldModel.topology.tiles, state.player.position);

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

bootWorld();
