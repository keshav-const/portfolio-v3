// Builds terrain chunks and scatter tiles off the main thread, so walking and flying never stall a frame.
import { FIELDS } from './fields.js';
import { hash } from './noise.js';

export const ITEM = 25; // floats per scattered item: def, variant, matrix(16), colour(3), x, z, radius, top
let F = null, CELL = 2.5;

function grid(x0, z0, cell, seg, near) {
  const n = seg + 1, nb = seg + 3;
  const H = new Float32Array(nb * nb);
  for (let j = 0; j < nb; j++) for (let i = 0; i < nb; i++) H[j * nb + i] = F.h(x0 + (i - 1) * cell, z0 + (j - 1) * cell);
  const pos = new Float32Array(n * n * 3), nrm = new Float32Array(n * n * 3), msk = new Float32Array(n * n * 3);
  const hm = near ? new Float32Array(seg * seg * 4) : null;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * cell, z = z0 + j * cell, h = H[(j + 1) * nb + i + 1];
    const dx = (H[(j + 1) * nb + i + 2] - H[(j + 1) * nb + i]) / (2 * cell), dz = (H[(j + 2) * nb + i + 1] - H[j * nb + i + 1]) / (2 * cell);
    const l = Math.hypot(dx, 1, dz), ny = 1 / l, k = (j * n + i) * 3;
    pos[k] = x; pos[k + 1] = h; pos[k + 2] = z; nrm[k] = -dx / l; nrm[k + 1] = ny; nrm[k + 2] = -dz / l;
    const m = F.mask(x, z, h, 1 - ny); msk[k] = m[0]; msk[k + 1] = m[1]; msk[k + 2] = m[2];
    if (near && i < seg && j < seg) {
      const c = F.cover ? F.cover(x, z, h, 1 - ny, m) : [0, 0, 0], o = (j * seg + i) * 4;
      hm[o] = h; hm[o + 1] = c[0]; hm[o + 2] = c[1]; hm[o + 3] = c[2];
    }
  }
  return { pos, nrm, msk, hm };
}

// a column-major 4x4 from position, rotation (quaternion) and scale, as three.js composes it
function compose(o, a, px, py, pz, qx, qy, qz, qw, sx, sy, sz) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz, xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx = qw * x2, wy = qw * y2, wz = qw * z2;
  o[a] = (1 - (yy + zz)) * sx; o[a + 1] = (xy + wz) * sx; o[a + 2] = (xz - wy) * sx; o[a + 3] = 0;
  o[a + 4] = (xy - wz) * sy; o[a + 5] = (1 - (xx + zz)) * sy; o[a + 6] = (yz + wx) * sy; o[a + 7] = 0;
  o[a + 8] = (xz + wy) * sz; o[a + 9] = (yz - wx) * sz; o[a + 10] = (1 - (xx + yy)) * sz; o[a + 11] = 0;
  o[a + 12] = px; o[a + 13] = py; o[a + 14] = pz; o[a + 15] = 1;
}
function tile(ti, tj, size) {
  const out = [];
  F.scatter.forEach((d, di) => {
    const n = Math.round(size / d.cell);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const gi = ti * n + i, gj = tj * n + j, s = 101 + di * 7;
      const x = (gi + hash(gi, gj, s)) * d.cell, z = (gj + hash(gi, gj, s + 1)) * d.cell;
      const p = d.pre ? d.pre(x, z) : 1; if (p <= 0 || hash(gi, gj, s + 2) > p) continue;
      const h = F.h(x, z), dx = F.h(x + 1, z) - F.h(x - 1, z), dz = F.h(x, z + 1) - F.h(x, z - 1), slope = 1 - 1 / Math.hypot(dx / 2, 1, dz / 2);
      const m = F.mask(x, z, h, slope); const q = d.ok(F, x, z, h, slope, m); if (q <= 0 || hash(gi, gj, s + 3) > q) continue;
      const sc = d.scale[0] + (d.scale[1] - d.scale[0]) * hash(gi, gj, s + 4);
      const v = Math.floor(hash(gi, gj, s + 5) * d.variants);
      const an = hash(gi, gj, s + 6) * Math.PI * 2;
      let qx = 0, qy = Math.sin(an / 2), qz = 0, qw = Math.cos(an / 2);
      if (d.tilt) { // lean with the ground: q = tilt * yaw
        let nx = -dx / 2, ny = 1, nz = -dz / 2; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        let tx = nz, ty = 0, tz = -nx, tw = ny + 1; const tl = Math.hypot(tx, ty, tz, tw); tx /= tl; tz /= tl; tw /= tl;
        const ax = tw * qx + tx * qw + ty * qz - tz * qy, ay = tw * qy - tx * qz + ty * qw + tz * qx, az = tw * qz + tx * qy - ty * qx + tz * qw, aw = tw * qw - tx * qx - ty * qy - tz * qz;
        qx = ax; qy = ay; qz = az; qw = aw;
      }
      const col = d.colour ? d.colour(x, z, hash(gi, gj, s + 8), h) : [1, 1, 1];
      const it = new Float32Array(ITEM);
      it[0] = di; it[1] = v;
      compose(it, 2, x, h - (d.sink || 0) * sc, z, qx, qy, qz, qw, sc, sc, sc);
      it[18] = col[0]; it[19] = col[1]; it[20] = col[2]; it[21] = x; it[22] = z; it[23] = (d.collide || 0) * sc; it[24] = h + (d.height || 0) * sc;
      out.push(it);
    }
  });
  const flat = new Float32Array(out.length * ITEM); out.forEach((it, k) => flat.set(it, k * ITEM));
  return flat;
}

self.onmessage = ({ data: m }) => {
  if (m.type === 'init') { F = FIELDS[m.key]; CELL = m.cell; return; }
  if (m.type === 'grid') {
    const g = grid(m.x0, m.z0, m.cell, m.seg, m.near);
    const tr = [g.pos.buffer, g.nrm.buffer, g.msk.buffer]; if (g.hm) tr.push(g.hm.buffer);
    self.postMessage({ type: 'grid', id: m.id, ...g }, tr);
  } else if (m.type === 'tile') {
    const items = tile(m.ti, m.tj, m.size);
    self.postMessage({ type: 'tile', id: m.id, items }, [items.buffer]);
  }
};
