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

function buildPlanetCells(topology, size) {
  const total = Math.max(topology?.totalCells || 0, cellDensityFromSize(size));
  const pentCount = 12;
  const pentagonIndices = new Set();

  for (let i = 0; i < pentCount; i += 1) {
    pentagonIndices.add(Math.floor((i / pentCount) * total));
  }

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
      isPentagon: pentagonIndices.has(i),
    });
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
    const right = ACTIVE_KEYS.has("a");
    const left = ACTIVE_KEYS.has("d");
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
      if (jumpOrUp) player.radialOffset = clamp(player.radialOffset + 0.02, 0, 1.2);
      if (down) player.radialOffset = clamp(player.radialOffset - 0.02, 0, 1.2);
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
    bg.addColorStop(0, "#0a1021");
    bg.addColorStop(1, "#1f1a17");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
    sunGlow.addColorStop(0, "rgba(255,245,170,0.95)");
    sunGlow.addColorStop(1, "rgba(255,214,132,0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff5ba";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBlockTile(cell, camera, sunVector) {
    const w = canvas.width;
    const h = canvas.height;
    const focal = Math.min(w, h) * 0.82;

    const radius = 1;
    const baseCenter = {
      x: cell.normal.x * radius,
      y: cell.normal.y * radius,
      z: cell.normal.z * radius,
    };

    const east = normalize(cross({ x: 0, y: 1, z: 0 }, cell.normal));
    const north = normalize(cross(cell.normal, east));
    const sideCount = cell.isPentagon ? 5 : 6;
    const tileRadius = cell.isPentagon ? 0.052 : 0.047;
    const heightOffset = cell.isPentagon ? 0.045 : 0.038;

    const topCenter = {
      x: baseCenter.x + cell.normal.x * heightOffset,
      y: baseCenter.y + cell.normal.y * heightOffset,
      z: baseCenter.z + cell.normal.z * heightOffset,
    };

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
        x: baseCenter.x + ringOffset.x * 0.96,
        y: baseCenter.y + ringOffset.y * 0.96,
        z: baseCenter.z + ringOffset.z * 0.96,
      });
    }

    const projectedTop = topPoints.map((p) => projectPoint(p, camera, w, h, focal));
    const projectedBottom = bottomPoints.map((p) => projectPoint(p, camera, w, h, focal));
    if (projectedTop.some((p) => !p) || projectedBottom.some((p) => !p)) return;

    const brightness = clamp((dot(cell.normal, sunVector) + 1) * 0.5, 0.16, 1);
    const base = world.terrain === "superflat" ? 68 : 88;
    const tint = cell.isPentagon ? [132, 160, 202] : [base, base, base];

    for (let i = 0; i < sideCount; i += 1) {
      const next = (i + 1) % sideCount;
      const darken = 0.45 + (i / sideCount) * 0.18;
      ctx.fillStyle = `rgb(${Math.floor(tint[0] * brightness * darken)}, ${Math.floor(tint[1] * brightness * darken)}, ${Math.floor(
        tint[2] * brightness * darken,
      )})`;
      ctx.beginPath();
      ctx.moveTo(projectedBottom[i].x, projectedBottom[i].y);
      ctx.lineTo(projectedBottom[next].x, projectedBottom[next].y);
      ctx.lineTo(projectedTop[next].x, projectedTop[next].y);
      ctx.lineTo(projectedTop[i].x, projectedTop[i].y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = `rgb(${Math.floor(tint[0] * (0.65 + brightness * 0.45))}, ${Math.floor(tint[1] * (0.65 + brightness * 0.45))}, ${Math.floor(
      tint[2] * (0.65 + brightness * 0.45),
    )})`;
    ctx.beginPath();
    ctx.moveTo(projectedTop[0].x, projectedTop[0].y);
    for (let i = 1; i < sideCount; i += 1) {
      ctx.lineTo(projectedTop[i].x, projectedTop[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(16,16,18,0.55)";
    ctx.stroke();
  }

  function drawWorld() {
    const w = canvas.width;
    const h = canvas.height;
    const horizon = h * 0.62;
    const sunVector = {
      x: Math.cos(sunAngle),
      y: 0.25,
      z: Math.sin(sunAngle),
    };

    const sunX = w * 0.5 + Math.cos(sunAngle) * w * 0.38;
    const sunY = h * 0.15 - Math.sin(sunAngle) * h * 0.09;
    drawSky(w, h, sunX, sunY);

    const groundGradient = ctx.createLinearGradient(0, horizon - h * 0.08, 0, h);
    groundGradient.addColorStop(0, "rgba(36,32,28,0.25)");
    groundGradient.addColorStop(1, "rgba(12,10,8,0.86)");
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

    const eyeHeight = 0.08 + player.radialOffset * 0.06;
    const camera = {
      position: {
        x: playerNormal.x * (1 + eyeHeight),
        y: playerNormal.y * (1 + eyeHeight),
        z: playerNormal.z * (1 + eyeHeight),
      },
      forward: cameraForward,
      right: cameraRight,
      up: cameraUp,
    };

    const drawQueue = [];
    for (const cell of planetCells) {
      const toCell = {
        x: cell.normal.x - camera.position.x,
        y: cell.normal.y - camera.position.y,
        z: cell.normal.z - camera.position.z,
      };
      const depth = dot(toCell, camera.forward);
      if (depth <= 0.12) continue;
      if (dot(cell.normal, playerNormal) < 0.2) continue;
      drawQueue.push({ cell, depth });
    }

    drawQueue.sort((a, b) => b.depth - a.depth);
    for (const entry of drawQueue) {
      drawBlockTile(entry.cell, camera, sunVector);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    drawPolygon(ctx, w * 0.5, h * 0.52, 7, 4, Math.PI / 4);
    ctx.stroke();

    infoNode.textContent = `${world.worldName} | ${world.mode.toUpperCase()} | First-person | ${world.topology.hexagonCells} hex + ${
      world.topology.pentagonCells
    } pent | W/S move, A/D strafe, Mouse look, ${world.mode === "creative" ? "Space/Shift fly" : "Space jump"}`;
  }

  function tick() {
    if (!running) return;
    updatePhysics();
    drawWorld();
    animationFrame = requestAnimationFrame(tick);
  }

  function onKeyDown(event) {
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

  canvas.addEventListener("click", () => {
    canvas.requestPointerLock?.();
  });

  window.addEventListener("mousemove", onMouseMove);
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
      sunAngle = 0;
      sessionRoot.classList.remove("hidden");

      if (!running) {
        running = true;
        tick();
      }
    },
  };
}
