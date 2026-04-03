const SIZE_OPTIONS = ["tiny", "medium", "large", "colossal"];
const TERRAIN_OPTIONS = ["earthlike", "superflat"];

function setActiveOption(groupNode, value) {
  groupNode.querySelectorAll("button[data-value]").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });
}

function applyPreviewState(previewNode, mode, size, terrain) {
  previewNode.dataset.mode = mode;
  previewNode.dataset.size = size;
  previewNode.dataset.terrain = terrain;
}

export function setupNewWorldScreen({ onCreate, onBack }) {
  const overlay = document.querySelector("#new-world-overlay");
  const backButton = overlay.querySelector("[data-new-world='back']");
  const createButton = overlay.querySelector("[data-new-world='create']");

  const modeGroup = overlay.querySelector("[data-group='mode']");
  const sizeGroup = overlay.querySelector("[data-group='size']");
  const terrainGroup = overlay.querySelector("[data-group='terrain']");

  const worldNameNode = overlay.querySelector("#world-name");
  const seedNode = overlay.querySelector("#world-seed");
  const previewNode = overlay.querySelector("#new-world-preview");

  const formState = {
    mode: "survival",
    size: "large",
    terrain: "earthlike",
  };

  function refresh() {
    setActiveOption(modeGroup, formState.mode);
    setActiveOption(sizeGroup, formState.size);
    setActiveOption(terrainGroup, formState.terrain);
    applyPreviewState(previewNode, formState.mode, formState.size, formState.terrain);
  }

  modeGroup.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-value]");
    if (!target) return;
    formState.mode = target.dataset.value;
    refresh();
  });

  sizeGroup.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-value]");
    if (!target || !SIZE_OPTIONS.includes(target.dataset.value)) return;
    formState.size = target.dataset.value;
    refresh();
  });

  terrainGroup.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-value]");
    if (!target || !TERRAIN_OPTIONS.includes(target.dataset.value)) return;
    formState.terrain = target.dataset.value;
    refresh();
  });

  backButton.addEventListener("click", () => {
    overlay.classList.add("hidden");
    onBack();
  });

  createButton.addEventListener("click", () => {
    onCreate({
      worldName: worldNameNode.value || "NewWorld",
      seed: seedNode.value,
      ...formState,
    });
  });

  refresh();

  return {
    open() {
      overlay.classList.remove("hidden");
      refresh();
    },
    close() {
      overlay.classList.add("hidden");
    },
  };
}
