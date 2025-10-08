export function fmt(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : (digits === 0 ? '0' : '0.00');
}

export function pct(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : '0%';
}


