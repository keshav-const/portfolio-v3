// Three vessel designs, rebuilt with detailed parts. Forward is -Z. About 4 units long (1 unit ≈ 10 m).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, makeMaterials, Builder, engine, label, blinkLights, flame } from './parts.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function windowsRing(B, r, z, angles, w = 0.08, h = 0.055) {
  for (const a of angles) {
    B.add(new RoundedBoxGeometry(w, h, 0.03, 2, 0.012), MAT.glass, Math.sin(a) * r, Math.cos(a) * r, z, 0, 0, -a);
    B.add(new THREE.BoxGeometry(w + 0.025, h + 0.025, 0.02), MAT.darkAlu, Math.sin(a) * (r - 0.006), Math.cos(a) * (r - 0.006), z, 0, 0, -a);
  }
}
function handrail(B, r, a, z0, z1) {
  const p = (z) => V(Math.sin(a) * (r + 0.04), Math.cos(a) * (r + 0.04), z);
  B.beam(p(z0), p(z1), 0.006, MAT.alu);
  for (const z of [z0, (z0 + z1) / 2, z1]) B.beam(V(Math.sin(a) * r, Math.cos(a) * r, z), p(z), 0.005, MAT.alu);
}
function solarWing(B, side, x0, z, span, chord, panels = 3) {
  B.beam(V(side * 0.3, 0, z), V(side * x0, 0, z), 0.018, MAT.alu);
  B.add(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 16), MAT.darkAlu, side * x0, 0, z, 0, 0, Math.PI / 2);
  const pw = span / panels;
  for (let i = 0; i < panels; i++) {
    const cx = side * (x0 + 0.06 + pw * (i + 0.5));
    B.panel(pw - 0.03, chord, MAT.solar, MAT.alu, cx, 0.006, z);
    B.add(new THREE.BoxGeometry(pw - 0.03, 0.004, chord), MAT.solarBack, cx, -0.004, z);
  }
  B.beam(V(side * x0, 0, z), V(side * (x0 + span + 0.06), 0, z), 0.008, MAT.alu);
  return side * (x0 + span + 0.08);
}
function radiator(B, y0, h, z0, len, side = 1) {
  B.add(new THREE.BoxGeometry(0.02, h, len), MAT.rad, 0, side * (y0 + h / 2), z0);
  for (const dz of [-len / 2, len / 2]) B.add(new THREE.BoxGeometry(0.03, h, 0.025), MAT.alu, 0, side * (y0 + h / 2), z0 + dz);
  B.add(new THREE.BoxGeometry(0.03, 0.025, len), MAT.alu, 0, side * (y0 + h), z0);
  B.beam(V(0, side * 0.28, z0 - len * 0.3), V(0, side * y0, z0 - len * 0.3), 0.012, MAT.alu);
  B.beam(V(0, side * 0.28, z0 + len * 0.3), V(0, side * y0, z0 + len * 0.3), 0.012, MAT.alu);
}
function dish(B, x, y, z, r, ry = 0, rx = -0.6) {
  const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(r * t, r * 0.35 * t * t)); }
  const g = new THREE.LatheGeometry(prof, 40); g.rotateX(Math.PI / 2);
  const mat = MAT.white.clone(); mat.side = THREE.DoubleSide;
  B.add(g, mat, x, y, z, rx, ry, 0);
  const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), V(1, 1, 1));
  const f = V(0, 0, r * 0.75).applyMatrix4(m);
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; B.beam(V(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.3).applyMatrix4(m), f, 0.005, MAT.alu); }
  const horn = new THREE.ConeGeometry(0.03, 0.06, 12); horn.rotateX(-Math.PI / 2);
  B.addM(horn, MAT.darkAlu, new THREE.Matrix4().compose(f, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), V(1, 1, 1)));
}
function decal(B, text, x, y, z, ry, w = 0.32) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), label(text)); m.position.set(x, y, z); m.rotation.y = ry; B.group.add(m);
}

