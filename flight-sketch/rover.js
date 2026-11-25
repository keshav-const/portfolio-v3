// The surface rover and its driving model. Throwaway sketch code.
// Six metal wheels on rocker-bogie suspension (each wheel follows the ground under it), a roll cage over two seats,
// a camera mast, a cargo deck. The physics: grip and braking follow gravity; wind pushes on it; small rocks are
// driven over, big ones and trees are hit; in water it wades, and in deep water it floats and drifts with the current.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, makeMaterials, Builder, label } from './parts.js';

const WHEEL_R = 0.5;
// x (side), z (along; forward is -Z), steering share (front +, rear −: four-wheel steering)
const WHEELS = [[-1.25, -1.75, 1], [1.25, -1.75, 1], [-1.25, 0.05, 0], [1.25, 0.05, 0], [-1.25, 1.7, -0.5], [1.25, 1.7, -0.5]];
const ROCKER = { z: -0.35, y: 0.98 }, BOGIE = { z: 0.88 };
export const SEAT = new THREE.Vector3(-0.42, 1.12, 0.05); // the driver's seat, in the rover's frame

let _mats = null;
function mats() {
  if (_mats) return _mats;
  const S = (o) => new THREE.MeshStandardMaterial(o);
  _mats = {
    accent: S({ color: 0xd93a2b, roughness: 0.5 }),
    rim: S({ color: 0x8d9296, roughness: 0.35, metalness: 0.9 }),
    grouser: S({ color: 0x55595d, roughness: 0.5, metalness: 0.8 }),
    fabric: S({ color: 0x1c1c1e, roughness: 0.95 }),
    screen: S({ color: 0x111111, emissive: 0xffb200, emissiveIntensity: 0.9, roughness: 0.3 }),
    screen2: S({ color: 0x111111, emissive: 0x9fd6c8, emissiveIntensity: 0.6, roughness: 0.3 }),
    lightbar: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.34, 0.32) }),
  };
  return _mats;
}

// a metal wheel: an open rim with chevron grousers, flexure spokes and a cap
function wheel(side) {
  const M = mats(), g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R - 0.03, WHEEL_R - 0.03, 0.38, 32, 1, true), M.rim); rim.rotation.z = Math.PI / 2; g.add(rim);
  for (const x of [-0.19, 0.19]) { const lip = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.03, 0.025, 6, 32), M.rim); lip.rotation.y = Math.PI / 2; lip.position.x = x; g.add(lip); }
  const blade = new THREE.BoxGeometry(0.21, 0.06, 0.035), N = 18;
  const gr = new THREE.InstancedMesh(blade, M.grouser, N * 2), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < N; i++) for (const s of [-1, 1]) {
    const a = (i / N) * Math.PI * 2;
    q.setFromEuler(e.set(a, s * 0.45, 0, 'XYZ'));
    m.compose(new THREE.Vector3(s * 0.09, Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R), q, new THREE.Vector3(1, 1, 1)); gr.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m);
  }
  g.add(gr);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 16), MAT.darkAlu); hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 4, 10, Math.PI * 0.7), MAT.alu); sp.rotation.set((k / 6) * Math.PI * 2, Math.PI / 2, 0); g.add(sp); }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16), M.accent); cap.rotation.z = Math.PI / 2; cap.position.x = side * 0.22; g.add(cap);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// a unit beam, stretched between two points each frame (the suspension arms)
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8); beamGeo.rotateX(Math.PI / 2);
function beam(r, mat) { const m = new THREE.Mesh(beamGeo, mat); m.userData.r = r; m.castShadow = true; return m; }
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _zA = new THREE.Vector3(0, 0, 1);
function setBeam(m, a, b) {
  m.position.copy(a).add(b).multiplyScalar(0.5);
  _d.subVectors(b, a); const len = _d.length();
  m.quaternion.setFromUnitVectors(_zA, _d.divideScalar(Math.max(len, 1e-4)));
  m.scale.set(m.userData.r, m.userData.r, len);
}

