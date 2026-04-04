const ACTIVE_KEYS = new Set();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rotateY(point, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: point.x * c - point.z * s,
    y: point.y,
    z: point.x * s + point.z * c,
  };
}

function rotateX(point, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: point.x,
    y: point.y * c - point.z * s,
    z: point.y * s + point.z * c,
  };
}

function drawPolygon(ctx, x, y, radius, sides, rotation = Math.PI / 6) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = ((Math.PI * 2) / sides) * i + rotation;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len,
  };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cellDensityFromSize(size) {
  switch (size) {
    case "tiny":
      return 72;
    case "medium":
      return 162;
    case "large":
      return 320;
    case "colossal":
      return 642;
    default:
      return 162;
  }
}

function tileScaleFromCellCount(totalCells) {
  const areaPerCell = (4 * Math.PI) / Math.max(1, totalCells);
  const radius = Math.sqrt(areaPerCell / (3 * Math.sqrt(3)));
  return clamp(radius, 0.03, 0.11);
}

function buildPlanetCells(topology, size) {
  const total = Math.max(topology?.totalCells || 0, cellDensityFromSize(size));
  const golden = (1 + Math.sqrt(5)) / 2;
  const cells = [];
  for (let i = 0; i < total; i += 1) {
    const t = (i + 0.5) / total;
    const y = 1 - 2 * t;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = 2 * Math.PI * i / golden;
    cells.push({
      normal: {
        x: Math.cos(theta) * radius,
        y,
        z: Math.sin(theta) * radius,
      },
      isPentagon: false,
    });
  }

  const phi = (1 + Math.sqrt(5)) / 2;
  const icoSeeds = [
    { x: -1, y: phi, z: 0 },
    { x: 1, y: phi, z: 0 },
    { x: -1, y: -phi, z: 0 },
    { x: 1, y: -phi, z: 0 },
    { x: 0, y: -1, z: phi },
    { x: 0, y: 1, z: phi },
    { x: 0, y: -1, z: -phi },
    { x: 0, y: 1, z: -phi },
    { x: phi, y: 0, z: -1 },
    { x: phi, y: 0, z: 1 },
    { x: -phi, y: 0, z: -1 },
    { x: -phi, y: 0, z: 1 },
  ].map(normalize);

  const used = new Set();
  for (const seed of icoSeeds) {
    let bestIndex = -1;
    let bestDot = -Infinity;
    for (let i = 0; i < cells.length; i += 1) {
      if (used.has(i)) continue;
      const d = dot(seed, cells[i].normal);
      if (d > bestDot) {
        bestDot = d;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      cells[bestIndex].isPentagon = true;
    }
  }

  const tileRadius = tileScaleFromCellCount(total);
  const tileHeight = clamp(tileRadius * 0.55, 0.014, 0.05);
  for (const cell of cells) {
    cell.tileRadius = cell.isPentagon ? tileRadius * 1.06 : tileRadius;
    cell.tileHeight = cell.isPentagon ? tileHeight * 1.15 : tileHeight;
  }

  return cells;
}

function projectPoint(point, camera, width, height, focal) {
  const rel = {
    x: point.x - camera.position.x,
    y: point.y - camera.position.y,
    z: point.z - camera.position.z,
  };

  const view = {
    x: dot(rel, camera.right),
    y: dot(rel, camera.up),
    z: dot(rel, camera.forward),
  };

  if (view.z <= 0.08) return null;
  return {
    x: width * 0.5 + (view.x / view.z) * focal,
    y: height * 0.56 - (view.y / view.z) * focal,
    z: view.z,
  };
}

export function createGameSession() {
  const PLAYER_HEIGHT_IN_HEXES = 2;
  const PLANET_OUTER_RADIUS = 1;
  const PLANET_INNER_AIR_RADIUS = 0.7;
  const sessionRoot = document.querySelector("#game-session");
  const canvas = document.querySelector("#game-canvas");
  const infoNode = document.querySelector("#game-info");
  const leaveButton = document.querySelector("#leave-world");
  const ctx = canvas.getContext("2d");

  let animationFrame;
  let running = false;
  let world;
  let planetCells = [];
  let sunAngle = 0;
  let lookYaw = 0;
  let lookPitch = 0;
  let cameraZoom = 0;
  let cameraDetached = false;

  const player = {
    longitude: 0,
    latitude: 0,
    radialOffset: 0,
    jumpVelocity: 0,
  };

  function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  function updatePhysics() {
    const forward = ACTIVE_KEYS.has("w") || ACTIVE_KEYS.has("arrowup");
    const backward = ACTIVE_KEYS.has("s") || ACTIVE_KEYS.has("arrowdown");
    const left = ACTIVE_KEYS.has("a");
    const right = ACTIVE_KEYS.has("d");
    const jumpOrUp = ACTIVE_KEYS.has(" ") || ACTIVE_KEYS.has("space");
    const down = ACTIVE_KEYS.has("shift") || ACTIVE_KEYS.has("control");

    const moveSpeed = 0.02;

    let moveLong = 0;
    let moveLat = 0;

    if (forward) {
      moveLong += Math.sin(lookYaw);
      moveLat += Math.cos(lookYaw);
    }
    if (backward) {
      moveLong -= Math.sin(lookYaw);
      moveLat -= Math.cos(lookYaw);
    }
    if (right) {
      moveLong += Math.cos(lookYaw);
      moveLat -= Math.sin(lookYaw);
    }
    if (left) {
      moveLong -= Math.cos(lookYaw);
      moveLat += Math.sin(lookYaw);
    }

    player.longitude += moveLong * moveSpeed;
    player.latitude += moveLat * moveSpeed * 0.7;
    player.latitude = clamp(player.latitude, -1.3, 1.3);

    if (world.mode === "creative") {
      if (jumpOrUp) player.radialOffset = clamp(player.radialOffset + 0.02, -0.22, 1.2);
      if (down) player.radialOffset = clamp(player.radialOffset - 0.02, -0.22, 1.2);
      player.jumpVelocity = 0;
    } else {
      if (jumpOrUp && player.radialOffset <= 0.001) {
        player.jumpVelocity = 0.19;
      }

      player.jumpVelocity -= 0.014;
      player.radialOffset += player.jumpVelocity;
      if (player.radialOffset < 0) {
        player.radialOffset = 0;
        player.jumpVelocity = 0;
      }
    }

    sunAngle += 0.004;
  }

  function drawSky(width, height, sunX, sunY) {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#85ade3");
    bg.addColorStop(0.55, "#a8cbf4");
    bg.addColorStop(1, "#e9f5ff");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const sunGlow = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 220);
    sunGlow.addColorStop(0, "rgba(255,255,235,0.96)");
    sunGlow.addColorStop(1, "rgba(255,244,188,0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fffef0";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBlockTile(cell, camera, sunVector) {
    const w = canvas.width;
    const h = canvas.height;
    const focal = Math.min(w, h) * 0.82;

    const topCenter = {
      x: cell.normal.x * (PLANET_OUTER_RADIUS + cell.tileHeight),
      y: cell.normal.y * (PLANET_OUTER_RADIUS + cell.tileHeight),
      z: cell.normal.z * (PLANET_OUTER_RADIUS + cell.tileHeight),
    };
    const bottomCenter = {
      x: cell.normal.x * PLANET_INNER_AIR_RADIUS,
      y: cell.normal.y * PLANET_INNER_AIR_RADIUS,
      z: cell.normal.z * PLANET_INNER_AIR_RADIUS,
    };

    const east = normalize(cross({ x: 0, y: 1, z: 0 }, cell.normal));
    const north = normalize(cross(cell.normal, east));
    const sideCount = cell.isPentagon ? 5 : 6;
    const tileRadius = cell.tileRadius;

    const topPoints = [];
    const bottomPoints = [];

    for (let i = 0; i < sideCount; i += 1) {
      const a = ((Math.PI * 2) / sideCount) * i + (cell.isPentagon ? Math.PI / 10 : Math.PI / 6);
      const ringOffset = {
        x: east.x * Math.cos(a) * tileRadius + north.x * Math.sin(a) * tileRadius,
        y: east.y * Math.cos(a) * tileRadius + north.y * Math.sin(a) * tileRadius,
        z: east.z * Math.cos(a) * tileRadius + north.z * Math.sin(a) * tileRadius,
      };

      topPoints.push({
        x: topCenter.x + ringOffset.x,
        y: topCenter.y + ringOffset.y,
        z: topCenter.z + ringOffset.z,
      });

      bottomPoints.push({
        x: bottomCenter.x + ringOffset.x * 0.9,
        y: bottomCenter.y + ringOffset.y * 0.9,
        z: bottomCenter.z + ringOffset.z * 0.9,
      });
    }

    const projectedTop = topPoints.map((p) => projectPoint(p, camera, w, h, focal));
    const projectedBottom = bottomPoints.map((p) => projectPoint(p, camera, w, h, focal));
    if (projectedTop.some((p) => !p) || projectedBottom.some((p) => !p)) return;

    const brightness = clamp((dot(cell.normal, sunVector) + 1) * 0.5, 0.16, 1);
    const sideTint = cell.isPentagon ? [142, 112, 76] : [124, 96, 68];
    const topTint = cell.isPentagon ? [84, 188, 96] : [74, 176, 86];

    const shadowCenter = projectPoint(topCenter, camera, w, h, focal);
    if (shadowCenter) {
      const shadowSize = Math.max(4, 90 / (shadowCenter.z + 0.6));
      const shadowOffsetX = 5;
      const shadowOffsetY = 4;
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      drawPolygon(ctx, shadowCenter.x + shadowOffsetX, shadowCenter.y + shadowOffsetY, shadowSize, sideCount);
      ctx.fill();
    }

    for (let i = 0; i < sideCount; i += 1) {
      const next = (i + 1) % sideCount;
      const darken = 0.45 + (i / sideCount) * 0.18;
      ctx.fillStyle = `rgb(${Math.floor(sideTint[0] * brightness * darken)}, ${Math.floor(sideTint[1] * brightness * darken)}, ${Math.floor(
        sideTint[2] * brightness * darken,
      )})`;
      ctx.beginPath();
      ctx.moveTo(projectedBottom[i].x, projectedBottom[i].y);
      ctx.lineTo(projectedBottom[next].x, projectedBottom[next].y);
      ctx.lineTo(projectedTop[next].x, projectedTop[next].y);
      ctx.lineTo(projectedTop[i].x, projectedTop[i].y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = `rgb(${Math.floor(topTint[0] * (0.62 + brightness * 0.4))}, ${Math.floor(topTint[1] * (0.62 + brightness * 0.4))}, ${Math.floor(
      topTint[2] * (0.62 + brightness * 0.4),
    )})`;
    ctx.beginPath();
    ctx.moveTo(projectedTop[0].x, projectedTop[0].y);
    for (let i = 1; i < sideCount; i += 1) {
      ctx.lineTo(projectedTop[i].x, projectedTop[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(15,55,18,0.35)";
    ctx.stroke();
  }

  function drawWorld() {
    const w = canvas.width;
    const h = canvas.height;
    const horizon = h * 0.59;
    const sunVector = {
      x: Math.cos(sunAngle),
      y: 0.25,
      z: Math.sin(sunAngle),
    };

    const sunX = w * 0.5 + Math.cos(sunAngle) * w * 0.25;
    const sunY = h * 0.12 - Math.sin(sunAngle) * h * 0.05;
    drawSky(w, h, sunX, sunY);

    const groundGradient = ctx.createLinearGradient(0, horizon - h * 0.05, 0, h);
    groundGradient.addColorStop(0, "rgba(136,198,132,0.28)");
    groundGradient.addColorStop(1, "rgba(93,164,102,0.08)");
    ctx.fillStyle = groundGradient;
    ctx.beginPath();
    ctx.rect(0, horizon, w, h - horizon);
    ctx.fill();

    const playerNormal = normalize({
      x: Math.cos(player.latitude) * Math.sin(player.longitude),
      y: Math.sin(player.latitude),
      z: Math.cos(player.latitude) * Math.cos(player.longitude),
    });

    const worldUp = playerNormal;
    const east = normalize(cross({ x: 0, y: 1, z: 0 }, worldUp));
    const north = normalize(cross(worldUp, east));

    let cameraForward = north;
    cameraForward = rotateY(cameraForward, lookYaw);
    cameraForward = rotateX(cameraForward, lookPitch * 0.35);
    cameraForward = normalize({
      x: cameraForward.x + east.x * Math.sin(lookYaw),
      y: cameraForward.y + east.y * Math.sin(lookYaw),
      z: cameraForward.z + east.z * Math.sin(lookYaw),
    });

    const cameraRight = normalize(cross(cameraForward, worldUp));
    const cameraUp = normalize(cross(cameraRight, cameraForward));

    const baseHexHeight = planetCells.find((cell) => !cell.isPentagon)?.tileHeight || 0.028;
    const eyeHeight = baseHexHeight * PLAYER_HEIGHT_IN_HEXES + player.radialOffset * 0.05;
    const detachedBoost = cameraDetached ? 1.35 : 0;
    const viewDistance = eyeHeight + cameraZoom + detachedBoost;
    const camera = {
      position: {
        x: playerNormal.x * (PLANET_OUTER_RADIUS + viewDistance),
        y: playerNormal.y * (PLANET_OUTER_RADIUS + viewDistance),
        z: playerNormal.z * (PLANET_OUTER_RADIUS + viewDistance),
      },
      forward: cameraForward,
      right: cameraRight,
      up: cameraUp,
    };

    const drawQueue = [];
    for (const cell of planetCells) {
      const toCell = {
        x: cell.normal.x * PLANET_OUTER_RADIUS - camera.position.x,
        y: cell.normal.y * PLANET_OUTER_RADIUS - camera.position.y,
        z: cell.normal.z * PLANET_OUTER_RADIUS - camera.position.z,
      };
      const depth = dot(toCell, camera.forward);
      if (depth <= 0.12) continue;
      const globeVisibilityCutoff = cameraZoom > 0.7 || cameraDetached ? -0.35 : 0.06;
      if (dot(cell.normal, playerNormal) < globeVisibilityCutoff) continue;
      drawQueue.push({ cell, depth });
    }

    drawQueue.sort((a, b) => b.depth - a.depth);
    for (const entry of drawQueue) {
      drawBlockTile(entry.cell, camera, sunVector);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.5 - 5, h * 0.52);
    ctx.lineTo(w * 0.5 + 5, h * 0.52);
    ctx.moveTo(w * 0.5, h * 0.52 - 5);
    ctx.lineTo(w * 0.5, h * 0.52 + 5);
    ctx.stroke();

    infoNode.textContent = `${world.worldName} | ${world.mode.toUpperCase()} | ${cameraDetached ? "Fly-out cam" : "First-person"} | ${
      world.topology.hexagonCells
    } hex + ${world.topology.pentagonCells} pent | Hollow core r=${PLANET_INNER_AIR_RADIUS.toFixed(
      2,
    )} | W/S forward-back, A left, D right, Mouse look, P toggle fly-out, ${
      world.mode === "creative" ? "Space/Shift fly" : "Space jump"
    }`;
  }

  function tick() {
    if (!running) return;
    updatePhysics();
    drawWorld();
    animationFrame = requestAnimationFrame(tick);
  }

  function onKeyDown(event) {
    if (event.key.toLowerCase() === "p" && !event.repeat) {
      cameraDetached = !cameraDetached;
      cameraZoom = cameraDetached ? Math.max(cameraZoom, 0.9) : Math.min(cameraZoom, 0.3);
      return;
    }
    ACTIVE_KEYS.add(event.key.toLowerCase());
  }

  function onKeyUp(event) {
    ACTIVE_KEYS.delete(event.key.toLowerCase());
  }

  function onMouseMove(event) {
    if (document.pointerLockElement !== canvas) return;
    lookYaw += event.movementX * 0.003;
    lookPitch = clamp(lookPitch - event.movementY * 0.002, -0.9, 0.9);
  }

  function onWheel(event) {
    cameraZoom = clamp(cameraZoom + event.deltaY * 0.0015, 0, 2.4);
    event.preventDefault();
  }

  canvas.addEventListener("click", () => {
    canvas.requestPointerLock?.();
  });

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", resizeCanvas);

  leaveButton.addEventListener("click", () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(animationFrame);
    document.exitPointerLock?.();
    sessionRoot.classList.add("hidden");
  });

  resizeCanvas();

  return {
    start(nextWorld) {
      world = nextWorld;
      planetCells = buildPlanetCells(world.topology, world.size);
      player.longitude = 0;
      player.latitude = 0;
      player.radialOffset = 0;
      player.jumpVelocity = 0;
      lookYaw = 0;
      lookPitch = 0;
      cameraZoom = 0;
      cameraDetached = false;
      sunAngle = 0;
      sessionRoot.classList.remove("hidden");

      if (!running) {
        running = true;
        tick();
      }
    },
  };
}
