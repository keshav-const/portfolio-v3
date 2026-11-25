// Inside Mission Control: the Great Chart room. Walk with WASD, look by dragging. Units are metres.
// The windows look out on the real station and system (a cube map rendered from the space scene).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, makeMaterials, label } from './parts.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });

function screenTex(title, lines, accent = '#FFB200') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const x = c.getContext('2d');
  x.fillStyle = '#07080a'; x.fillRect(0, 0, 512, 320);
  x.strokeStyle = '#2b2c2e'; x.lineWidth = 2; x.strokeRect(10, 10, 492, 300);
  x.fillStyle = '#b8b6b0'; x.font = '500 18px "JetBrains Mono", monospace'; x.fillText(title.toUpperCase(), 28, 44);
  x.fillStyle = '#2b2c2e'; x.fillRect(28, 58, 456, 1);
  lines.forEach(([k, v, hi], i) => { x.fillStyle = '#8e8c87'; x.font = '15px "JetBrains Mono", monospace'; x.fillText(k.toUpperCase(), 28, 96 + i * 38); x.fillStyle = hi ? accent : '#e8e6e1'; x.textAlign = 'right'; x.fillText(v, 484, 96 + i * 38); x.textAlign = 'left'; });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function chartTex(bodies) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#050505'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#3a3b3d'; x.lineWidth = 1.5;
  bodies.forEach((b, i) => { x.beginPath(); x.arc(256, 256, 60 + i * 48, 0, Math.PI * 2); x.stroke(); });
  x.fillStyle = '#fff4e8'; x.beginPath(); x.arc(256, 256, 12, 0, Math.PI * 2); x.fill();
  bodies.forEach((b, i) => { const a = b.ang, r = 60 + i * 48; x.fillStyle = b.c; x.beginPath(); x.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 7, 0, Math.PI * 2); x.fill(); x.fillStyle = '#e8e6e1'; x.font = '14px "JetBrains Mono", monospace'; x.fillText(b.name.toUpperCase(), 268 + Math.cos(a) * r, 260 + Math.sin(a) * r); });
  x.fillStyle = '#FFB200'; x.beginPath(); x.arc(300, 470, 6, 0, Math.PI * 2); x.fill(); x.fillText('STATION', 312, 475);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createInterior(renderer, envTexture, info) {
  makeMaterials();
  const scene = new THREE.Scene();
  scene.background = envTexture;
  scene.environment = envTexture;
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 200);
  const R = 10, H = 4.6;
  const floorM = std({ color: 0x16171a, roughness: 0.6, metalness: 0.2 });
  const wallM = MAT.hull, trimM = MAT.darkAlu;
  // floor with inlaid rings
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 96), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  for (const r of [2.6, 6.2]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.04, 128), glow(1.4, 1.0, 0.3)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; scene.add(ring); }
  // ceiling and light ring
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 96), std({ color: 0x24262a, roughness: 0.8, side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);
  const lr = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.06, 8, 128), glow(3.2, 2.9, 2.5)); lr.rotation.x = Math.PI / 2; lr.position.y = H - 0.12; scene.add(lr);
  // walls: alternating window bays and panels; the windows are open to the background (space)
  const bays = 12;
  for (let i = 0; i < bays; i++) {
    const a0 = i / bays * Math.PI * 2, a1 = (i + 1) / bays * Math.PI * 2, mid = (a0 + a1) / 2;
    const isWindow = i % 3 !== 2 && i !== 0;
    const span = (a1 - a0);
    if (!isWindow) {
      const g = new THREE.CylinderGeometry(R, R, H, 12, 1, true, a0, span); const w = new THREE.Mesh(g, std({ map: MAT.hull.map, color: 0xd8d5ce, roughness: 0.6, side: THREE.BackSide })); w.position.y = H / 2; scene.add(w);
    } else {
      for (const [y0, y1] of [[0, 0.9], [H - 0.6, H]]) { const g = new THREE.CylinderGeometry(R, R, y1 - y0, 12, 1, true, a0, span); const w = new THREE.Mesh(g, std({ color: 0x2a2c30, roughness: 0.5, metalness: 0.4, side: THREE.BackSide })); w.position.y = (y0 + y1) / 2; scene.add(w); }
    }
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, H, 0.4), trimM); post.position.set(Math.sin(a0) * (R - 0.1), H / 2, Math.cos(a0) * (R - 0.1)); post.rotation.y = a0; post.castShadow = true; scene.add(post);
  }
  // berth hatch (bay 0)
  const hatchA = Math.PI / bays;
  const hatch = new THREE.Group(); hatch.position.set(Math.sin(hatchA) * (R - 0.15), 0, Math.cos(hatchA) * (R - 0.15)); hatch.rotation.y = hatchA + Math.PI; scene.add(hatch);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.15, 48), MAT.darkAlu); door.rotation.x = Math.PI / 2; door.position.y = 1.4; hatch.add(door);
  const dr = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 10, 48), MAT.alu); dr.position.y = 1.4; dr.position.z = 0.05; hatch.add(dr);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), label('BERTH · K.№ 01', { w: 1024, h: 128, size: 78, color: '#e8e6e1' })); sign.position.set(0, 2.85, 0.1); hatch.add(sign);
  const hatchLight = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow(0.5, 3.5, 0.8)); hatchLight.position.set(0, 2.62, 0.12); hatch.add(hatchLight);

  // the orrery: a brass and aluminium instrument on a round table
  const brass = std({ color: 0xb08a4a, metalness: 1, roughness: 0.28 });
  const table = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.0, 0.9, 64), std({ color: 0x1c1d20, roughness: 0.5, metalness: 0.3 })); table.position.y = 0.45; table.castShadow = table.receiveShadow = true; scene.add(table);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.05, 64), std({ map: chartTex(info.bodies), roughness: 0.35 })); top.position.y = 0.92; scene.add(top);
  const orrery = new THREE.Group(); orrery.position.y = 0.95; scene.add(orrery);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.8, 12), brass); post.position.y = 0.4; orrery.add(post);
  const starM = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 16), glow(5, 4.2, 3.2)); starM.position.y = 0.85; orrery.add(starM);
  const arms = info.bodies.map((b, i) => {
    const arm = new THREE.Group(); arm.position.y = 0.55 + i * 0.05; arm.rotation.y = b.ang; orrery.add(arm);
    const r = 0.55 + i * 0.36;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, r, 8), brass); rod.rotation.z = Math.PI / 2; rod.position.x = r / 2; arm.add(rod);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3 - i * 0.05, 8), brass); stem.position.set(r, 0.15 - i * 0.025, 0); arm.add(stem);
    const p = new THREE.Mesh(new THREE.SphereGeometry(b.size, 24, 16), std({ color: b.c, roughness: 0.6 })); p.position.set(r, 0.3 - i * 0.05, 0); if (b.squash) p.scale.set(...b.squash); p.castShadow = true; arm.add(p);
    if (b.ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(b.size * 1.5, b.size * 2.2, 48), std({ color: 0xd8dde4, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })); rg.position.copy(p.position); rg.rotation.x = Math.PI / 2 - 0.4; arm.add(rg); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 96), brass); ring.rotation.x = Math.PI / 2; ring.position.y = arm.position.y; orrery.add(ring);
    return { arm, speed: 0.12 / (i + 1) };
  });
  // consoles in a ring, facing the windows
  const screens = [
    ['Vessel', info.vessel], ['Destinations', info.dest], ['Luna', [['Listening', '[TRACK]'], ['Reading', '[BOOK]'], ['Watching', '[FILM]'], ['Learning', '[TOPIC]'], ['Discovering', '[NOTE]']]],
    ['Comms', [['GitHub', '[NOT CONNECTED]'], ['Spotify', '[NOT CONNECTED]'], ['Cricket data', '[TO BE CONFIRMED]'], ['NASA', '[TO BE CONFIRMED]']]],
    ['Station', [['Wheel', '1 rev / 105 s'], ['Ports', '3 + berth'], ['Power', 'Nominal'], ['Crew', '[—]']]],
  ];
  screens.forEach(([title, lines], i) => {
    const a = (i + 1.5) / bays * Math.PI * 2 * 2;
    const g = new THREE.Group(); g.position.set(Math.sin(a) * 6.9, 0, Math.cos(a) * 6.9); g.rotation.y = a; scene.add(g);
    const desk = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.85, 0.9, 3, 0.06), std({ color: 0x1d1f22, roughness: 0.5, metalness: 0.3 })); desk.position.y = 0.43; desk.castShadow = desk.receiveShadow = true; g.add(desk);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.2), new THREE.MeshBasicMaterial({ map: screenTex(title, lines), color: new THREE.Color(1.4, 1.4, 1.4) })); scr.position.set(0, 1.55, 0.05); scr.rotation.x = -0.18; scr.rotation.y = Math.PI; g.add(scr);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 0.05), MAT.darkAlu); frame.position.set(0, 1.55, 0.09); frame.rotation.x = -0.18; g.add(frame);
    const chair = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.12, 0.6, 2, 0.04), std({ color: 0x8a2c1a, roughness: 0.7 })); chair.position.set(0, 0.55, -1.0); g.add(chair);
    const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8), MAT.alu); cp.position.set(0, 0.27, -1.0); g.add(cp);
  });
  // a plaque
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.42), label('MISSION CONTROL · THE GREAT CHART', { w: 1024, h: 128, size: 52, color: '#e8e6e1' }));
  plaque.position.set(0, H - 0.35, R - 0.35); plaque.rotation.y = Math.PI; scene.add(plaque);

  // light
  scene.add(new THREE.HemisphereLight(0xcfd6e0, 0x1a1a1c, 0.5));
  const key = new THREE.PointLight(0xfff0dc, 40, 22, 1.6); key.position.set(0, H - 0.4, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
  const orreryLight = new THREE.PointLight(0xffd9a0, 6, 5, 2); orreryLight.position.y = 1.8; scene.add(orreryLight);

  const st = { pos: new THREE.Vector3(Math.sin(hatchA) * 7.6, 1.68, Math.cos(hatchA) * 7.6), yaw: hatchA, pitch: -0.08, near: null };
  const pois = [
    { name: 'The Great Chart', x: 0, z: 0, r: 3.6, text: 'An orrery of the system. Each arm turns at its world’s own pace. Destinations are set from here.' },
    { name: 'Berth hatch', x: hatch.position.x, z: hatch.position.z, r: 2.4, text: 'Back to the vessel. Press E.', hatch: true },
  ];
  return {
    scene, camera, st,
    resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
    update(dt, input) {
      for (const a of arms) a.arm.rotation.y += a.speed * dt;
      hatchLight.visible = (performance.now() / 1000 % 1.2) < 0.9;
      const fwd = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw)), right = new THREE.Vector3(Math.cos(st.yaw), 0, -Math.sin(st.yaw));
      const mv = new THREE.Vector3().addScaledVector(fwd, input.fwd).addScaledVector(right, input.side);
      if (mv.lengthSq()) st.pos.addScaledVector(mv.normalize(), (input.run ? 3.2 : 1.6) * dt);
      st.yaw -= input.turn * dt * 1.6;
      const d = Math.hypot(st.pos.x, st.pos.z);
      if (d > R - 1.1) { st.pos.x *= (R - 1.1) / d; st.pos.z *= (R - 1.1) / d; }
      if (d < 2.8) { st.pos.x *= 2.8 / d; st.pos.z *= 2.8 / d; }
      camera.position.copy(st.pos);
      camera.rotation.set(st.pitch, st.yaw, 0, 'YXZ');
      st.near = pois.find((p) => Math.hypot(st.pos.x - p.x, st.pos.z - p.z) < p.r + (p.hatch ? 0 : 1.2)) || null;
    },
  };
}