export function buildRover() {
  makeMaterials(); const M = mats();
  const B = new Builder(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  // ---- chassis and body ----
  B.add(new RoundedBoxGeometry(1.95, 0.34, 4.0, 3, 0.1), MAT.hull, 0, 0.95, 0);
  B.add(new RoundedBoxGeometry(2.0, 0.08, 4.05, 2, 0.03), M.accent, 0, 0.8, 0);
  B.add(new THREE.BoxGeometry(1.7, 0.1, 3.7), MAT.darkAlu, 0, 0.74, 0);
  // the prow: sloped, with a light bar and a skid plate
  B.add(new RoundedBoxGeometry(1.9, 0.5, 0.8, 3, 0.1), MAT.hull, 0, 1.1, -1.95, -0.35, 0, 0);
  B.add(new THREE.BoxGeometry(1.5, 0.08, 0.06), M.lightbar, 0, 1.08, -2.36, -0.35, 0, 0);
  B.add(new THREE.BoxGeometry(1.7, 0.1, 0.5), MAT.darkAlu, 0, 0.72, -2.2, 0.35, 0, 0);
  // side lockers with handles
  for (const x of [-1, 1]) for (const z of [-0.9, 0.9]) { B.add(new THREE.BoxGeometry(0.06, 0.26, 0.9), MAT.white, x * 0.99, 0.98, z); B.add(new THREE.BoxGeometry(0.03, 0.03, 0.3), MAT.darkAlu, x * 1.03, 1.02, z); }
  // fenders over the wheels
  for (const [x, z] of WHEELS) B.add(new THREE.CylinderGeometry(WHEEL_R + 0.12, WHEEL_R + 0.12, 0.44, 18, 1, true, Math.PI / 2 - 0.9, 1.8), MAT.white, x, WHEEL_R + 0.05, z, 0, 0, Math.PI / 2);
  // ---- the cockpit: a console with screens, two bucket seats with harnesses, a control yoke ----
  B.add(new RoundedBoxGeometry(1.75, 0.45, 0.55, 3, 0.08), MAT.white, 0, 1.3, -1.35, -0.25, 0, 0);
  B.add(new THREE.BoxGeometry(0.42, 0.26, 0.02), M.screen, -0.42, 1.5, -1.2, -0.75, 0, 0);
  B.add(new THREE.BoxGeometry(0.42, 0.26, 0.02), M.screen2, 0.42, 1.5, -1.2, -0.75, 0, 0);
  for (const x of [-0.42, 0.42]) {
    B.add(new RoundedBoxGeometry(0.58, 0.14, 0.6, 3, 0.05), M.fabric, x, 1.16, 0.05);
    B.add(new RoundedBoxGeometry(0.58, 0.75, 0.14, 3, 0.05), M.fabric, x, 1.55, 0.38, 0.15, 0, 0);
    B.add(new RoundedBoxGeometry(0.3, 0.22, 0.12, 2, 0.04), M.fabric, x, 2.02, 0.46, 0.15, 0, 0);
    for (const dx of [-0.16, 0.16]) B.add(new THREE.BoxGeometry(0.05, 0.6, 0.02), M.accent, x + dx, 1.55, 0.3, 0.15, 0, 0);
  }
  B.beam(V(-0.42, 1.15, -1.1), V(-0.42, 1.42, -0.7), 0.03, MAT.darkAlu);
  B.add(new THREE.TorusGeometry(0.16, 0.025, 8, 20, Math.PI * 1.4), MAT.black, -0.42, 1.45, -0.66, -1.0, 0, Math.PI * 0.8);
  // ---- roll cage: two hoops and a spine ----
  const hoop = (z, h, w) => { const pts = [V(-w, 1.05, z), V(-w, 1.05 + h * 0.8, z), V(-w * 0.75, 1.05 + h, z), V(w * 0.75, 1.05 + h, z), V(w, 1.05 + h * 0.8, z), V(w, 1.05, z)]; B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.04, 8), MAT.darkAlu); };
  hoop(-0.75, 1.2, 0.92); hoop(0.62, 1.32, 0.92);
  for (const x of [-0.7, 0.7]) B.beam(V(x, 2.37, 0.62), V(x, 2.25, -0.75), 0.035, MAT.darkAlu);
  B.beam(V(-0.7, 2.31, -0.1), V(0.7, 2.31, -0.1), 0.03, MAT.darkAlu);
  // ---- rear deck: a foil-wrapped equipment bay, sample cases, radiators, a solar panel over it all ----
  B.add(new THREE.BoxGeometry(1.7, 0.55, 1.05), MAT.gold, 0, 1.38, 1.4);
  for (const x of [-0.55, 0, 0.55]) B.add(new RoundedBoxGeometry(0.42, 0.22, 0.3, 2, 0.03), MAT.white, x, 1.25, 0.95);
  B.panel(1.9, 1.25, MAT.solar, MAT.alu, 0, 1.75, 1.5, 0.06, 0, 0);
  for (const x of [-0.97, 0.97]) B.add(new THREE.BoxGeometry(0.03, 0.45, 0.9), MAT.rad, x, 1.38, 1.4);
  for (const x of [-1.25, 1.25]) B.add(new THREE.BoxGeometry(0.4, 0.4, 0.03), MAT.black, x, 0.55, 2.15);
  B.beam(V(-0.9, 1.6, 1.95), V(-0.9, 2.9, 1.95), 0.012, MAT.alu); B.light(MAT.beacon, -0.9, 2.92, 1.95, 0.045, 'beacon', 0.4);
  const g = B.build();
  g.children.forEach((c) => { if (c.isMesh && !c.material.isMeshBasicMaterial) { c.castShadow = true; c.receiveShadow = true; } });
  for (const s of [-1, 1]) { const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), label('K.№ 02', { w: 512, h: 128, size: 64, color: '#1b1a18' })); tag.position.set(s * 0.982, 1.0, -0.15); tag.rotation.y = s * Math.PI / 2; g.add(tag); }
  // ---- camera mast: it looks where you steer ----
  const mast = new THREE.Group(); mast.position.set(0.72, 1.66, 0.85); g.add(mast);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 10), MAT.alu); pole.position.y = 0.65; mast.add(pole);
  const head = new THREE.Group(); head.position.y = 1.36; mast.add(head);
  head.add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.2, 0.22, 2, 0.04), MAT.white));
  for (const x of [-0.14, 0.14]) { const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), MAT.glass); lens.rotation.x = Math.PI / 2; lens.position.set(x, 0, -0.13); head.add(lens); }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 8, 0, Math.PI * 2, 0, 0.9), MAT.white); dish.position.set(0, 0.22, 0.12); dish.rotation.x = -1.0; head.add(dish);
  mast.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // headlamps
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.3, 0.28) }), lamps = [];
  for (const x of [-0.62, 0.62]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), lampM); l.position.set(x, 0.98, -2.37); l.rotation.set(0.35, Math.PI, 0); g.add(l); }
  for (const x of [-0.6, 0.6]) { const sp = new THREE.SpotLight(0xfff3e0, 0, 110, 0.55, 0.5, 1.5); sp.position.set(x, 1.0, -2.45); sp.target.position.set(x * 2, -0.8, -24); g.add(sp, sp.target); lamps.push(sp); }
  // ---- wheels and the rocker-bogie arms ----
  const wheels = WHEELS.map(([x, z, steer]) => {
    const pivot = new THREE.Group(); pivot.position.set(x, WHEEL_R, z); g.add(pivot);
    const w = wheel(Math.sign(x)); pivot.add(w);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.12), MAT.darkAlu); fork.position.set(-Math.sign(x) * 0.25, 0.2, 0); pivot.add(fork); fork.castShadow = true;
    return { pivot, w, x, z, steer, travel: 0 };
  });
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = { side: sx, rf: beam(0.055, MAT.darkAlu), rb: beam(0.055, MAT.darkAlu), bm: beam(0.05, MAT.darkAlu), br: beam(0.05, MAT.darkAlu), joint: new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M.accent) };
    for (const k of ['rf', 'rb', 'bm', 'br', 'joint']) g.add(a[k]);
    arms.push(a);
  }
  g.userData = { ...g.userData, wheels, arms, lampM, lamps, head };
  return g;
}

