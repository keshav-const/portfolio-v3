// The surface rover: an open six-wheeled vehicle for reaching the far landmarks, and its driving model.
// Gravity decides how it handles: on Cosmos it slides and leaves the ground over crests. Throwaway sketch code.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, makeMaterials, Builder, label } from './parts.js';

const WHEEL_R = 0.48;
// six wheels: x (side), z (along; forward is -Z), steering share (front +, rear − : four-wheel steering)
const WHEELS = [[-1.18, -1.55, 1], [1.18, -1.55, 1], [-1.18, 0, 0], [1.18, 0, 0], [-1.18, 1.55, -0.45], [1.18, 1.55, -0.45]];
export const SEAT = new THREE.Vector3(-0.45, 1.02, 0.15); // the driver's seat, in the rover's frame

function wheel() {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.13, 0.13, 10, 28), MAT.black); tyre.rotation.y = Math.PI / 2; g.add(tyre);
  // tread blocks round the tyre
  const blk = new THREE.BoxGeometry(0.3, 0.05, 0.1), treadM = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
  const tread = new THREE.InstancedMesh(blk, treadM, 22);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a); m.compose(new THREE.Vector3(0, Math.cos(a) * (WHEEL_R - 0.01), Math.sin(a) * (WHEEL_R - 0.01)), q, new THREE.Vector3(1, 1, 1)); tread.setMatrixAt(i, m); }
  tread.castShadow = true; g.add(tread);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16), MAT.alu); hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, WHEEL_R * 1.4, 0.05), MAT.darkAlu); s.rotation.x = (k / 5) * Math.PI; g.add(s); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildRover() {
  makeMaterials();
  const accent = new THREE.MeshStandardMaterial({ color: 0xd93a2b, roughness: 0.55 });
  const B = new Builder();
  // chassis: a tube frame with a low white tub between the wheels
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const x of [-0.95, 0.95]) { B.beam(V(x, 0.62, -2.1), V(x, 0.62, 2.0), 0.05, MAT.darkAlu); B.beam(V(x, 0.62, -2.1), V(x * 0.8, 0.95, -2.35), 0.04, MAT.darkAlu); }
  for (const z of [-2.0, -0.9, 0.3, 1.5]) B.beam(V(-0.95, 0.62, z), V(0.95, 0.62, z), 0.04, MAT.darkAlu);
  B.add(new RoundedBoxGeometry(1.85, 0.32, 3.9, 3, 0.08), MAT.white, 0, 0.62, -0.05);
  B.add(new THREE.BoxGeometry(1.9, 0.06, 3.95), accent, 0, 0.8, -0.05);
  // fenders over the wheels
  for (const [x, z] of WHEELS) { const f = new THREE.CylinderGeometry(WHEEL_R + 0.1, WHEEL_R + 0.1, 0.36, 16, 1, true, 0, Math.PI); B.add(f, MAT.white, x * 1.02, WHEEL_R + 0.02, z, 0, Math.PI / 2, Math.PI / 2); }
  // nose: instrument console, headlight bar and a bumper
  B.add(new RoundedBoxGeometry(1.7, 0.42, 0.55, 3, 0.06), MAT.hull, 0, 1.0, -1.75);
  B.add(new THREE.BoxGeometry(1.2, 0.36, 0.06), MAT.glass, 0, 1.28, -1.48, -0.5, 0, 0);
  B.add(new THREE.BoxGeometry(1.6, 0.1, 0.12), MAT.darkAlu, 0, 0.62, -2.15);
  B.add(new THREE.BoxGeometry(1.4, 0.14, 0.08), MAT.black, 0, 0.88, -2.08);
  // two seats with frames, and a steering yoke for the driver
  for (const x of [-0.45, 0.45]) {
    B.add(new RoundedBoxGeometry(0.55, 0.12, 0.55, 2, 0.04), MAT.black, x, 0.98, 0.15);
    B.add(new RoundedBoxGeometry(0.55, 0.62, 0.1, 2, 0.04), MAT.black, x, 1.3, 0.48, 0.18, 0, 0);
    B.beam(V(x - 0.25, 0.8, 0.5), V(x - 0.25, 1.55, 0.6), 0.025, MAT.alu); B.beam(V(x + 0.25, 0.8, 0.5), V(x + 0.25, 1.55, 0.6), 0.025, MAT.alu);
  }
  B.beam(V(-0.45, 1.05, -1.45), V(-0.45, 1.35, -0.85), 0.03, MAT.darkAlu);
  B.add(new THREE.TorusGeometry(0.17, 0.025, 8, 20), MAT.black, -0.45, 1.38, -0.8, -0.9, 0, 0);
  // rear deck: a foil-wrapped equipment box, a solar panel, a high-gain dish on a mast
  B.add(new THREE.BoxGeometry(1.6, 0.5, 1.0), MAT.gold, 0, 1.05, 1.45);
  B.panel(1.7, 1.1, MAT.solar, MAT.alu, 0, 1.33, 1.45, 0.08, 0, 0);
  B.beam(V(0.75, 0.9, 1.0), V(0.75, 2.6, 1.0), 0.035, MAT.alu);
  B.add(new THREE.SphereGeometry(0.38, 24, 10, 0, Math.PI * 2, 0, 0.9), MAT.white, 0.75, 2.75, 1.0, -0.9, 0.5, 0);
  B.beam(V(-0.8, 0.9, 1.9), V(-0.8, 2.2, 1.9), 0.012, MAT.alu);
  B.light(MAT.beacon, -0.8, 2.22, 1.9, 0.045, 'beacon', 0.4);
  const g = B.build();
  // "K.№ 02" on the side of the tub
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), label('K.№ 02', { w: 512, h: 128, size: 64, color: '#1b1a18' }));
  tag.position.set(0.932, 0.64, 0.6); tag.rotation.y = Math.PI / 2; g.add(tag);
  // headlamps: glowing faces (bright at night) and two lights
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.3, 0.28) });
  const lamps = [];
  for (const x of [-0.55, 0.55]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), lampM); l.position.set(x, 0.88, -2.125); l.rotation.y = Math.PI; g.add(l); }
  for (const x of [-0.55, 0.55]) { const sp = new THREE.SpotLight(0xfff3e0, 0, 90, 0.5, 0.5, 1.6); sp.position.set(x, 0.9, -2.2); sp.target.position.set(x, -0.5, -20); g.add(sp, sp.target); lamps.push(sp); }
  // wheels on short swing arms, so they can follow the ground
  const wheels = WHEELS.map(([x, z, steer]) => {
    const pivot = new THREE.Group(); pivot.position.set(x * 1.04, WHEEL_R, z); g.add(pivot);
    const w = wheel(); pivot.add(w);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), MAT.darkAlu); arm.position.set(-Math.sign(x) * 0.18, 0.12, 0); arm.rotation.x = 0.3; pivot.add(arm); arm.castShadow = true;
    return { pivot, w, x: x * 1.04, z, steer, travel: 0 };
  });
  g.userData = { ...g.userData, wheels, lampM, lamps };
  return g;
}

