// Pure-JS noise, shared by the main thread and the terrain worker (no three.js here). Throwaway sketch code.
export function hash(i, j, s) { let h = (i * 374761393 + j * 668265263 + s * 974711) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h & 0xffffff) / 0xffffff; }
export function vnoise(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, o, s) { let a = 0.5, t = 0, f = 1, n = 0; for (let k = 0; k < o; k++) { t += a * vnoise(x * f, y * f, s + k * 31); n += a; a *= 0.5; f *= 2.03; } return t / n; }
export const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const ridge = (x, y, s) => { const n = 1 - Math.abs(fbm(x, y, 5, s) * 2 - 1); return n * n; };
// impact craters on a jittered grid: a bowl with a raised rim
export function craters(x, z, cell, seed, prob, maxR) {
  let h = 0; const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const i = ci + di, j = cj + dj; if (hash(i, j, seed) > prob) continue;
    const cx = (i + 0.2 + 0.6 * hash(i, j, seed + 1)) * cell, cz = (j + 0.2 + 0.6 * hash(i, j, seed + 2)) * cell;
    const R = maxR * (0.25 + 0.75 * hash(i, j, seed + 3) ** 2);
    const d = Math.hypot(x - cx, z - cz) / R; if (d > 2.2) continue;
    h += d < 1 ? (d * d - 1) * R * 0.2 + R * 0.05 : R * 0.05 * Math.exp(-((d - 1) ** 2) * 6);
  }
  return h;
}
