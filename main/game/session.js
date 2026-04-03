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

function drawHex(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function worldDensityFromSize(size) {
  switch (size) {
    case "tiny":
      return 14;
    case "medium":
      return 19;
    case "large":
      return 26;
    case "colossal":
      return 34;
    default:
      return 22;
  }
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

  function drawWorld() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.55;

    const planetRadius = Math.min(w, h) * (world.size === "colossal" ? 0.33 : world.size === "tiny" ? 0.22 : 0.28);
    const sunVector = {
      x: Math.cos(sunAngle),
      y: 0.25,
      z: Math.sin(sunAngle),
    };

    const sunX = cx + Math.cos(sunAngle) * planetRadius * 2.2;
    const sunY = cy - Math.sin(sunAngle) * planetRadius * 1.45 - 170;
    drawSky(w, h, sunX, sunY);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, planetRadius, 0, Math.PI * 2);
    ctx.clip();

    const density = worldDensityFromSize(world.size);
    for (let latStep = -density; latStep <= density; latStep += 1) {
      const lat = (latStep / density) * (Math.PI / 2);
      const rowCount = Math.max(8, Math.floor(density * Math.cos(lat) * 2.2));

      for (let lonStep = 0; lonStep < rowCount; lonStep += 1) {
        const lon = (lonStep / rowCount) * Math.PI * 2;

        let p = {
          x: Math.cos(lat) * Math.cos(lon),
          y: Math.sin(lat),
          z: Math.cos(lat) * Math.sin(lon),
        };

        p = rotateY(p, -(player.longitude + lookYaw));
        p = rotateX(p, -(player.latitude + lookPitch * 0.55));

        if (p.z < 0) continue;

        const light = clamp(p.x * sunVector.x + p.y * sunVector.y + p.z * sunVector.z, -1, 1);
        const bright = (light + 1) * 0.5;

        const px = cx + p.x * planetRadius;
        const py = cy + p.y * planetRadius;
        const hexRadius = Math.max(1.8, ((planetRadius / density) * 0.35) * (0.4 + p.z));

        const base = world.terrain === "superflat" ? 70 : 90;
        const shade = Math.floor(base + bright * 90);

        ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
        drawHex(ctx, px, py, hexRadius);
        ctx.fill();
        ctx.strokeStyle = "rgba(15,15,15,0.42)";
        ctx.stroke();
      }
    }

    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, planetRadius, 0, Math.PI * 2);
    ctx.stroke();

    const playerDistance = planetRadius + player.radialOffset * 42;
    const playerX = cx;
    const playerY = cy - playerDistance;

    ctx.fillStyle = world.mode === "creative" ? "#8ae3ff" : "#ffffff";
    ctx.beginPath();
    ctx.arc(playerX, playerY, 8, 0, Math.PI * 2);
    ctx.fill();

    infoNode.textContent = `${world.worldName} | ${world.mode.toUpperCase()} | W forward / S back / A right / D left | Mouse look | ${
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
