export function getPort(config) {
  const port = typeof config?.port === 'string' && config.port.trim() !== ''
    ? Number(config.port)
    : config?.port;

  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 3000;
}
