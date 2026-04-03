export const OFFICIAL_SERVER = {
  id: "official-main",
  name: "HexaMine Official",
  socketUrl: "wss://hexamine.onrender.com",
  official: true,
};

const customServers = [];

export function getServerList() {
  return [OFFICIAL_SERVER, ...customServers];
}

export function registerCustomServer(serverConfig) {
  const normalizedServer = {
    id: serverConfig.id ?? `custom-${customServers.length + 1}`,
    name: serverConfig.name ?? "Custom Server",
    socketUrl: serverConfig.socketUrl,
    official: false,
  };

  customServers.push(normalizedServer);
  return normalizedServer;
}