// ---------- A · Survey: the general arrangement on the canvas, built properly ----------
function survey() {
  makeMaterials(); const B = new Builder();
  B.add(new THREE.TorusGeometry(0.13, 0.018, 10, 40), MAT.alu, 0, 0, -1.92);
  B.add(new THREE.CylinderGeometry(0.13, 0.15, 0.1, 32), MAT.darkAlu, 0, 0, -1.87, Math.PI / 2);
  B.add(new THREE.ConeGeometry(0.03, 0.08, 12), MAT.alu, 0, 0, -1.99, -Math.PI / 2);
  // crew cabin (profile runs aft to nose so normals face out)
  B.lathe([[0.0, 0.97], [0.28, 0.97], [0.335, 1.0], [0.345, 1.05], [0.345, 1.5], [0.335, 1.6], [0.31, 1.7], [0.27, 1.77], [0.2, 1.83], [0.15, 1.86], [0.0, 1.86]], MAT.hull, 48);
  windowsRing(B, 0.322, -1.63, [-0.5, -0.17, 0.17, 0.5]);
  windowsRing(B, 0.345, -1.3, [Math.PI / 2, -Math.PI / 2], 0.06, 0.06);
  handrail(B, 0.345, 2.2, -1.48, -1.08); handrail(B, 0.345, -2.2, -1.48, -1.08);
  for (const a of [0.785, 2.356, -0.785, -2.356]) B.rcs(Math.sin(a) * 0.345, Math.cos(a) * 0.345, -1.1, -a);
  decal(B, 'K.№ 01', 0.352, 0.02, -1.25, Math.PI / 2);
  // service node in gold foil, with flanges
  B.add(new THREE.CylinderGeometry(0.3, 0.3, 0.36, 8), MAT.gold, 0, 0, -0.78, Math.PI / 2, 0, Math.PI / 8);
  for (const z of [-0.96, -0.6]) B.add(new THREE.CylinderGeometry(0.32, 0.32, 0.025, 40), MAT.alu, 0, 0, z, Math.PI / 2);
  // truss and tanks
  B.truss(-0.6, 1.3, 0.31, 5, 0.014, MAT.alu);
  for (const z of [-0.12, 0.78]) {
    B.add(new THREE.SphereGeometry(0.3, 40, 24), MAT.white, 0, 0, z);
    B.add(new THREE.TorusGeometry(0.301, 0.008, 6, 48), MAT.darkAlu, 0, 0, z);
    for (const a of [0.785, 2.356, -0.785, -2.356]) B.beam(V(Math.sin(a) * 0.29, Math.cos(a) * 0.29, z), V(Math.sign(Math.sin(a)) * 0.31, Math.sign(Math.cos(a)) * 0.31, z), 0.008, MAT.alu);
  }
  B.beam(V(0.05, 0.3, -0.12), V(0.05, 0.3, 0.78), 0.012, MAT.silver);
  radiator(B, 0.42, 0.62, 0.35, 1.0, 1); radiator(B, 0.42, 0.62, 0.35, 1.0, -1);
  const tipR = solarWing(B, 1, 0.55, 0.35, 1.7, 0.62), tipL = solarWing(B, -1, 0.55, 0.35, 1.7, 0.62);
  B.beam(V(0.0, 0.3, -0.75), V(0.32, 0.62, -0.7), 0.012, MAT.alu);
  dish(B, 0.36, 0.68, -0.68, 0.22, 0.6, -0.5);
  // thrust structure and engine
  B.lathe([[0.0, -1.58], [0.22, -1.56], [0.33, -1.42], [0.33, -1.34], [0.31, -1.3]], MAT.gold, 32);
  B.add(new THREE.TorusGeometry(0.11, 0.02, 8, 32), MAT.darkAlu, 0, 0, 1.58);
  engine(B, 1.6, 0.08, 0.34, 0.62);
  B.light(MAT.beacon, 0, 0.37, -1.2, 0.03, 'beacon');
  B.light(MAT.strobe, tipR, 0.02, 0.35, 0.02, 'strobe', 0); B.light(MAT.strobe, tipL, 0.02, 0.35, 0.02, 'strobe', 0.55);
  const g = B.build(); g.userData.length = 4.2; return g;
}

