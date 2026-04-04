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
  const worldName = worldNameInput.value.trim() || "New World";
  spawnNote.textContent = `Creating \"${worldName}\"... spawning player on an icosahedron planet.`;
});
