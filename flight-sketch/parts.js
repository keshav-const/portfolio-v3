// Shared parts, procedural textures and materials for the vessels and the station. Throwaway sketch code.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

function canvasTex(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// ---------- textures ----------
function panels(x, w, h, base, seam, vary, bumpMode) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  const cols = 4, rows = 6;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const px = i * w / cols, py = j * h / rows, sub = rnd() < 0.35;
    const v = bumpMode ? 128 + (rnd() - 0.5) * 10 : null;
    x.fillStyle = bumpMode ? `rgb(${v},${v},${v})` : `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * vary})`;
    x.fillRect(px + 1, py + 1, w / cols - 2, h / rows - 2);
    if (sub) { x.fillStyle = bumpMode ? 'rgb(150,150,150)' : 'rgba(0,0,0,0.04)'; x.fillRect(px + w / cols * 0.2, py + h / rows * 0.25, w / cols * 0.5, h / rows * 0.35); }
  }
  x.strokeStyle = seam; x.lineWidth = 2;
  for (let i = 0; i <= cols; i++) { x.beginPath(); x.moveTo(i * w / cols, 0); x.lineTo(i * w / cols, h); x.stroke(); }
  for (let j = 0; j <= rows; j++) { x.beginPath(); x.moveTo(0, j * h / rows); x.lineTo(w, j * h / rows); x.stroke(); }
  x.fillStyle = seam;
  for (let j = 0; j <= rows; j++) for (let i = 0; i < 24; i++) x.fillRect(i * w / 24 + 3, j * h / rows - 5, 2, 2);
}
export const TEX = {};
function makeTextures() {
  TEX.hull = canvasTex(512, 512, (x, w, h) => panels(x, w, h, '#e8e6e1', '#b9b6ae', 0.035, false));
  TEX.hullBump = canvasTex(512, 512, (x, w, h) => panels(x, w, h, 'rgb(128,128,128)', 'rgb(40,40,40)', 0, true), { srgb: false });
  const foil = (gold) => (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, gold ? '#b8862e' : '#9a9da2'); g.addColorStop(0.5, gold ? '#e2b65a' : '#d6d8dc'); g.addColorStop(1, gold ? '#a5741f' : '#8d9095');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const cx = rnd() * w, cy = rnd() * h, l = 8 + rnd() * 40, a = rnd() * Math.PI;
      x.strokeStyle = `rgba(${rnd() < 0.5 ? '255,240,200' : '60,40,10'},${0.08 + rnd() * 0.18})`; x.lineWidth = 1 + rnd() * 3;
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke();
    }
    x.strokeStyle = 'rgba(40,30,10,0.35)'; x.lineWidth = 2;
    for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(0, i * h / 5 + 10); x.lineTo(w, i * h / 5 + 14); x.stroke(); }
  };
  TEX.gold = canvasTex(256, 256, foil(true));
  TEX.silver = canvasTex(256, 256, foil(false));
  TEX.foilBump = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const cx = rnd() * w, cy = rnd() * h, l = 6 + rnd() * 30, a = rnd() * Math.PI; x.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'; x.lineWidth = 1 + rnd() * 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke(); }
  }, { srgb: false });
  TEX.solar = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#7d8288'; x.fillRect(0, 0, w, h);
    const cw = w / 16, ch = h / 8;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 16; i++) {
      const g = x.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
      const k = 0.85 + rnd() * 0.3; g.addColorStop(0, `rgb(${16 * k},${24 * k},${48 * k})`); g.addColorStop(1, `rgb(${24 * k},${34 * k},${66 * k})`);
      x.fillStyle = g; x.fillRect(i * cw + 1.5, j * ch + 1.5, cw - 3, ch - 3);
      x.strokeStyle = 'rgba(170,178,190,0.35)'; x.lineWidth = 0.7;
      for (let k2 = 1; k2 < 4; k2++) { x.beginPath(); x.moveTo(i * cw + k2 * cw / 4, j * ch + 2); x.lineTo(i * cw + k2 * cw / 4, (j + 1) * ch - 2); x.stroke(); }
    }
  });
  TEX.rad = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#eeece7'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(i * 16 + 6, 0, 4, h); }
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 0, w, 3); x.fillRect(0, h / 2, w, 2);
  });
  TEX.radBump = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#606060'; x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { x.fillStyle = '#e0e0e0'; x.fillRect(i * 16 + 5, 0, 6, h); } }, { srgb: false });
  TEX.windows = canvasTex(1024, 64, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 64; i++) { if (rnd() < 0.22) continue; const warm = rnd(); x.fillStyle = warm < 0.8 ? `rgba(255,${200 + rnd() * 30},${140 + rnd() * 40},${0.6 + rnd() * 0.4})` : 'rgba(210,225,255,0.8)'; x.fillRect(i * 16 + 4, 24, 8, 14); }
  });
}