// ---------- B · Lancet: long, fast, built for distance ----------
function lancet() {
  makeMaterials(); const B = new Builder();
  B.lathe([[0.0, -1.25], [0.2, -1.25], [0.235, -1.15], [0.245, -0.9], [0.245, 0.9], [0.24, 1.3], [0.215, 1.7], [0.17, 2.05], [0.11, 2.3], [0.05, 2.45], [0.0, 2.5]], MAT.hull, 48);
  B.lathe([[0.249, -0.55], [0.249, 0.5]], MAT.silver, 48);
  for (const z of [-0.55, 0.5]) B.add(new THREE.TorusGeometry(0.25, 0.01, 6, 48), MAT.alu, 0, 0, z);
  // canopy: a row of glass along the top of the nose
  for (let i = 0; i < 4; i++) B.add(new RoundedBoxGeometry(0.11, 0.05, 0.13, 2, 0.015), MAT.glass, 0, 0.215 - i * 0.01, -1.75 + i * 0.15, 0.2, 0, 0);
  B.beam(V(0, 0, -2.5), V(0, 0, -2.95), 0.008, MAT.alu); B.add(new THREE.SphereGeometry(0.025, 12, 8), MAT.darkAlu, 0, 0, -2.95);
  B.panel(0.12, 1.5, MAT.solar, MAT.alu, 0, 0.255, 0.2);
  B.beam(V(0, 0.24, -0.9), V(0, 0.5, -0.95), 0.01, MAT.alu); dish(B, 0, 0.56, -0.95, 0.12, 0, -1.0);
  for (const a of [0.785, -0.785, 2.356, -2.356]) { B.rcs(Math.sin(a) * 0.245, Math.cos(a) * 0.245, -1.6, -a); B.rcs(Math.sin(a) * 0.245, Math.cos(a) * 0.245, 0.75, -a); }
  decal(B, 'K.№ 02', 0.252, 0.0, -0.95, Math.PI / 2, 0.36);
  const tips = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.05, 0.6); s.lineTo(1.05, 0.95); s.lineTo(0, 1.15); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 1 });
    geo.rotateY(-Math.PI / 2); geo.translate(0, 0.22, 0.15); geo.rotateZ(Math.PI / 4 + i * Math.PI / 2);
    B.addM(geo, MAT.rad, new THREE.Matrix4());
    const a = Math.PI / 4 + i * Math.PI / 2; tips.push(V(-Math.sin(a) * 1.25, Math.cos(a) * 1.25, 1.0));
  }
  B.add(new RoundedBoxGeometry(0.46, 0.3, 0.3, 3, 0.05), MAT.gold, 0, 0, 1.38);
  engine(B, 1.53, 0.05, 0.16, 0.42, -0.12, 0); engine(B, 1.53, 0.05, 0.16, 0.42, 0.12, 0);
  B.light(MAT.beacon, 0, 0.25, -0.5, 0.028, 'beacon');
  tips.forEach((t, i) => B.light(MAT.strobe, t.x, t.y, t.z, 0.018, 'strobe', i * 0.27));
  const g = B.build(); g.userData.length = 4.9; return g;
}

