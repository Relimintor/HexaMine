const versionText = document.getElementById("version-text");
const actionButtons = document.querySelectorAll(".menu-actions button");

async function loadMenuWasmVersion() {
  try {
    const wasm = await WebAssembly.instantiateStreaming(fetch("wasm/menu_logic.wasm"));
    const buildVersion = wasm.instance.exports.getMenuVersion();
    versionText.textContent = `v0.0.${buildVersion}`;
  } catch (error) {
    console.error("Unable to load menu wasm module (rename wasm/menu_logic.txt to wasm/menu_logic.wasm first)", error);
    versionText.textContent = "v0.0.0";
  }
}

for (const button of actionButtons) {
  button.addEventListener("click", () => {
    const action = button.getAttribute("data-action");

    if (action === "quit") {
      window.close();
      return;
    }

    console.log(`Main menu action selected: ${action}`);
  });
}

loadMenuWasmVersion();