export function label(text, { w = 512, h = 128, size = 64, color = '#2a2925', font = 'JetBrains Mono' } = {}) {
  const t = canvasTex(w, h, (x) => { x.clearRect(0, 0, w, h); x.fillStyle = color; x.font = `500 ${size}px "${font}", monospace`; x.textBaseline = 'middle'; x.fillText(text, 8, h / 2); });
  return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}

export const MAT = {};
export function makeMaterials() {
  if (MAT.hull) return MAT;
  makeTextures();
  const S = (o) => new THREE.MeshStandardMaterial(o);
  MAT.hull = S({ map: TEX.hull, bumpMap: TEX.hullBump, bumpScale: 1.2, roughness: 0.55, metalness: 0.02 });
  MAT.white = S({ color: 0xe6e4df, roughness: 0.6, metalness: 0.02 });
  MAT.alu = S({ color: 0xb9bdc0, roughness: 0.3, metalness: 0.9 });
  MAT.darkAlu = S({ color: 0x5b5f63, roughness: 0.45, metalness: 0.85 });
  MAT.gold = S({ map: TEX.gold, bumpMap: TEX.foilBump, bumpScale: 2, roughness: 0.32, metalness: 1 });
  MAT.silver = S({ map: TEX.silver, bumpMap: TEX.foilBump, bumpScale: 2, roughness: 0.3, metalness: 1 });
  MAT.black = S({ color: 0x141414, roughness: 0.85, metalness: 0.05 });
  MAT.solar = S({ map: TEX.solar, roughness: 0.42, metalness: 0.18 });
  MAT.solarBack = S({ color: 0xd8d4cc, roughness: 0.7 });
  MAT.rad = S({ map: TEX.rad, bumpMap: TEX.radBump, bumpScale: 1.5, roughness: 0.5, metalness: 0.02, side: THREE.DoubleSide });
  MAT.nozzle = S({ color: 0x3e3b39, roughness: 0.38, metalness: 0.9, side: THREE.DoubleSide });
  MAT.glass = S({ color: 0x06080b, roughness: 0.04, metalness: 0.95 });
  MAT.lit = S({ color: 0x111111, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.4 });
  MAT.windows = S({ color: 0xffffff, emissive: 0xffffff, emissiveMap: TEX.windows, emissiveIntensity: 3.0, map: TEX.hull, bumpMap: TEX.hullBump, bumpScale: 1.2, roughness: 0.55 });
  MAT.beacon = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.6, 0.4), toneMapped: true });
  MAT.strobe = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 8, 8) });
  MAT.guide = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.6, 3) });
  return MAT;
}

