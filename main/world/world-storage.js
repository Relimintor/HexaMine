const WORLD_STORAGE_KEY = "hexamine-worlds";

function readWorlds() {
  const raw = localStorage.getItem(WORLD_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWorlds(worlds) {
  localStorage.setItem(WORLD_STORAGE_KEY, JSON.stringify(worlds));
}

export function saveWorld(worldConfig) {
  const worlds = readWorlds();
  const worldRecord = {
    id: `world-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...worldConfig,
  };

  worlds.push(worldRecord);
  writeWorlds(worlds);
  return worldRecord;
}
