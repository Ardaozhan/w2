export function parseNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError('Invalid number');
  }
  return number;
}