// env: { g (in g), heightAt(x,z), solids: [{x,z,r,top}], collide(p, rad, y), bound }
export function createRoverSim(env) {
  const G = env.g * 9.81, grip = THREE.MathUtils.clamp(env.g * 8, 1.4, 9), traction = THREE.MathUtils.clamp(env.g * 1.15, 0.35, 1);
  const s = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), vy: 0, yaw: 0, steer: 0, speed: 0, pitch: 0, roll: 0, air: false, airT: 0, spin: 0, bump: 0 };
  const fwdV = new THREE.Vector3();
  const corners = [[-1.1, -1.6], [1.1, -1.6], [-1.1, 1.6], [1.1, 1.6]];
  function ground(x, z, yaw) { // heights under the four corner wheels
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    return corners.map(([lx, lz]) => env.heightAt(x + lx * c + lz * sn, z - lx * sn + lz * c));
  }
  function place(x, z, yaw) { s.pos.set(x, env.heightAt(x, z), z); s.yaw = yaw; s.vel.set(0, 0, 0); s.vy = 0; s.speed = 0; s.air = false; }
  function step(dt, inp) {
    fwdV.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const top = inp.boost ? 20 : 13, rev = 5;
    // throttle, brake, rolling resistance; less push and braking in low gravity (less grip)
    let a = 0;
    if (inp.fwd > 0) a = (s.speed < top ? 5.5 : -2) * traction;
    else if (inp.fwd < 0) a = s.speed > 0.5 ? -9 * traction : s.speed > -rev ? -3 * traction : 0;
    else a = -Math.sign(s.speed) * Math.min(Math.abs(s.speed) / dt, 1.2);
    if (inp.brake) a = -Math.sign(s.speed) * Math.min(Math.abs(s.speed) / dt, 10 * traction);
    if (s.air) a = 0;
    // gravity along the slope
    const h = ground(s.pos.x, s.pos.z, s.yaw), grade = ((h[0] + h[1]) - (h[2] + h[3])) / 2 / 3.2;
    if (!s.air) a -= G * grade * 0.9;
    s.speed += a * dt;
    // steering: tighter at low speed; the rover turns about its middle (front and rear wheels steer)
    s.steer += (inp.turn * 0.55 / (1 + Math.abs(s.speed) / 10) - s.steer) * (1 - Math.exp(-dt * 6));
    if (!s.air) s.yaw -= (s.speed * Math.tan(s.steer) / 2.4) * dt;
    // the wheels pull the motion toward the heading; how hard depends on gravity, so low gravity slides
    fwdV.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    if (!s.air) { // the sideways part of the motion dies away with grip; along the heading the wheels set the speed
      const along = s.vel.x * fwdV.x + s.vel.z * fwdV.z, k = Math.exp(-dt * grip);
      const lx = (s.vel.x - fwdV.x * along) * k, lz = (s.vel.z - fwdV.z * along) * k;
      s.vel.set(fwdV.x * s.speed + lx, 0, fwdV.z * s.speed + lz);
    }
    s.pos.x += s.vel.x * dt; s.pos.z += s.vel.z * dt;
    // bump into buildings, trees and rocks
    const px = s.pos.x, pz = s.pos.z;
    for (const c of env.solids) { if (c.top !== undefined && s.pos.y > c.top) continue; const dx = s.pos.x - c.x, dz = s.pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + 2.0; if (d < m && !(c.wall && d < c.r - 4)) { const k = m / Math.max(d, 1e-3); s.pos.x = c.x + dx * k; s.pos.z = c.z + dz * k; } }
    env.collide(s.pos, 1.9, s.pos.y);
    if (Math.abs(s.pos.x - px) + Math.abs(s.pos.z - pz) > 1e-4) { s.speed *= 0.6; s.vel.multiplyScalar(0.6); s.bump = 0.3; }
    s.pos.x = THREE.MathUtils.clamp(s.pos.x, -env.bound, env.bound); s.pos.z = THREE.MathUtils.clamp(s.pos.z, -env.bound, env.bound);
    // vertical: follow the ground, or leave it over a crest when it falls away faster than gravity
    const g2 = ground(s.pos.x, s.pos.z, s.yaw), gy = (g2[0] + g2[1] + g2[2] + g2[3]) / 4;
    if (s.air) {
      s.vy -= G * dt; s.pos.y += s.vy * dt; s.airT += dt;
      if (s.pos.y <= gy) { s.pos.y = gy; s.bump = Math.min(0.5, -s.vy * 0.04); s.vy = 0; s.air = false; }
    } else {
      // the ground's vertical speed under the rover, smoothed (the springs take the small stuff) and kept to what
      // driving up a slope can give
      const cap = Math.abs(s.speed) * 0.45 + 0.5, vyG = THREE.MathUtils.clamp((gy - s.pos.y) / dt, -cap, cap);
      if (vyG < s.vy - G * dt * 2.5 && Math.abs(s.speed) > 5) { s.air = true; s.airT = 0; s.vy = Math.max(s.vy, 0) * 0.7 - G * dt; s.pos.y += s.vy * dt; }
      else { s.vy += (vyG - s.vy) * 0.35; s.pos.y = gy; }
    }
    // body attitude from the four wheels (held while in the air)
    if (!s.air) {
      const tp = Math.atan2((g2[0] + g2[1]) - (g2[2] + g2[3]), 2 * 3.2), tr = Math.atan2((g2[1] + g2[3]) - (g2[0] + g2[2]), 2 * 2.2);
      s.pitch += (tp - s.pitch) * (1 - Math.exp(-dt * 10)); s.roll += (tr - s.roll) * (1 - Math.exp(-dt * 10));
    }
    s.spin += (s.speed / WHEEL_R) * dt; s.bump = Math.max(0, s.bump - dt);
    s.wheelGround = g2;
  }
  return {
    s, place,
    update(dt, inp) { const n = Math.max(1, Math.ceil(dt / (1 / 120))); for (let i = 0; i < n; i++) step(dt / n, inp); },
  };
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
export function poseRover(g, s, night, t) {
  g.position.copy(s.pos); g.position.y += Math.sin(t * 30) * s.bump * 0.03;
  g.quaternion.setFromEuler(_e.set(s.pitch, s.yaw, s.roll, 'YXZ'));
  const { wheels, lampM, lamps } = g.userData;
  for (const w of wheels) {
    w.w.rotation.x = -s.spin;
    w.pivot.rotation.y = s.steer * w.steer;
    // suspension: each wheel reaches for the ground under it (in the air they hang down)
    const want = s.air ? -0.22 : 0;
    w.travel += (want - w.travel) * 0.2; w.pivot.position.y = WHEEL_R + w.travel;
  }
  lampM.color.setScalar(0.3 + night * 6);
  for (const l of lamps) l.intensity = night * 2200;
}
