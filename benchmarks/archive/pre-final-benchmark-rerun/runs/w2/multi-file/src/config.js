export function getPort(config) {
  const port = config?.port;
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 3000;
}
