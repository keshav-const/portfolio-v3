// The shape of each world's land: heights, ground masks, plant cover and where trees and rocks grow.
// Pure JS (no three.js) so the terrain worker can run it off the main thread. Throwaway sketch code.
import { fbm, ss, lerp, ridge, craters } from './noise.js';

// ---------- landmarks ----------
export const HANGAR = [95, -110], MAST = [30, -160], FOUNDRY = [-1700, -2300];
export const FORT = [-150, -230], AMPHI = [1500, 1150];
export const RIVER = (z) => 175 + 70 * Math.sin(z / 260) + 380 * (Math.sin(z / 1500 + 1.0) - Math.sin(1.0));
export const GROUND = [0, -215], GRAND = [1650, -2150], SALT = [-2300, 1500];
export const FORDS = [180, -900, 1250];
export const OBS = [-120, -185], CRATER = [560, -720], SCOPE = [2300, -1750];

const T_raw = (x, z) => {
  const t = fbm(x * 0.0024 + 3, z * 0.0024 + 1, 5, 11) * 11, fl = Math.floor(t), fr = t - fl;
  let h = (fl + ss(0.55, 0.95, fr)) * 9 - 50 + (fbm(x * 0.05, z * 0.05, 3, 12) - 0.5) * 2.2;
  const cn = Math.abs(fbm(x * 0.0006 + 9, z * 0.0006 + 4, 4, 13) - 0.5); h -= 55 * ss(0.03, 0.0, cn);
  h += craters(x, z, 900, 15, 0.3, 260);
  return h + ridge(x * 0.00045, z * 0.00045, 14) * 600 * ss(2200, 5200, Math.hypot(x, z));
};
export const T_FY = T_raw(...FOUNDRY);
const E_raw = (x, z) => {
  const h = (fbm(x * 0.0022, z * 0.0022, 5, 21) - 0.5) * 70 + (fbm(x * 0.02, z * 0.02, 3, 22) - 0.5) * 3 + (fbm(x * 0.0007, z * 0.0007, 3, 25) - 0.5) * 90;
  return h + ridge(x * 0.0005, z * 0.0005, 23) * 480 * ss(1900, 5200, Math.hypot(x, z));
};
export const E_AY = Math.max(E_raw(...AMPHI), 4);
const A_raw = (x, z) => {
  const h = (fbm(x * 0.0021 + 5, z * 0.0021 + 9, 4, 31) - 0.5) * 38 + (fbm(x * 0.012, z * 0.012, 3, 32) - 0.5) * 3 + (fbm(x * 0.0008, z * 0.0008, 3, 36) - 0.5) * 70;
  return h + ridge(x * 0.0005, z * 0.0005, 33) * 520 * ss(2400, 5600, Math.hypot(x, z));
};
export const A_GY = A_raw(...GROUND), A_BY = A_raw(...GRAND), A_0 = A_raw(0, 0);
const K_raw = (x, z) => {
  let h = (fbm(x * 0.003, z * 0.003, 5, 41) - 0.5) * 9 + (fbm(x * 0.03, z * 0.03, 2, 42) - 0.5) * 0.6 + (fbm(x * 0.0009, z * 0.0009, 3, 47) - 0.5) * 40;
  h += craters(x, z, 520, 41, 0.5, 190);
  return h + ridge(x * 0.0005, z * 0.0005, 45) * 300 * ss(2200, 5400, Math.hypot(x, z));
};
export const K_0 = K_raw(0, 0), K_SY = K_raw(...SCOPE);

export const clearOf = (F, x, z) => !F.clear.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r);
const pick = (pal) => (x, z, r) => pal[Math.floor(r * pal.length)].map((v) => v * (0.85 + 0.3 * fbm(x * 0.01, z * 0.01, 2, 61)));

