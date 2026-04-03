const ACTIVE_KEYS = new Set();

export function createGameSession() {
  const sessionRoot = document.querySelector("#game-session");
  const canvas = document.querySelector("#game-canvas");
  const infoNode = document.querySelector("#game-info");
  const leaveButton = document.querySelector("#leave-world");
  const ctx = canvas.getContext("2d");

  let animationFrame;
  let running = false;
  let world;

  const player = {
    angle: 0,
    angularSpeed: 0,
    radialOffset: 0,
    jumpVelocity: 0,
  };

  function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  function updatePhysics() {
    const moveLeft = ACTIVE_KEYS.has("a") || ACTIVE_KEYS.has("arrowleft");
    const moveRight = ACTIVE_KEYS.has("d") || ACTIVE_KEYS.has("arrowright");
    const jump = ACTIVE_KEYS.has(" ") || ACTIVE_KEYS.has("space");

    player.angularSpeed = 0;
    if (moveLeft) player.angularSpeed -= 0.018;
    if (moveRight) player.angularSpeed += 0.018;
    player.angle += player.angularSpeed;

    if (jump && player.radialOffset <= 0.001) {
      player.jumpVelocity = 0.2;
    }

    player.jumpVelocity -= 0.015;
    player.radialOffset += player.jumpVelocity;

    if (player.radialOffset < 0) {
      player.radialOffset = 0;
      player.jumpVelocity = 0;
    }
  }

  function drawWorld() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w * 0.52;
    const cy = h * 0.5;
    const r = Math.min(w, h) * 0.33;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#04070f";
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.7);
    glow.addColorStop(0, "rgba(100, 200, 255, 0.28)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
    ctx.fill();

    const planet = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.2, cx, cy, r);
    planet.addColorStop(0, "#a7d6a3");
    planet.addColorStop(0.45, world.terrain === "superflat" ? "#8ca082" : "#5f9d57");
    planet.addColorStop(1, "#1f2d26");
    ctx.fillStyle = planet;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // 12 pentagons from original icosahedron vertices.
    ctx.fillStyle = "#f6c75f";
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12;
      const px = cx + Math.cos(a) * r * 0.84;
      const py = cy + Math.sin(a) * r * 0.84;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hex cell dots to imply the rest of the planet is hexagons.
    ctx.fillStyle = "rgba(215,255,222,0.35)";
    const hexDots = Math.min(180, Math.max(48, Math.floor(world.topology.hexagonCells / 30)));
    for (let i = 0; i < hexDots; i += 1) {
      const a = (Math.PI * 2 * i) / hexDots;
      const px = cx + Math.cos(a) * r * 0.72;
      const py = cy + Math.sin(a) * r * 0.72;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const playerRadius = r + player.radialOffset * 40;
    const playerX = cx + Math.cos(player.angle) * playerRadius;
    const playerY = cy + Math.sin(player.angle) * playerRadius;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(playerX, playerY, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    infoNode.textContent = `${world.worldName} | ${world.mode} | ${world.topology.hexagonCells} hex + ${world.topology.pentagonCells} pent | A/D move, Space jump`;
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

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", resizeCanvas);

  leaveButton.addEventListener("click", () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(animationFrame);
    sessionRoot.classList.add("hidden");
  });

  resizeCanvas();

  return {
    start(nextWorld) {
      world = nextWorld;
      player.angle = 0;
      player.angularSpeed = 0;
      player.radialOffset = 0;
      player.jumpVelocity = 0;
      sessionRoot.classList.remove("hidden");

      if (!running) {
        running = true;
        tick();
      }
    },
  };
}
