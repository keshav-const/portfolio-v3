// The lander: the small craft that leaves the vessel, lands, and hops and flies across a surface.
// Model and flight physics. Units are metres. Throwaway sketch code.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, makeMaterials, Builder, flame, label } from './parts.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const FEET = [45, 135, 225, 315].map((a) => { const r = THREE.MathUtils.degToRad(a); return V(Math.cos(r) * 3.05, 0, Math.sin(r) * 3.05); });

function bell(B, mat, x, y, z, rt, re, len, tilt = 0, yaw = 0) {
  const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(rt + (re - rt) * (1 - (1 - t) ** 2.2), -t * len)); }
  const g = new THREE.LatheGeometry(prof, 28); g.rotateZ(tilt); g.rotateY(yaw);
  B.add(g, mat, x, y, z);
  for (const t of [0.2, 0.55, 0.95]) { const r = rt + (re - rt) * (1 - (1 - t) ** 2.2); const ring = new THREE.TorusGeometry(r + 0.01, 0.014, 6, 28); ring.rotateX(Math.PI / 2); ring.translate(0, -t * len, 0); ring.rotateZ(tilt); ring.rotateY(yaw); B.add(ring, MAT.darkAlu, x, y, z); }
}

export function buildLander() {
  makeMaterials();
  const B = new Builder();
  const accent = new THREE.MeshStandardMaterial({ color: 0xd93a2b, roughness: 0.55 });
  const black = MAT.black;
  // ---- descent stage: an octagonal body wrapped in foil, a heat shield underneath ----
  const oct = new THREE.CylinderGeometry(1.95, 1.95, 1.35, 8, 1); B.add(oct, MAT.gold, 0, 1.92, 0, 0, Math.PI / 8);
  for (let k = 0; k < 8; k++) { // panel seams and frame rails
    const a = (k / 8) * Math.PI * 2; const x = Math.cos(a) * 1.82, z = Math.sin(a) * 1.82;
    B.add(new THREE.BoxGeometry(0.07, 1.4, 0.07), MAT.darkAlu, x, 1.92, z);
  }
  B.add(new THREE.CylinderGeometry(2.0, 1.85, 0.12, 8), black, 0, 1.2, 0, 0, Math.PI / 8);
  B.add(new THREE.CylinderGeometry(2.02, 2.02, 0.1, 8), MAT.darkAlu, 0, 2.62, 0, 0, Math.PI / 8);
  // propellant tanks seen through open bays on four faces
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * 1.55, z = Math.sin(a) * 1.55;
    B.add(new THREE.BoxGeometry(1.1, 1.05, 0.35), black, Math.cos(a) * 1.78, 1.92, Math.sin(a) * 1.78, 0, -a + Math.PI / 2, 0);
    B.add(new THREE.SphereGeometry(0.5, 24, 16), MAT.silver, x, 1.92, z);
    B.add(new THREE.TorusGeometry(0.5, 0.025, 6, 24), MAT.darkAlu, x, 1.92, z, Math.PI / 2, 0, 0);
  }
  // ---- crew cabin: faceted, with an angled two-pane window ----
  B.add(new THREE.CylinderGeometry(1.2, 1.32, 1.7, 8, 1), MAT.hull, 0, 3.55, 0.15, 0, Math.PI / 8, 0);
  B.add(new THREE.CylinderGeometry(0.75, 1.2, 0.35, 8, 1), MAT.hull, 0, 4.57, 0.15, 0, Math.PI / 8, 0);
  B.add(new RoundedBoxGeometry(2.0, 0.95, 1.0, 3, 0.1), MAT.hull, 0, 3.85, -1.0, -0.38, 0, 0);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; B.add(new THREE.BoxGeometry(0.05, 1.72, 0.05), MAT.darkAlu, Math.cos(a) * 1.24, 3.55, 0.15 + Math.sin(a) * 1.24); }
  for (const s of [-1, 1]) {
    B.add(new THREE.BoxGeometry(0.82, 0.52, 0.05), MAT.glass, s * 0.47, 3.95, -1.52, -0.38, s * 0.12, 0);
    B.add(new THREE.BoxGeometry(0.9, 0.06, 0.08), MAT.darkAlu, s * 0.47, 4.22, -1.44, -0.38, s * 0.12, 0);
    B.add(new THREE.BoxGeometry(0.9, 0.06, 0.08), MAT.darkAlu, s * 0.47, 3.68, -1.62, -0.38, s * 0.12, 0);
  }
  B.add(new THREE.BoxGeometry(0.08, 0.6, 0.1), MAT.darkAlu, 0, 3.95, -1.55, -0.38, 0, 0);
  // side pods: oxidiser and water tanks
  for (const s of [-1, 1]) {
    B.add(new THREE.CapsuleGeometry(0.34, 1.1, 6, 20), MAT.silver, s * 1.52, 3.4, 0.35, Math.PI / 2, 0, 0);
    B.add(new THREE.BoxGeometry(0.2, 0.4, 0.8), MAT.darkAlu, s * 1.3, 3.4, 0.35);
  }
  // vermilion band and the registration
  B.add(new THREE.CylinderGeometry(1.33, 1.34, 0.12, 8), accent, 0, 2.86, 0.15, 0, Math.PI / 8, 0);
  // the hatch, porch and ladder at the front
  B.add(new RoundedBoxGeometry(0.85, 0.95, 0.08, 2, 0.04), MAT.white, 0, 3.12, -1.06);
  B.add(new THREE.TorusGeometry(0.48, 0.03, 6, 24), MAT.darkAlu, 0, 3.12, -1.1, 0, 0, Math.PI / 4).add(new THREE.BoxGeometry(0.06, 0.25, 0.06), MAT.alu, 0.32, 3.12, -1.12);
  B.add(new THREE.BoxGeometry(1.1, 0.06, 0.8), MAT.darkAlu, 0, 2.62, -2.05);
  for (const s of [-1, 1]) B.beam(V(s * 0.5, 2.68, -2.42), V(s * 0.5, 3.15, -2.42), 0.02, MAT.alu);
  B.beam(V(-0.5, 3.15, -2.42), V(0.5, 3.15, -2.42), 0.02, MAT.alu);
  // ---- top: docking tunnel, antennas, beacon ----
  B.add(new THREE.CylinderGeometry(0.5, 0.55, 0.45, 24), MAT.white, 0, 4.9, 0.15);
  B.add(new THREE.TorusGeometry(0.52, 0.06, 8, 32), MAT.alu, 0, 5.13, 0.15, Math.PI / 2, 0, 0);
  B.beam(V(0.85, 4.4, 0.8), V(1.05, 5.3, 0.95), 0.035, MAT.alu);
  const dish = new THREE.SphereGeometry(0.42, 24, 8, 0, Math.PI * 2, 0, 0.9); dish.rotateX(-0.6); B.add(dish, MAT.white, 1.1, 5.4, 1.0);
  B.beam(V(-0.9, 4.42, 0.9), V(-0.9, 5.6, 0.9), 0.012, MAT.alu);
  // RCS quads on the cabin corners
  for (const [x, z] of [[1.3, -0.9], [-1.3, -0.9], [1.3, 1.15], [-1.3, 1.15]]) {
    B.add(new THREE.BoxGeometry(0.22, 0.22, 0.22), MAT.white, x, 4.15, z);
    for (const [dx, dy, dz] of [[1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, Math.sign(z)]]) {
      const c = new THREE.ConeGeometry(0.05, 0.12, 10, 1, true); c.rotateX(Math.PI); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), V(dx * Math.sign(x || 1), dy, dz)));
      B.add(c, MAT.darkAlu, x + dx * Math.sign(x) * 0.15, 4.15 + dy * 0.15, z + dz * 0.15);
    }
  }
  // ---- landing legs: telescoping primary strut, two secondaries, footpad ----
  for (const f of FEET) {
    const dir = f.clone().setY(0).normalize(), side = V(-dir.z, 0, dir.x);
    const top = dir.clone().multiplyScalar(1.75).setY(2.4), foot = f.clone().setY(0.28);
    const mid = top.clone().lerp(foot, 0.55);
    B.beam(top, mid, 0.1, MAT.gold, 12); B.beam(mid.clone().lerp(top, 0.06), foot, 0.065, MAT.alu, 12);
    const knee = top.clone().lerp(foot, 0.72);
    for (const s of [-1, 1]) B.beam(dir.clone().multiplyScalar(1.6).addScaledVector(side, s * 0.75).setY(1.3), knee, 0.04, MAT.alu, 8);
    B.add(new THREE.SphereGeometry(0.11, 12, 8), MAT.darkAlu, knee.x, knee.y, knee.z);
    const pad = new THREE.LatheGeometry([V(0, 0, 0), V(0.42, 0.02, 0), V(0.48, 0.1, 0), V(0.44, 0.16, 0)].map((p) => new THREE.Vector2(p.x, p.y)), 28);
    B.add(pad, MAT.alu, foot.x, 0.0, foot.z);
    B.beam(V(foot.x, 0.1, foot.z), V(foot.x, -0.5, foot.z).lerp(foot, 0), 0.012, MAT.alu);
  }
  // ladder on the front-left leg
  { const f = FEET[2].clone(); const top = f.clone().normalize().multiplyScalar(1.75).setY(2.4), foot = f.clone().setY(0.3);
    const dir = foot.clone().sub(top).normalize(), side = V(-f.z, 0, f.x).normalize().multiplyScalar(0.22);
    for (let i = 1; i < 7; i++) { const p = top.clone().lerp(foot, i / 7); B.beam(p.clone().add(side), p.clone().sub(side), 0.018, MAT.alu); }
    void dir; }
  // ---- engines: one main bell and four throttleable hover engines ----
  bell(B, MAT.nozzle, 0, 1.15, 0, 0.22, 0.6, 0.7);
  const hover = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2, x = Math.cos(a) * 1.92, z = Math.sin(a) * 1.92;
    B.add(new THREE.BoxGeometry(0.4, 0.3, 0.4), MAT.darkAlu, x, 1.42, z, 0, -a, 0);
    bell(B, MAT.nozzle, x, 1.27, z, 0.08, 0.18, 0.32, 0.12 * Math.sign(x || 0.0001), 0);
    hover.push(V(x, 0.95, z));
  }
  // lights
  B.light(MAT.beacon, 0, 5.0, 0.2, 0.07, 'beacon');
  B.light(MAT.strobe, 1.35, 4.35, -0.9, 0.04, 'strobe', 0.3); B.light(MAT.strobe, -1.35, 4.35, -0.9, 0.04, 'strobe', 0.8);
  const lamps = [];
  for (const s of [-1, 1]) { B.add(new THREE.CylinderGeometry(0.13, 0.15, 0.14, 16), MAT.darkAlu, s * 0.85, 2.98, -1.2, Math.PI / 2, 0, 0); }
  const g = B.build();
  for (const s of [-1, 1]) { const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.3, 0.28) })); lens.position.set(s * 0.85, 2.98, -1.28); lens.rotation.y = Math.PI; g.add(lens); lamps.push(lens); }
  const reg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.2), label('K.№ 01', { w: 512, h: 72, size: 52, color: '#1b1a18' })); reg.position.set(1.21, 3.95, 0.15); reg.rotation.y = Math.PI / 2; g.add(reg);
  // flames: wide base at the nozzle, pointing down
  const main = flame(0.56, 5.5, new THREE.Color(3.0, 1.9, 1.0)); main.rotation.x = Math.PI; main.position.y = 0.45; g.add(main);
  const plumes = hover.map((p) => { const f = flame(0.16, 2.0, new THREE.Color(3.2, 2.2, 1.3)); f.rotation.x = Math.PI; f.position.copy(p); g.add(f); return f; });
  g.userData.plume = main; g.userData.plumes = plumes; g.userData.lamps = lamps;
  g.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- flight model ----------
