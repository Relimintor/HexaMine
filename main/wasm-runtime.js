const WASM_FILE = "./main/wasm/hexamine-core.txt";

function hexToWasmBytes(hexText) {
  const normalized = hexText.replace(/\s+/g, "").trim();
  if (normalized.length % 2 !== 0) {
    throw new Error("Invalid wasm hex payload length");
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}

export async function loadWasmRuntime() {
  const response = await fetch(WASM_FILE);
  if (!response.ok) {
    throw new Error(`Failed to fetch wasm runtime: ${response.status}`);
  }

  const wasmHexText = await response.text();
  const wasmBytes = hexToWasmBytes(wasmHexText);
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  return instance;
}
