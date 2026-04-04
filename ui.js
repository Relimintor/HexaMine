const menuScreen = document.getElementById("menu-screen");
const createWorldScreen = document.getElementById("create-world-screen");
const newWorldBtn = document.getElementById("new-world-btn");
const backBtn = document.getElementById("back-btn");
const createBtn = document.getElementById("create-btn");
const spawnNote = document.getElementById("spawn-note");

function toggleActiveChip(containerId, event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  document.querySelectorAll(`#${containerId} .hex-chip`).forEach((chip) => {
    chip.classList.remove("active");
  });
  target.classList.add("active");
}

function getActiveOption(containerId) {
  const activeOption = document.querySelector(`#${containerId} .hex-chip.active`);
  return activeOption ? activeOption.textContent.trim().toLowerCase() : "";
}

newWorldBtn.addEventListener("click", () => {
  menuScreen.classList.add("hidden");
  createWorldScreen.classList.remove("hidden");
  spawnNote.textContent = "";
});

backBtn.addEventListener("click", () => {
  createWorldScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
});

document.getElementById("size-options").addEventListener("click", (event) => {
  toggleActiveChip("size-options", event);
});

document.getElementById("terrain-options").addEventListener("click", (event) => {
  toggleActiveChip("terrain-options", event);
});

createBtn.addEventListener("click", () => {
  const worldNameInput = document.getElementById("world-name");
  const worldSeedInput = document.getElementById("world-seed");

  const worldName = worldNameInput.value.trim() || "New World";
  const seed = worldSeedInput.value.trim() || "random";
  const size = getActiveOption("size-options") || "large";
  const terrain = getActiveOption("terrain-options") || "earthlike";

  const params = new URLSearchParams({
    name: worldName,
    seed,
    size,
    terrain,
  });

  spawnNote.textContent = `Creating \"${worldName}\"... opening icosahedron world.`;
  window.location.href = `world.html?${params.toString()}`;
});
