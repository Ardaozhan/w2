export function parseNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || (typeof value === 'string' && value.trim() === '')) {
    throw new TypeError('Invalid number');
  }
  return number;
}