// ---------- the driving model ----------
// env: { g (in g), drag, heightAt(x,z), solids: [{x,z,r,top,wall}], query(p, rad, out), bound, water (level or null),
//        current(x, z, out) (water flow, m/s), wind() (Vector3, m/s) }
export function createRoverSim(env) {
  const G = env.g * 9.81, grip = THREE.MathUtils.clamp(env.g * 8, 1.4, 9), traction0 = THREE.MathUtils.clamp(env.g * 1.15, 0.35, 1);
  const s = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), vy: 0, yaw: 0, steer: 0, speed: 0, pitch: 0, roll: 0, air: false, float: false, depth: 0,
    spin: 0, bump: 0, hit: 0, splash: 0, msg: '', msgT: 0 };
  const fwdV = new THREE.Vector3(), cur = new THREE.Vector3(), aw = new THREE.Vector3(), near = [], obstacles = [], bumps = [];
  const corners = [[-1.2, -1.75], [1.2, -1.75], [-1.2, 1.7], [1.2, 1.7]];
  // small rocks are driven over: each adds a dome to the ground
  const rockLift = (x, z) => { let l = 0; for (const r of bumps) { const dx = x - r.x, dz = z - r.z, d2 = (dx * dx + dz * dz) / (r.r * r.r * 1.4); if (d2 < 1) l = Math.max(l, r.h * (1 - d2)); } return l; };
  const groundAt = (x, z) => env.heightAt(x, z) + rockLift(x, z);
  function ground(x, z, yaw) {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    return corners.map(([lx, lz]) => groundAt(x + lx * c + lz * sn, z - lx * sn + lz * c));
  }
  function place(x, z, yaw) { s.pos.set(x, env.heightAt(x, z), z); s.yaw = yaw; s.vel.set(0, 0, 0); s.vy = 0; s.speed = 0; s.air = false; s.float = false; }
  const say = (m) => { s.msg = m; s.msgT = 2.5; };
  // what is nearby, refreshed once a frame: rocks low enough to climb over, and things to hit
  function survey() {
    env.query(s.pos, 14, near); obstacles.length = 0; bumps.length = 0;
    for (const r of near) { const h = r.top - env.heightAt(r.x, r.z); if (h < 0.75 && !r.tall) bumps.push({ x: r.x, z: r.z, r: r.r, h }); else obstacles.push(r); }
  }
  function collide() {
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    for (const lz of [-1.5, 0, 1.5]) { // the body as three circles, nose to tail, as wide as the wheels
      const cx = s.pos.x + lz * sn, cz = s.pos.z + lz * c, R = 1.4;
      for (const list of [obstacles, env.solids]) for (const o of list) {
        if (o.top !== undefined && s.pos.y > o.top) continue;
        const dx = cx - o.x, dz = cz - o.z, d = Math.hypot(dx, dz), m = o.r + R;
        if (d >= m || (o.wall && d < o.r - 4)) continue;
        const nx = dx / Math.max(d, 1e-3), nz = dz / Math.max(d, 1e-3);
        s.pos.x += nx * (m - d); s.pos.z += nz * (m - d);
        const vn = s.vel.x * nx + s.vel.z * nz;
        if (vn < 0) { // a knock: most of the speed into the obstacle is lost, a little bounces back, the body twists
          s.vel.x -= 1.25 * vn * nx; s.vel.z -= 1.25 * vn * nz;
          s.yaw += lz * (nx * c - nz * sn) * vn * 0.012;
          const hit = -vn; if (hit > 2.5) { s.bump = Math.min(1, hit * 0.07); s.hit = hit; if (hit > 6) say('Impact · slow down near rocks'); }
        }
      }
    }
  }
  function step(dt, inp) {
    fwdV.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const base = env.heightAt(s.pos.x, s.pos.z);
    s.depth = env.water === null ? 0 : Math.max(0, env.water - base);
    if (env.water !== null) env.current(s.pos.x, s.pos.z, cur); else cur.set(0, 0, 0);
    const wind = env.wind();
    if (s.depth > 1.1 && !s.float && !s.air) { s.float = true; say('Afloat · the wheels paddle, the current carries you'); }
    if (s.float) {
      // afloat: the wheels paddle slowly, the water drags toward its own flow, the wind pushes on the body
      s.vel.addScaledVector(fwdV, (inp.fwd > 0 ? 1.7 * inp.fwd : inp.fwd < 0 ? 1.0 * inp.fwd : 0) * dt);
      const k = 1 - Math.exp(-dt * 0.7); s.vel.x += (cur.x - s.vel.x) * k; s.vel.z += (cur.z - s.vel.z) * k;
      s.vel.x += (wind.x - s.vel.x) * env.drag * 0.12 * dt; s.vel.z += (wind.z - s.vel.z) * env.drag * 0.12 * dt;
      s.speed = s.vel.x * fwdV.x + s.vel.z * fwdV.z;
      s.yaw -= inp.turn * 0.35 * (0.4 + Math.min(1, Math.abs(s.speed) / 2.5)) * dt;
      s.steer += (inp.turn * 0.3 - s.steer) * (1 - Math.exp(-dt * 6));
      s.vy += ((env.water - 0.45 - s.pos.y) * 9 - s.vy * 3.5) * dt; s.pos.y += s.vy * dt;
      s.pitch *= 1 - dt * 2; s.roll *= 1 - dt * 2;
      s.pos.x += s.vel.x * dt; s.pos.z += s.vel.z * dt;
      collide();
      if (s.depth < 1.0) { s.float = false; s.vy = 0; say('Wheels on the bottom'); }
      s.splash = Math.abs(s.speed) * 0.6 + 0.2;
    } else {
      const wade = s.depth > 0.2 ? Math.min(1, s.depth / 1.1) : 0, traction = traction0 * (1 - wade * 0.2);
      const h = ground(s.pos.x, s.pos.z, s.yaw), grade = ((h[0] + h[1]) - (h[2] + h[3])) / 2 / 3.45, th = Math.atan(grade);
      // the wheels can push (or brake) only as hard as friction allows: friction × gravity × cos(slope);
      // the motors give strong pull at low speed and less as speed rises (power-limited)
      const grip0 = (0.95 - wade * 0.25) * G * Math.cos(th), motor = Math.min(7, 70 / Math.max(Math.abs(s.speed), 1));
      const top = inp.boost ? 20 : 13, rev = 5;
      let a = 0;
      if (inp.fwd > 0) a = s.speed < top ? Math.min(motor, grip0) * inp.fwd : -1.5;
      else if (inp.fwd < 0) a = s.speed > 0.5 ? -grip0 * 0.9 : s.speed > -rev ? Math.min(motor, grip0) * 0.6 * inp.fwd : 0;
      else a = -Math.sign(s.speed) * Math.min(Math.abs(s.speed) / dt, 1.0);
      if (inp.brake) a = -Math.sign(s.speed) * Math.min(Math.abs(s.speed) / dt, grip0);
      if (s.air) a = 0;
      if (!s.air) a -= G * Math.sin(th);
      // water holds the rover back, with the square of speed, more the deeper it is
      if (wade) a -= s.speed * Math.abs(s.speed) * 0.06 * wade + s.speed * 0.6 * wade;
      // wind: a head or tail wind changes the speed a little; across, it pushes the rover sideways
      // along the heading the rover is slim (little drag); across it, its side catches the wind
      aw.copy(wind).sub(s.vel);
      const awF = (aw.x * fwdV.x + aw.z * fwdV.z) * env.drag * 0.25, awS = (-aw.x * fwdV.z + aw.z * fwdV.x) * env.drag * 0.9;
      aw.set(fwdV.x * awF - fwdV.z * awS, 0, fwdV.z * awF + fwdV.x * awS);
      if (!s.air) s.yaw -= awS * 0.004 * dt * (1 - Math.min(1, Math.abs(s.speed) / 25)); // and turns it a little, like a vane
      s.speed += (a + (s.air ? 0 : awF)) * dt;
      s.steer += (inp.turn * 0.55 / (1 + Math.abs(s.speed) / 10) - s.steer) * (1 - Math.exp(-dt * 6));
      if (!s.air) s.yaw -= (s.speed * Math.tan(s.steer) / 2.5) * dt;
      fwdV.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
      if (!s.air) { // sideways motion dies away with grip (less in low gravity and in water); the wheels set the speed along the heading
        const along = s.vel.x * fwdV.x + s.vel.z * fwdV.z, k = Math.exp(-dt * grip * (1 - wade * 0.5));
        const lx = (s.vel.x - fwdV.x * along) * k + (aw.x - fwdV.x * awF) * dt + cur.x * wade * 0.4 * dt;
        const lz = (s.vel.z - fwdV.z * along) * k + (aw.z - fwdV.z * awF) * dt + cur.z * wade * 0.4 * dt;
        s.vel.set(fwdV.x * s.speed + lx, 0, fwdV.z * s.speed + lz);
      } else { s.vel.x += aw.x * dt; s.vel.z += aw.z * dt; }
      s.pos.x += s.vel.x * dt; s.pos.z += s.vel.z * dt;
      collide();
      s.speed = s.vel.x * fwdV.x + s.vel.z * fwdV.z;
      // vertical: follow the ground, or leave it over a crest when it falls away faster than gravity can pull
      const g2 = ground(s.pos.x, s.pos.z, s.yaw), gy = (g2[0] + g2[1] + g2[2] + g2[3]) / 4;
      if (s.air) {
        s.vy -= G * dt; s.pos.y += s.vy * dt;
        const onWater = s.depth > 1.1 && env.water - 0.45 > gy;
        if (onWater && s.pos.y <= env.water - 0.45) { s.air = false; s.float = true; s.vy *= 0.3; s.splash = 6 + Math.abs(s.speed); s.bump = 0.5; say('Splashdown · afloat'); }
        else if (s.pos.y <= gy) { s.pos.y = gy; s.bump = Math.min(0.8, -s.vy * 0.06); s.vy = 0; s.air = false; }
      } else {
        const cap = Math.abs(s.speed) * 0.45 + 0.5, vyG = THREE.MathUtils.clamp((gy - s.pos.y) / dt, -cap, cap);
        if (vyG < s.vy - G * dt * 2.5 && Math.abs(s.speed) > 5) { s.air = true; s.vy = Math.max(s.vy, 0) * 0.7 - G * dt; s.pos.y += s.vy * dt; }
        else { s.vy += (vyG - s.vy) * 0.35; s.pos.y = gy; }
      }
      if (!s.air) {
        const tp = Math.atan2((g2[0] + g2[1]) - (g2[2] + g2[3]), 2 * 3.45), tr = Math.atan2((g2[1] + g2[3]) - (g2[0] + g2[2]), 2 * 2.4);
        s.pitch += (tp - s.pitch) * (1 - Math.exp(-dt * 10)); s.roll += (tr - s.roll) * (1 - Math.exp(-dt * 10));
      }
      s.splash = wade > 0 ? Math.abs(s.speed) * wade : 0;
      // wheels spin faster than the ground passes when they slip (pulling away on low-grip ground)
      s.spin += (inp.fwd && !s.air ? inp.fwd * (1 - traction) * 5 : 0) / WHEEL_R * dt;
    }
    // pushing but not moving (a bank too steep, a rock): say so once in a while
    s.stuckT = inp.fwd && Math.abs(s.speed) < 0.4 && !s.air ? (s.stuckT || 0) + dt : 0;
    if (s.stuckT > 2.5) { s.stuckT = 0; say(s.depth > 0.3 || s.float ? 'Too steep to climb out · let the current carry you to a ford' : 'Too steep · try another way'); }
    s.pos.x = THREE.MathUtils.clamp(s.pos.x, -env.bound, env.bound); s.pos.z = THREE.MathUtils.clamp(s.pos.z, -env.bound, env.bound);
    s.spin += (s.speed / WHEEL_R) * dt;
    s.bump = Math.max(0, s.bump - dt * 1.5);
  }
  return {
    s, place, groundAt,
    update(dt, inp) { survey(); const n = Math.max(1, Math.ceil(dt / (1 / 120))); for (let i = 0; i < n; i++) step(dt / n, inp); s.msgT = Math.max(0, s.msgT - dt); s.hit = Math.max(0, s.hit - dt * 4); },
  };
}