// ---------- builder: collects static geometry per material and merges it ----------
export class Builder {
  constructor() { this.parts = new Map(); this.group = new THREE.Group(); this.lights = []; this.nozzles = []; }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
    return this.addM(geo, mat, m);
  }
  addM(geo, mat, m) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }
  beam(a, b, r, mat, sides = 6) {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, sides, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return this.addM(g, mat, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  }
  // square lattice truss along Z from z0 to z1, half-width hw, n bays
  truss(z0, z1, hw, n, r, mat, cx = 0, cy = 0) {
    const V = (x, y, z) => new THREE.Vector3(cx + x, cy + y, z);
    const c = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
    for (const [x, y] of c) this.beam(V(x, y, z0), V(x, y, z1), r, mat);
    for (let i = 0; i <= n; i++) {
      const z = z0 + (z1 - z0) * i / n;
      for (let k = 0; k < 4; k++) this.beam(V(...c[k], z), V(...c[(k + 1) % 4], z), r * 0.75, mat);
      if (i < n) { const z2 = z0 + (z1 - z0) * (i + 1) / n; for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; this.beam(V(...(i % 2 ? a : b), z), V(...(i % 2 ? b : a), z2), r * 0.6, mat); } }
    }
    return this;
  }
  // lathe around the Z axis. profile: [radius, forward] pairs; forward is -Z
  lathe(profile, mat, segs = 48, x = 0, y = 0, z = 0) {
    const g = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), segs);
    g.rotateX(-Math.PI / 2);
    return this.add(g, mat, x, y, z);
  }
  panel(w, h, mat, frameMat, x, y, z, rx = 0, ry = 0, rz = 0, t = 0.012) {
    this.add(new THREE.BoxGeometry(w, t, h), mat, x, y, z, rx, ry, rz);
    if (frameMat) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
      for (const [bx, bz, bw, bh] of [[0, h / 2, w, 0.02], [0, -h / 2, w, 0.02], [w / 2, 0, 0.02, h], [-w / 2, 0, 0.02, h]]) {
        const g = new THREE.BoxGeometry(bw, t * 2.2, bh); g.translate(bx, 0, bz); this.addM(g, frameMat, m);
      }
    }
    return this;
  }
  rcs(x, y, z, ang) { // a four-nozzle thruster quad on a hull at angle ang around Z
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ang)), new THREE.Vector3(1, 1, 1));
    const blk = new THREE.BoxGeometry(0.07, 0.05, 0.07); blk.translate(0, 0.025, 0); this.addM(blk, MAT.white, m);
    for (const [dx, dz, rx, rz] of [[0.05, 0, 0, -Math.PI / 2], [-0.05, 0, 0, Math.PI / 2], [0, 0.05, Math.PI / 2, 0], [0, -0.05, -Math.PI / 2, 0]]) {
      const c = new THREE.ConeGeometry(0.016, 0.035, 8, 1, true); c.rotateX(rx); c.rotateZ(rz); c.translate(dx, 0.03, dz); this.addM(c, MAT.darkAlu, m);
      this.nozzles.push({ pos: new THREE.Vector3(dx * 1.3, 0.03, dz * 1.3).applyMatrix4(m), dir: new THREE.Vector3(dx, 0, dz).normalize().transformDirection(m) });
    }
    return this;
  }
  mesh(m) { this.group.add(m); return m; }
  light(mat, x, y, z, r = 0.03, kind = 'strobe', phase = 0) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat); m.position.set(x, y, z); this.group.add(m);
    this.lights.push({ m, kind, phase }); return m;
  }
  build() {
    for (const [mat, geos] of this.parts) {
      const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
      m.castShadow = m.receiveShadow = !(mat.isMeshBasicMaterial);
      this.group.add(m);
    }
    this.group.userData.lights = this.lights;
    this.group.userData.nozzles = this.nozzles;
    return this.group;
  }
}

export function blinkLights(group, t) {
  for (const l of group.userData.lights || []) {
    if (l.kind === 'beacon') l.m.visible = ((t + l.phase) % 1.6) < 0.14;
    else if (l.kind === 'strobe') l.m.visible = ((t + l.phase) % 1.1) < 0.06;
    else if (l.kind === 'chase') l.m.visible = ((t * 1.5 + l.phase) % 1) < 0.18;
  }
}

// nozzle: bell + cooling bands + inner glow; returns the glow parts for animation
export function engine(B, z, rt, re, len, x = 0, y = 0) {
  const prof = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push([rt + (re - rt) * (1 - (1 - t) ** 2.2), -(z + t * len)]); }
  B.lathe(prof, MAT.nozzle, 40, x, y, 0);
  for (const t of [0.15, 0.4, 0.7, 0.98]) {
    const r = rt + (re - rt) * (1 - (1 - t) ** 2.2);
    B.add(new THREE.TorusGeometry(r + 0.004, 0.006, 6, 40), MAT.darkAlu, x, y, z + t * len);
  }
  const g = new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r * 0.94, h)), 40); g.rotateX(-Math.PI / 2);
  const glow = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.25), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  glow.position.set(x, y, 0);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(rt * 1.05, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.7), transparent: true, opacity: 0 }));
  throat.position.set(x, y, z + 0.01);
  B.group.add(glow, throat);
  (B.group.userData.engines ||= []).push({ glow, throat, exit: new THREE.Vector3(x, y, z + len), re });
}

// soft-edged flame: opaque at the nozzle, fading along its length
let _flameAlpha = null;
export function flameAlpha() {
  if (_flameAlpha) return _flameAlpha;
  const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#000'); g.addColorStop(0.55, '#555'); g.addColorStop(1, '#fff');
  x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  return (_flameAlpha = new THREE.CanvasTexture(c));
}
export function flame(radius, length, color) {
  const g = new THREE.ConeGeometry(radius, length, 14, 1, true); g.translate(0, length / 2, 0); // wide base at the origin, tip along +Y
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, alphaMap: flameAlpha(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false; return m;
}
