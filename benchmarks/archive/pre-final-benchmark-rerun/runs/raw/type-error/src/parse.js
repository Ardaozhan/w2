export function parseNumber(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError('Expected a numeric string');
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError('Expected a finite number');
  }

  return number;
}