// ---------- posing: body, wheels reaching for the ground, the arms that hold them ----------
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _w = new THREE.Vector3(), _l = new THREE.Vector3(), _m = new THREE.Matrix4();
const _hub = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], _piv = new THREE.Vector3(), _bog = new THREE.Vector3();
export function poseRover(g, s, groundAt, night, t, dt) {
  g.position.copy(s.pos);
  const shake = s.bump * 0.04, bob = s.float ? 1 : 0;
  g.position.y += Math.sin(t * 37) * shake + bob * Math.sin(t * 1.3) * 0.05;
  g.quaternion.setFromEuler(_e.set(s.pitch + Math.sin(t * 29) * shake * 0.5 + bob * Math.sin(t * 1.1) * 0.03, s.yaw, s.roll + bob * Math.sin(t * 0.9) * 0.04, 'YXZ'));
  g.updateMatrixWorld(true);
  _m.copy(g.matrixWorld).invert();
  const { wheels, arms, lampM, lamps, head } = g.userData;
  for (const w of wheels) {
    // where is the ground under this wheel, in the rover's own frame? the wheel reaches down to it
    _w.set(w.x, 0, w.z).applyMatrix4(g.matrixWorld);
    const want = s.air || s.float ? -0.28 : THREE.MathUtils.clamp(_l.set(_w.x, groundAt(_w.x, _w.z), _w.z).applyMatrix4(_m).y, -0.3, 0.35);
    w.travel += (want - w.travel) * (1 - Math.exp(-dt * 25));
    w.pivot.position.y = WHEEL_R + w.travel;
    w.w.rotation.x = -s.spin;
    w.pivot.rotation.y = s.steer * w.steer;
  }
  // rocker from the body pivot to the front wheel and to the bogie; bogie to the middle and rear wheels
  for (const a of arms) {
    const ws = a.side < 0 ? [wheels[0], wheels[2], wheels[4]] : [wheels[1], wheels[3], wheels[5]], x = a.side * 1.0;
    ws.forEach((w, i) => _hub[i].set(x, w.pivot.position.y + 0.15, w.z));
    _piv.set(x, ROCKER.y, ROCKER.z); _bog.set(x, (_hub[1].y + _hub[2].y) / 2 + 0.22, BOGIE.z);
    setBeam(a.rf, _piv, _hub[0]); setBeam(a.rb, _piv, _bog); setBeam(a.bm, _bog, _hub[1]); setBeam(a.br, _bog, _hub[2]);
    a.joint.position.copy(_piv);
  }
  head.rotation.y += (s.steer * 1.4 + Math.sin(t * 0.3) * 0.15 - head.rotation.y) * (1 - Math.exp(-dt * 3));
  lampM.color.setScalar(0.3 + night * 6);
  for (const l of lamps) l.intensity = night * 2400;
}
