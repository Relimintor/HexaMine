export const HEXAMINE_VERSION = "v0.1.0-prealpha";

const ACTION_LABELS = {
  "new-world": "New World",
  "load-world": "Load World",
  multiplayer: "Multiplayer",
  options: "Options",
  quit: "Quit",
};

export function mountMainMenu({ onAction }) {
  const versionNode = document.querySelector("#menu-version");
  if (versionNode) {
    versionNode.textContent = HEXAMINE_VERSION;
  }

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      onAction(action, ACTION_LABELS[action] ?? action);
    });
  });
}

export function setStatus(text) {
  const statusNode = document.querySelector("#status-line");
  if (statusNode) {
    statusNode.textContent = text;
  }
}
