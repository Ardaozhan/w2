export function parseNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Invalid number');
  return number;
}
