// The astronaut: a jointed suit model and a walk, run, lope and jump animation. Throwaway sketch code.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { label } from './parts.js';

function fabricTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = 110 + Math.random() * 40; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 1); }
  for (let j = 0; j < 256; j += 32) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, j, 256, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
const std = (o) => new THREE.MeshStandardMaterial(o);

export function buildAstronaut() {
  const bump = fabricTex();
  const suit = std({ color: 0xeeebe4, roughness: 0.82, bumpMap: bump, bumpScale: 0.6 });
  const soft = std({ color: 0xcfcac0, roughness: 0.9, bumpMap: bump, bumpScale: 0.8 });
  const metal = std({ color: 0xa9aeb3, metalness: 0.9, roughness: 0.28 });
  const dark = std({ color: 0x26272a, roughness: 0.65 });
  const accent = std({ color: 0xd93a2b, roughness: 0.6 });
  const visor = std({ color: 0xd7a248, metalness: 1, roughness: 0.05, envMapIntensity: 1.6 });
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.3, 0.3) });
  const root = new THREE.Group();
  const mesh = (g, m, parent, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(g, m); k.position.set(x, y, z); k.castShadow = true; k.receiveShadow = true; parent.add(k); return k; };
  const lathe = (pts, segs = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);

  const pelvis = new THREE.Group(); pelvis.position.y = 0.98; root.add(pelvis);
  // hips and brief
  const brief = mesh(lathe([[0.0, -0.12], [0.15, -0.11], [0.19, -0.04], [0.2, 0.06], [0.18, 0.12], [0.0, 0.12]]), suit, pelvis); brief.scale.z = 0.78;
  mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 28), metal, pelvis, 0, 0.12, 0).rotation.x = Math.PI / 2;
  // torso
  const torso = new THREE.Group(); torso.position.y = 0.12; pelvis.add(torso);
  const chest = mesh(lathe([[0.0, 0.0], [0.19, 0.0], [0.22, 0.1], [0.245, 0.26], [0.25, 0.42], [0.23, 0.53], [0.16, 0.6], [0.0, 0.61]], 28), suit, torso); chest.scale.z = 0.74;
  mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 24), soft, torso, 0, 0.12, 0).rotation.x = Math.PI / 2;
  // chest control box, hoses, vermilion stripe on the left arm comes later
  const dcm = mesh(new RoundedBoxGeometry(0.27, 0.14, 0.08, 2, 0.02), soft, torso, 0, 0.34, -0.18); dcm.rotation.x = -0.12;
  mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), accent, torso, -0.07, 0.36, -0.225);
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), metal, torso, 0.06, 0.36, -0.225).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.12, 0.31, -0.2), new THREE.Vector3(s * 0.23, 0.22, -0.16), new THREE.Vector3(s * 0.26, 0.12, -0.02), new THREE.Vector3(s * 0.22, 0.2, 0.12)]);
    mesh(new THREE.TubeGeometry(c, 16, 0.016, 6), dark, torso);
  }
  // backpack: life support with a top unit
  mesh(new RoundedBoxGeometry(0.46, 0.6, 0.24, 3, 0.05), suit, torso, 0, 0.34, 0.27);
  mesh(new RoundedBoxGeometry(0.4, 0.13, 0.2, 2, 0.04), soft, torso, 0, 0.7, 0.26);
  for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.34, 0.012, 0.01), dark, torso, 0, 0.2 + i * 0.08, 0.395);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10), metal, torso, 0.16, 0.12, 0.38);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), label('K.№', { w: 256, h: 96, size: 64, color: '#1b1a18' })); patch.position.set(0.12, 0.47, -0.185); patch.rotation.y = Math.PI; torso.add(patch);
  // helmet: neck ring, hard shell, clear bubble, gold visor, lamps
  const head = new THREE.Group(); head.position.y = 0.62; torso.add(head);
  mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 28), metal, head, 0, 0.0, 0).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(0.2, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), suit, head, 0, 0.17, 0.015);
  mesh(new THREE.SphereGeometry(0.192, 32, 20, Math.PI * 0.62, Math.PI * 0.76, Math.PI * 0.28, Math.PI * 0.42), visor, head, 0, 0.17, -0.005);
  const hood = mesh(new THREE.SphereGeometry(0.205, 32, 12, Math.PI * 0.6, Math.PI * 0.8, Math.PI * 0.18, Math.PI * 0.14), soft, head, 0, 0.17, 0.0); void hood;
  const lamps = [];
  for (const s of [-1, 1]) { mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.08, 12), soft, head, s * 0.17, 0.26, -0.06).rotation.x = Math.PI / 2; const l = new THREE.Mesh(new THREE.CircleGeometry(0.024, 12), lampM); l.position.set(s * 0.17, 0.26, -0.101); l.rotation.y = Math.PI; head.add(l); lamps.push(l); }
  // limbs: upper and lower segments with bellows joints
  const limb = (parent, x, y, r1, l1, r2, l2, endFn, stripe) => {
    const top = new THREE.Group(); top.position.set(x, y, 0); parent.add(top);
    mesh(new THREE.SphereGeometry(r1 * 1.15, 16, 12), soft, top);
    mesh(new THREE.CapsuleGeometry(r1, l1 - r1, 6, 16), suit, top, 0, -l1 / 2, 0);
    if (stripe) mesh(new THREE.CylinderGeometry(r1 * 1.04, r1 * 1.04, 0.05, 16, 1, true), accent, top, 0, -l1 * 0.35, 0);
    const mid = new THREE.Group(); mid.position.y = -l1; top.add(mid);
    for (let i = -1; i <= 1; i++) mesh(new THREE.TorusGeometry(r2 * 1.05, 0.016, 6, 18), soft, mid, 0, i * 0.035, 0).rotation.x = Math.PI / 2;
    mesh(new THREE.CapsuleGeometry(r2, l2 - r2, 6, 16), suit, mid, 0, -l2 / 2, 0);
    const end = new THREE.Group(); end.position.y = -l2; mid.add(end); endFn(end);
    return { top, mid, end };
  };
  const boot = (g) => {
    mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 18), metal, g, 0, 0.02, 0).rotation.x = Math.PI / 2;
    mesh(new RoundedBoxGeometry(0.17, 0.13, 0.3, 3, 0.05), suit, g, 0, -0.06, -0.04);
    mesh(new RoundedBoxGeometry(0.18, 0.045, 0.31, 2, 0.02), dark, g, 0, -0.125, -0.04);
  };
  const glove = (g) => {
    mesh(new THREE.TorusGeometry(0.058, 0.014, 6, 18), metal, g, 0, 0.01, 0).rotation.x = Math.PI / 2;
    mesh(new RoundedBoxGeometry(0.09, 0.12, 0.06, 2, 0.025), dark, g, 0, -0.07, 0);
    mesh(new THREE.CapsuleGeometry(0.018, 0.04, 4, 8), dark, g, 0.045, -0.06, -0.025).rotation.z = 0.6;
  };
  const legL = limb(pelvis, -0.1, -0.06, 0.088, 0.44, 0.078, 0.43, boot), legR = limb(pelvis, 0.1, -0.06, 0.088, 0.44, 0.078, 0.43, boot);
  const armL = limb(torso, -0.275, 0.5, 0.072, 0.3, 0.064, 0.27, glove, true), armR = limb(torso, 0.275, 0.5, 0.072, 0.3, 0.064, 0.27, glove);
  // lights for the dark: helmet lamps
  const spot = new THREE.SpotLight(0xfff2e0, 0, 40, 0.5, 0.5, 1.5); spot.position.set(0, 0.26, -0.12); spot.target.position.set(0, -0.6, -4); head.add(spot, spot.target);
  return { root, pelvis, torso, head, legL, legR, armL, armR, lamps, lampM, spot, t: 0 };
}