// ---------- C · Courier: compact, heavy, can land ----------
function courier() {
  makeMaterials(); const B = new Builder();
  B.add(new RoundedBoxGeometry(0.95, 0.66, 0.85, 4, 0.1), MAT.hull, 0, 0, -1.0);
  B.add(new RoundedBoxGeometry(0.8, 0.5, 0.3, 4, 0.12), MAT.hull, 0, -0.04, -1.5);
  B.add(new RoundedBoxGeometry(0.74, 0.26, 0.05, 3, 0.02), MAT.glass, 0, 0.16, -1.48, -0.5, 0, 0);
  for (const x of [-0.18, 0, 0.18]) B.add(new THREE.BoxGeometry(0.018, 0.28, 0.06), MAT.darkAlu, x, 0.16, -1.48, -0.5, 0, 0);
  for (const x of [-0.3, 0.3]) { B.add(new THREE.CylinderGeometry(0.035, 0.03, 0.04, 16), MAT.darkAlu, x, -0.2, -1.66, Math.PI / 2); B.light(MAT.guide, x, -0.2, -1.69, 0.026, 'steady'); }
  decal(B, 'K.№ 03', 0.48, 0.05, -1.0, Math.PI / 2, 0.36);
  for (const [x, y] of [[0.48, 0.2], [-0.48, 0.2]]) B.rcs(x, y, -0.7, x > 0 ? -Math.PI / 2 : Math.PI / 2);
  B.add(new THREE.BoxGeometry(0.3, 0.3, 1.9), MAT.darkAlu, 0, 0, 0.35);
  for (const [x, y] of [[-0.33, 0.33], [0.33, 0.33], [-0.33, -0.33], [0.33, -0.33]]) {
    B.add(new THREE.CapsuleGeometry(0.21, 1.0, 8, 24), MAT.silver, x, y, 0.35, Math.PI / 2);
    for (const z of [-0.05, 0.75]) B.add(new THREE.TorusGeometry(0.214, 0.012, 6, 32), MAT.alu, x, y, z);
  }
  for (const s of [-1, 1]) { B.add(new THREE.BoxGeometry(1.0, 0.02, 0.7), MAT.rad, s * 1.05, 0, 0.45); B.beam(V(s * 0.55, 0, 0.2), V(s * 0.6, 0, 0.7), 0.015, MAT.alu); }
  for (const [x, y] of [[0.42, -0.42], [-0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]]) {
    const a = V(x * 0.9, y * 0.9, -0.2), b = V(x * 1.25, y * 1.25, 0.95);
    B.beam(a, b, 0.018, MAT.alu); B.add(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 20), MAT.darkAlu, b.x, b.y, b.z + 0.02, Math.PI / 2);
  }
  B.add(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 40), MAT.gold, 0, 0, 1.36, Math.PI / 2);
  engine(B, 1.42, 0.07, 0.26, 0.5);
  for (const [x, y] of [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]]) engine(B, 1.42, 0.035, 0.1, 0.24, x, y);
  B.light(MAT.beacon, 0, 0.36, -0.9, 0.03, 'beacon');
  B.light(MAT.strobe, 1.55, 0.02, 0.45, 0.02, 'strobe', 0); B.light(MAT.strobe, -1.55, 0.02, 0.45, 0.02, 'strobe', 0.55);
  const g = B.build(); g.userData.length = 3.9; return g;
}

// thruster effects: a flame on every steering nozzle and every main engine
function withThrusters(build) {
  return () => {
    const g = build();
    const Y = new THREE.Vector3(0, 1, 0);
    g.userData.jets = (g.userData.nozzles || []).map((n) => {
      const f = flame(0.03, 0.42, new THREE.Color(4.2, 4.0, 3.6));
      f.position.copy(n.pos); f.quaternion.setFromUnitVectors(Y, n.dir); g.add(f);
      return { ...n, f, torque: new THREE.Vector3().crossVectors(n.pos, n.dir.clone().negate()).normalize() };
    });
    for (const e of g.userData.engines || []) {
      e.plume = flame(e.re * 0.82, e.re * 4.5, new THREE.Color(3.2, 1.8, 0.85));
      e.plume.position.copy(e.exit); e.plume.quaternion.setFromUnitVectors(Y, new THREE.Vector3(0, 0, 1)); g.add(e.plume);
    }
    return g;
  };
}

export const DESIGNS = [
  { name: 'A · Survey', build: withThrusters(survey), cockpit: V(0, 0.16, -1.75), dock: 1.97 },
  { name: 'B · Lancet', build: withThrusters(lancet), cockpit: V(0, 0.2, -1.6), dock: 2.55 },
  { name: 'C · Courier', build: withThrusters(courier), cockpit: V(0, 0.14, -1.55), dock: 1.7 },
];

// main: 0..1 thrust of the main engines. torque, force: commanded turn and push in the vessel's own axes (length up to 1).
const _F = new THREE.Vector3();
export function animateVessel(g, main, torque, force, time, warp) {
  const k = Math.min(1, main + warp);
  for (const e of g.userData.engines || []) {
    e.glow.material.opacity = 0.25 * k; e.throat.material.opacity = Math.min(0.9, k * 1.1);
    e.plume.material.opacity = 0.55 * k * (0.9 + 0.1 * Math.sin(time * 53));
    e.plume.scale.set(1, 0.35 + 0.65 * k, 1);
  }
  for (const j of g.userData.jets || []) {
    _F.copy(j.dir).negate();
    let a = Math.max(0, j.torque.dot(torque)) + Math.max(0, _F.dot(force));
    a = a < 0.12 ? 0 : Math.min(1, a);
    j.f.material.opacity = a * (0.75 + 0.25 * Math.sin(time * 71 + j.pos.x * 40));
    j.f.scale.set(1, 0.4 + 0.6 * a, 1);
  }
  blinkLights(g, time);
}