// scatter rules: the order matches the models listed for each world in surface.js
export const FIELDS = {
  technova: {
    clear: [[0, 0, 30], [...HANGAR, 32], [...MAST, 12], [-60, -80, 16], [-30, -125, 14], [64, 50, 38], [...FOUNDRY, 200]],
    h(x, z) { let h = T_raw(x, z); h = lerp(h, 0, ss(190, 110, Math.hypot(x, z))); return lerp(h, T_FY, ss(240, 160, Math.hypot(x - FOUNDRY[0], z - FOUNDRY[1]))); },
    mask(x, z) { const r = Math.hypot(x, z), df = Math.hypot(x - FOUNDRY[0], z - FOUNDRY[1]); return [Math.max(ss(17, 15.5, r), ss(150, 120, df) * 0.85), 0, 0]; },
    scatter: [
      { variants: 4, cell: 7, scale: [0.25, 2.4], collide: 0.75, height: 1.4, sink: 0.25, tilt: true,
        ok: (F, x, z, h, sl, m) => (clearOf(F, x, z) && m[0] < 0.2 ? 0.16 + sl * 0.8 : 0), colour: (x, z, r) => (r < 0.12 ? [1.6, 1.0, 0.7] : [1, 1, 1]) },
    ],
  },
  ekatva: {
    clear: [[0, 0, 45], [...FORT, 95], [...AMPHI, 160]],
    h(x, z) {
      let h = E_raw(x, z);
      h = lerp(h, -20, ss(45, 12, Math.abs(x - RIVER(z))));
      // fords: shallow gravel crossings where the bed rises to just under the surface
      for (const fz of FORDS) { const k = ss(60, 25, Math.abs(z - fz)); if (k > 0) h = Math.max(h, lerp(h, -12.6 + Math.abs(x - RIVER(z)) * 0.02, k)); }
      const df = Math.hypot(x - FORT[0], z - FORT[1]); h += 42 * Math.exp(-(df * df) / (2 * 75 * 75)); h = lerp(h, 34, ss(58, 46, df));
      h = lerp(h, E_AY, ss(170, 120, Math.hypot(x - AMPHI[0], z - AMPHI[1])));
      return lerp(h, 6, ss(90, 40, Math.hypot(x, z)));
    },
    mask(x, z, h, slope) {
      const df = Math.hypot(x - FORT[0], z - FORT[1]), da = Math.hypot(x - AMPHI[0], z - AMPHI[1]), r = Math.hypot(x, z);
      const f = ss(0.53, 0.6, fbm(x * 0.004, z * 0.004, 4, 24)) * ss(-10, -8, h) * (1 - ss(0.35, 0.5, slope)) * ss(90, 120, df) * ss(150, 190, da) * ss(45, 70, r) * ss(200, 150, h);
      return [f, Math.max(ss(80, 55, df) * 0.9, ss(140, 110, da) * 0.85), ss(-8, -11.5, h)];
    },
    cover(x, z, h, slope, m) { const g = (1 - m[0] * 0.75) * (1 - m[1]) * (1 - m[2]) * ss(0.42, 0.25, slope) * ss(190, 150, h); return [g, g * 0.2 * ss(0.5, 0.7, fbm(x * 0.02, z * 0.02, 2, 26)), fbm(x * 0.01, z * 0.01, 2, 27)]; },
    scatter: [
      { variants: 3, cell: 8, scale: [0.75, 1.45], collide: 0.45, height: 9,
        pre: (x, z) => (fbm(x * 0.004, z * 0.004, 4, 24) > 0.52 ? 1 : 0), ok: (F, x, z, h, sl, m) => (clearOf(F, x, z) ? m[0] * 1.1 : 0),
        colour: pick([[0.42, 0.1, 0.06], [0.55, 0.2, 0.07], [0.62, 0.36, 0.1], [0.32, 0.07, 0.05]]) },
      { variants: 3, cell: 20, scale: [0.6, 3.5], collide: 0.8, height: 1.2, sink: 0.2, tilt: true,
        ok: (F, x, z, h, sl) => (clearOf(F, x, z) && h > -10 ? 0.06 + sl * 1.2 : 0) },
    ],
  },
  arena: {
    clear: [[0, 0, 40], [...GROUND, 135], [GROUND[0], GROUND[1] - 104, 30], [...GRAND, 360], [0, -120, 12]],
    h(x, z) {
      let h = A_raw(x, z);
      h = lerp(h, -14, ss(760, 480, Math.hypot(x - SALT[0], z - SALT[1]) + (fbm(x * 0.004, z * 0.004, 3, 37) - 0.5) * 300));
      const dg = Math.hypot((x - GROUND[0]) / 1.12, z - GROUND[1]);
      h = lerp(h, A_GY + 7 * ss(78, 118, dg), ss(170, 120, dg)); h = lerp(h, A_GY, ss(80, 72, dg));
      h = lerp(h, A_BY, ss(400, 330, Math.hypot(x - GRAND[0], z - GRAND[1])));
      return lerp(h, A_0, ss(45, 20, Math.hypot(x, z)));
    },
    mask(x, z, h, slope) {
      const dg = Math.hypot((x - GROUND[0]) / 1.12, z - GROUND[1]), db = Math.hypot((x - GRAND[0]) / 1.25, z - GRAND[1]);
      const fl = ss(0.48, 0.58, fbm(x * 0.003 + 7, z * 0.003 + 2, 3, 35)) * (1 - ss(0.25, 0.4, slope));
      return [fl, Math.max(ss(80, 76, dg), ss(150, 144, db)), ss(-11, -13.5, h)];
    },
    cover(x, z, h, slope, m) { const g = (1 - m[1]) * (1 - m[2]) * ss(0.45, 0.3, slope) * ss(260, 220, h); return [g, m[0] * (1 - m[1]) * (1 - m[2]), fbm(x * 0.01, z * 0.01, 2, 38)]; },
    scatter: [
      { variants: 3, cell: 24, scale: [0.8, 1.4], collide: 0.5, height: 10,
        ok: (F, x, z, h, sl, m) => (clearOf(F, x, z) && m[1] < 0.1 && m[2] < 0.1 && sl < 0.3 ? 0.22 + 0.4 * ss(0.5, 0.7, fbm(x * 0.002, z * 0.002, 2, 39)) : 0),
        colour: pick([[0.95, 0.42, 0.06], [0.9, 0.22, 0.18], [0.72, 0.13, 0.42], [0.52, 0.76, 0.14]]) },
      { variants: 3, cell: 30, scale: [0.5, 2.5], collide: 0.8, height: 1.2, sink: 0.2, tilt: true,
        ok: (F, x, z, h, sl, m) => (clearOf(F, x, z) && m[1] < 0.1 ? 0.04 + sl * 1.5 : 0) },
    ],
  },
  cosmos: {
    clear: [[0, 0, 30], [...OBS, 50], [...SCOPE, 330], ...Array.from({ length: 5 }, (_, i) => [60 + i * 32, -110 - i * 34, 10])],
    h(x, z) {
      let h = K_raw(x, z);
      const dc = Math.hypot(x - CRATER[0], z - CRATER[1]); h += 40 * Math.exp(-(((dc - 380) / 45) ** 2)) - 26 * ss(380, 250, dc);
      const dsc = Math.hypot(x - SCOPE[0], z - SCOPE[1]); h = lerp(h, K_SY - 60 + 60 * (dsc / 300) ** 2, ss(330, 300, dsc)); h += 25 * Math.exp(-(((dsc - 320) / 30) ** 2));
      const dob = Math.hypot(x - OBS[0], z - OBS[1]); h = lerp(h, 13 + (fbm(x * 0.08, z * 0.08, 2, 43) - 0.5) * 1.5, ss(60 + (fbm(x * 0.02, z * 0.02, 2, 44) - 0.5) * 30, 45, dob));
      return lerp(h, K_0, ss(45, 20, Math.hypot(x, z)));
    },
    mask(x, z) { const dob = Math.hypot(x - OBS[0], z - OBS[1]), dc = Math.hypot(x - CRATER[0], z - CRATER[1]); return [ss(64, 50, dob) * 0.85, ss(300, 200, dc), 0]; },
    scatter: [
      { variants: 3, cell: 11, scale: [0.3, 2.2], collide: 0.75, height: 1.2, sink: 0.2, tilt: true,
        ok: (F, x, z, h, sl, m) => (clearOf(F, x, z) ? 0.08 + sl + m[0] : 0) },
      { variants: 3, cell: 26, scale: [0.6, 1.8], collide: 0.9, height: 3,
        ok: (F, x, z, h, sl, m) => (clearOf(F, x, z) && m[0] < 0.2 ? 0.14 : 0) },
    ],
  },
};