// A_MAX is the same engine on every world, so the thrust-to-weight ratio, the drag of the air and the wind
// make each world fly differently: floaty and slippery on Cosmos, heavy and buffeted on Ekatva.
const A_MAX = 17, A_SIDE = 1.6, VMAX = 26, CLIMB = 7;
export function createLanderSim(env) {
  const g = env.g * 9.81;
  const tiltMax = Math.min(THREE.MathUtils.degToRad(48), Math.acos(Math.min(0.95, g / A_MAX)) * 0.9);
  const s = {
    pos: V(0, 0, 0), vel: V(), yaw: 0, yawRate: 0, tilt: new THREE.Vector2(), quat: new THREE.Quaternion(),
    thrust: 0, side: new THREE.Vector2(), hover: [0, 0, 0, 0], agl: 0, aglHold: 0, contact: false, wasContact: true,
    landed: true, touchdown: null, mode: 'grounded', auto: null, msg: '', msgT: 0,
  };
  const up = V(0, 1, 0), tmp = V(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  function groundNormal() {
    const hs = FEET.map((f) => { const p = f.clone().applyAxisAngle(up, s.yaw).add(s.pos); return env.height(p.x, p.z); });
    // fit the plane through the four feet
    const c = FEET.map((f) => f.clone().applyAxisAngle(up, s.yaw));
    const a = V(c[0].x, hs[0], c[0].z).sub(V(c[2].x, hs[2], c[2].z)), b = V(c[1].x, hs[1], c[1].z).sub(V(c[3].x, hs[3], c[3].z));
    const n = a.cross(b).normalize(); if (n.y < 0) n.negate(); return { n, hs };
  }
  function say(t, sec = 2.5) { s.msg = t; s.msgT = sec; }
  function step(dt, inp) {
    const ground = env.height(s.pos.x, s.pos.z);
    s.agl = s.pos.y - ground;
    const fwd = V(-Math.sin(s.yaw), 0, -Math.cos(s.yaw)), right = V(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    const wind = env.wind();
    // ---- what the pilot (or the autopilot) asks for ----
    let vDes = V(), vyDes = 0, engines = true, yawIn = 0;
    if (s.auto === 'descent') {
      const to = V(env.pad.x - s.pos.x, 0, env.pad.z - s.pos.z); vDes.copy(to).multiplyScalar(0.06).clampLength(0, 22);
      const aB = Math.min(A_MAX - g, 7) * 0.55; vyDes = -THREE.MathUtils.clamp(Math.sqrt(2 * aB * Math.max(0, s.agl - 1.5)), 1.1, 55);
      if (s.agl < 0.25) engines = false;
    } else if (s.auto === 'ascent') {
      vyDes = 32; vDes.copy(fwd).multiplyScalar(6);
    } else {
      vDes.addScaledVector(fwd, inp.fwd).addScaledVector(right, inp.strafe).clampLength(0, 1).multiplyScalar(VMAX * (inp.boost ? 1.7 : 1));
      yawIn = inp.turn;
      if (inp.up) s.aglHold = Math.max(s.aglHold, Math.max(s.agl, 0)) + CLIMB * dt;
      if (inp.down) s.aglHold = Math.max(0, Math.min(s.aglHold, s.agl + 1) - CLIMB * dt);
      s.aglHold = Math.min(s.aglHold, 600);
      if (s.aglHold <= 0.4) { // settling onto the ground
        vyDes = -THREE.MathUtils.clamp(s.agl * 0.6, 0.7, 5);
        if (s.contact) { engines = false; vDes.set(0, 0, 0); }
      } else vyDes = THREE.MathUtils.clamp((s.aglHold - s.agl) * 0.9, -9, CLIMB + 2);
    }
    // ---- yaw ----
    s.yawRate = THREE.MathUtils.lerp(s.yawRate, -yawIn * 1.1, 1 - Math.exp(-dt * 3));
    if (!(s.contact && !engines)) s.yaw += s.yawRate * dt;
    // ---- horizontal: tilt the thrust, and help with the side thrusters ----
    const vh = V(s.vel.x, 0, s.vel.z);
    const aCmd = vDes.clone().sub(vh).multiplyScalar(engines ? 0.9 : 0);
    aCmd.addScaledVector(vh.clone().sub(V(wind.x, 0, wind.z)), env.drag); // lean into drag and wind
    const tiltAcc = aCmd.clone().clampLength(0, g * Math.tan(tiltMax));
    const sideAcc = aCmd.clone().sub(tiltAcc).clampLength(0, A_SIDE);
    const wantTilt = new THREE.Vector2(tiltAcc.x, tiltAcc.z).divideScalar(Math.max(g, 0.5));
    s.tilt.lerp(engines ? wantTilt : new THREE.Vector2(), 1 - Math.exp(-dt * 3.2));
    // body up from the tilt (a small-angle map: tan(theta) along the acceleration)
    const bodyUp = V(s.tilt.x, 1, s.tilt.y).normalize();
    // ---- vertical ----
    const cosT = bodyUp.y;
    const aV = (vyDes - s.vel.y) * 2.4;
    let T = engines ? THREE.MathUtils.clamp((g + aV + env.drag * s.vel.y) / cosT, 0, A_MAX) : 0;
    s.thrust = THREE.MathUtils.lerp(s.thrust, T / A_MAX, 1 - Math.exp(-dt * 10));
    s.side.lerp(new THREE.Vector2(sideAcc.x, sideAcc.z).divideScalar(A_SIDE), 1 - Math.exp(-dt * 10));
    // ---- forces ----
    const acc = bodyUp.clone().multiplyScalar(s.thrust * A_MAX).add(V(s.side.x, 0, s.side.y).multiplyScalar(A_SIDE));
    acc.y -= g;
    acc.addScaledVector(s.vel.clone().sub(wind), -env.drag);
    // ground contact: a spring and damper at each foot
    const { n, hs } = groundNormal(); let contacts = 0; let maxPen = 0;
    FEET.forEach((f, i) => {
      const fp = f.clone().applyAxisAngle(up, s.yaw).add(s.pos); const pen = hs[i] - fp.y;
      if (pen > -0.02) { contacts++; maxPen = Math.max(maxPen, pen); if (pen > 0) acc.y += (pen * 260 - s.vel.y * 26) / 4 * (g / 9.81 + 0.4); }
    });
    s.contact = contacts > 0;
    if (s.contact) { const fr = engines && s.thrust > 0.5 ? 0.8 : 7; s.vel.x *= Math.exp(-dt * fr); s.vel.z *= Math.exp(-dt * fr); }
    s.vel.addScaledVector(acc, dt); s.pos.addScaledVector(s.vel, dt);
    if (maxPen > 0.35) { s.pos.y += maxPen - 0.35; if (s.vel.y < 0) s.vel.y = 0; }
    if (s.pos.y < ground - 0.2) { s.pos.y = ground; s.vel.y = Math.max(0, s.vel.y); }
    for (const c of env.solids) { const dx = s.pos.x - c.x, dz = s.pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + 3; if (d < m && s.pos.y < c.top) { const k = m / Math.max(d, 1e-3); s.pos.x = c.x + dx * k; s.pos.z = c.z + dz * k; const vn = (s.vel.x * dx + s.vel.z * dz) / Math.max(d, 1e-3); if (vn < 0) { s.vel.x -= vn * dx / d; s.vel.z -= vn * dz / d; } } }
    // ---- touchdown ----
    if (s.contact && !s.wasContact) {
      const vs = -s.vel.y; s.touchdown = vs;
      if (vs > 4) say(`Hard landing · ${vs.toFixed(1)} m/s`, 3); else if (vs > 0.3) say(`Touchdown · ${vs.toFixed(1)} m/s`, 2.5);
    }
    s.wasContact = s.contact;
    s.landed = s.contact && !engines && s.vel.length() < 0.6;
    // ---- orientation: the tilt in the air, the ground's slope when resting on it ----
    Q.setFromUnitVectors(up, bodyUp);
    const rest = s.contact && s.thrust < 0.3 ? 1 : 0;
    const qg = new THREE.Quaternion().setFromUnitVectors(up, n);
    Q.slerp(qg, rest);
    const target = Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, s.yaw));
    s.quat.slerp(target, 1 - Math.exp(-dt * (rest ? 6 : 12)));
    // hover engines trim the attitude: show it in their plumes
    const tl = new THREE.Vector2(s.tilt.x, s.tilt.y).rotateAround(new THREE.Vector2(), s.yaw);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; const trim = -(Math.cos(a) * tl.x + Math.sin(a) * tl.y) * 1.5 + s.yawRate * (k % 2 ? 0.4 : -0.4); s.hover[k] = THREE.MathUtils.clamp(s.thrust * 0.8 + trim + (s.side.length() * 0.4), 0, 1) * (engines ? 1 : 0); }
    if (s.msgT > 0) s.msgT -= dt;
    void E; void tmp;
  }
  return {
    s,
    place(x, y, z, yaw = 0) { s.pos.set(x, y, z); s.vel.set(0, 0, 0); s.yaw = yaw; s.quat.setFromAxisAngle(up, yaw); },
    update(dt, inp) { const n = Math.max(1, Math.ceil(dt / (1 / 120))); for (let i = 0; i < n; i++) step(dt / n, inp); },
    say,
  };
}

export function poseLander(g, s, t) {
  g.position.copy(s.pos); g.quaternion.copy(s.quat);
  const flick = 0.85 + 0.15 * Math.sin(t * 61) * Math.sin(t * 23);
  const main = g.userData.plume; main.material.opacity = Math.min(1, s.thrust * 1.2) * flick; main.scale.set(0.6 + s.thrust * 0.5, 0.25 + s.thrust * 1.0, 0.6 + s.thrust * 0.5);
  g.userData.plumes.forEach((p, k) => { const v = s.hover[k]; p.material.opacity = Math.min(1, v * 1.3) * flick; p.scale.set(0.7 + v * 0.4, 0.2 + v * 1.1, 0.7 + v * 0.4); });
}