// phase advances with distance walked; speed in m/s; lowG switches to a loping gait
export function poseAstronaut(a, { phase, speed, air, lowG, lean, dt, t }) {
  const run = THREE.MathUtils.clamp((speed - 2.6) / 3, 0, 1), amp = Math.min(1, speed / 2.2);
  const s = Math.sin(phase), c = Math.cos(phase);
  const idle = 1 - Math.min(1, speed / 0.6);
  if (air) {
    a.legL.top.rotation.x = 0.6; a.legR.top.rotation.x = 0.25; a.legL.mid.rotation.x = -0.9; a.legR.mid.rotation.x = -0.6;
    a.armL.top.rotation.x = 0.5; a.armR.top.rotation.x = 0.35; a.armL.top.rotation.z = -0.35; a.armR.top.rotation.z = 0.35;
    a.pelvis.position.y = 0.98;
  } else if (lowG && speed > 1.2) { // the loping hop: both legs together
    const k = Math.sin(phase * 0.5) ** 2;
    a.legL.top.rotation.x = a.legR.top.rotation.x = 0.35 - k * 0.5; a.legL.mid.rotation.x = a.legR.mid.rotation.x = -(0.25 + (1 - k) * 0.6);
    a.armL.top.rotation.x = a.armR.top.rotation.x = 0.25 - k * 0.3; a.armL.top.rotation.z = -0.3; a.armR.top.rotation.z = 0.3;
    a.pelvis.position.y = 0.95 + k * 0.04;
  } else {
    const st = 0.45 + run * 0.35;
    a.legL.top.rotation.x = s * st * amp; a.legR.top.rotation.x = -s * st * amp;
    a.legL.mid.rotation.x = -(Math.max(0, c) * (0.7 + run * 0.6) * amp + 0.05); a.legR.mid.rotation.x = -(Math.max(0, -c) * (0.7 + run * 0.6) * amp + 0.05);
    a.armL.top.rotation.x = -s * (0.35 + run * 0.4) * amp; a.armR.top.rotation.x = s * (0.35 + run * 0.4) * amp;
    a.armL.top.rotation.z = -0.14 - idle * 0.05; a.armR.top.rotation.z = 0.14 + idle * 0.05;
    a.pelvis.position.y = 0.98 - Math.abs(c) * 0.035 * amp - run * 0.03 + Math.sin(t * 1.6) * 0.004 * idle;
  }
  a.armL.mid.rotation.x = 0.35 + run * 0.5; a.armR.mid.rotation.x = 0.35 + run * 0.5;
  a.legL.end.rotation.x = -a.legL.mid.rotation.x * 0.3; a.legR.end.rotation.x = -a.legR.mid.rotation.x * 0.3;
  a.torso.rotation.x = THREE.MathUtils.lerp(a.torso.rotation.x, -(lean + run * 0.18), 1 - Math.exp(-dt * 6));
  a.torso.rotation.y = s * 0.08 * amp;
  a.head.rotation.x = -a.torso.rotation.x * 0.6;
}
