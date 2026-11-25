// Mission Control: a large station with a rotating habitat wheel. About 90 units across (1 unit ≈ 10 m).
import * as THREE from 'three';
import { MAT, makeMaterials, Builder, label } from './parts.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildStation() {
  makeMaterials();
  const B = new Builder();
  // spine truss along Z
  B.truss(-26, 40, 1.3, 22, 0.07, MAT.alu);
  // core: hab modules, nodes
  for (const [z0, z1] of [[-9, -3], [3, 9]]) {
    B.add(new THREE.CylinderGeometry(2.3, 2.3, z1 - z0, 48, 1), MAT.windows, 0, 0, (z0 + z1) / 2, Math.PI / 2);
    for (const z of [z0, z1]) B.add(new THREE.CylinderGeometry(2.42, 2.42, 0.25, 48), MAT.alu, 0, 0, z, Math.PI / 2);
  }
  B.add(new THREE.SphereGeometry(2.9, 48, 32), MAT.hull, 0, 0, 0);
  B.add(new THREE.CylinderGeometry(2.0, 2.0, 1.6, 48), MAT.gold, 0, 0, 0, Math.PI / 2);
  B.add(new THREE.SphereGeometry(2.4, 40, 24), MAT.hull, 0, 0, -11);
  B.add(new THREE.CylinderGeometry(1.8, 1.8, 4, 40), MAT.silver, 0, 0, 12, Math.PI / 2);
  // docking node: three ports, lit rings
  const ports = [];
  for (const [dir, rx, ry] of [[V(0, 0, -1), Math.PI / 2, 0], [V(1, 0, 0), 0, 0], [V(-1, 0, 0), 0, 0]]) {
    const c = V(0, 0, -11).addScaledVector(dir, 3.4);
    const g = new THREE.CylinderGeometry(1.0, 1.0, 2.2, 32); if (dir.z) g.rotateX(Math.PI / 2); else g.rotateZ(Math.PI / 2);
    B.addM(g, MAT.hull, new THREE.Matrix4().makeTranslation(c.x, c.y, c.z));
    const end = c.clone().addScaledVector(dir, 1.15);
    const t = new THREE.TorusGeometry(1.05, 0.12, 10, 40); if (!dir.z) t.rotateY(Math.PI / 2);
    B.addM(t, MAT.alu, new THREE.Matrix4().makeTranslation(end.x, end.y, end.z));
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const o = dir.z ? V(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0) : V(0, Math.cos(a) * 1.25, Math.sin(a) * 1.25); B.light(MAT.guide, end.x + o.x, end.y + o.y, end.z + o.z, 0.09, 'steady'); }
    ports.push({ pos: end, dir });
  }
  // the vessel's berth: a slim tunnel out of the forward port, ending in a collar sized for the vessel
  {
    const z0 = -15.55, z1 = -19.5;
    B.add(new THREE.CylinderGeometry(0.34, 0.34, z0 - z1, 24), MAT.hull, 0, 0, (z0 + z1) / 2, Math.PI / 2);
    B.add(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 24), MAT.alu, 0, 0, z0 - 0.15, Math.PI / 2);
    B.add(new THREE.CylinderGeometry(0.22, 0.26, 0.14, 24), MAT.darkAlu, 0, 0, z1 + 0.07, Math.PI / 2);
    B.add(new THREE.TorusGeometry(0.17, 0.03, 10, 32), MAT.alu, 0, 0, z1);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; B.light(MAT.guide, Math.cos(a) * 0.3, Math.sin(a) * 0.3, z1 + 0.02, 0.025, 'steady'); }
    for (let i = 0; i < 5; i++) B.light(MAT.guide, 0, 0.37, z1 + 0.3 + i * 0.7, 0.03, 'chase', i * 0.2);
    // docking target above the collar
    B.beam(V(0, 0.34, z1 + 0.6), V(0, 0.75, z1 + 0.6), 0.02, MAT.alu);
    B.add(new THREE.BoxGeometry(0.34, 0.34, 0.02), MAT.black, 0, 0.75, z1 + 0.6);
    B.add(new THREE.BoxGeometry(0.3, 0.03, 0.025), MAT.white, 0, 0.75, z1 + 0.585); B.add(new THREE.BoxGeometry(0.03, 0.3, 0.025), MAT.white, 0, 0.75, z1 + 0.585);
    B.add(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), MAT.white, 0, 0.75, z1 + 0.48, Math.PI / 2);
    ports.unshift({ pos: V(0, 0, z1), dir: V(0, 0, -1) });
  }
  // comms mast and dishes at the bow
  B.beam(V(0, 2.4, -11), V(0, 12, -14), 0.12, MAT.alu);
  for (const [x, y, z, r, ry] of [[2.6, 11, -14, 3.0, 0.5], [-2.2, 9, -13.5, 2.0, -0.6]]) {
    const prof = []; for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(r * t, r * 0.32 * t * t)); }
    const g = new THREE.LatheGeometry(prof, 48); g.rotateX(Math.PI / 2);
    B.add(g, MAT.white, x, y, z, -0.5, ry, 0);
    B.beam(V(0, y, z), V(x, y, z), 0.1, MAT.alu);
  }
  // habitat wheel (rotates; kept as its own mesh group)
  const wheel = new THREE.Group();
  {
    const W = new Builder();
    W.add(new THREE.TorusGeometry(17, 1.5, 24, 160), MAT.windows, 0, 0, 0);
    for (const z of [-1.35, 1.35]) W.add(new THREE.TorusGeometry(17, 0.22, 8, 160), MAT.alu, 0, 0, z);
    for (const r of [15.6, 18.4]) W.add(new THREE.TorusGeometry(r, 0.18, 8, 160), MAT.alu, 0, 0, 0);
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      W.beam(V(Math.cos(a) * 3.0, Math.sin(a) * 3.0, 0), V(Math.cos(a) * 15.6, Math.sin(a) * 15.6, 0), 0.5, MAT.hull, 16);
      W.beam(V(Math.cos(a + 0.08) * 3.0, Math.sin(a + 0.08) * 3.0, 0.7), V(Math.cos(a + 0.03) * 15.6, Math.sin(a + 0.03) * 15.6, 0.7), 0.08, MAT.alu);
      const p = V(Math.cos(a + Math.PI / 6) * 17, Math.sin(a + Math.PI / 6) * 17, 0);
      W.add(new THREE.BoxGeometry(3.2, 3.6, 3.6), MAT.hull, p.x, p.y, p.z, 0, 0, a + Math.PI / 6);
    }
    W.add(new THREE.CylinderGeometry(3.2, 3.2, 1.4, 48), MAT.darkAlu, 0, 0, 0, Math.PI / 2);
    wheel.add(W.build());
    wheel.position.z = -6;
    const nameM = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.7), label('MISSION CONTROL', { w: 1024, h: 128, size: 84 }));
    nameM.position.set(2.34, 0.6, -6); nameM.rotation.set(0, Math.PI / 2, 0); B.group.add(nameM);
  }
  // aft: solar wings and radiators
  for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const z of [24, 34]) {
      const root = V(ax * 1.3, ay * 1.3, z), tip = V(ax * 34, ay * 34, z);
      B.beam(root, tip, 0.09, MAT.alu);
      for (let i = 0; i < 4; i++) {
        const c = V(ax * (4 + i * 7.5), ay * (4 + i * 7.5), z);
        const rz = ay ? Math.PI / 2 : 0;
        B.panel(7.2, 4.4, MAT.solar, MAT.alu, c.x, c.y, c.z, Math.PI / 2, 0, rz, 0.06);
      }
    }
  }
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const c = V(Math.cos(a) * 7, Math.sin(a) * 7, 17);
    B.add(new THREE.BoxGeometry(0.15, 10, 8), MAT.rad, c.x, c.y, c.z, 0, 0, a + Math.PI / 2);
    B.beam(V(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 17), V(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 17), 0.12, MAT.alu);
  }
  // lights
  B.light(MAT.beacon, 0, 12.4, -14, 0.25, 'beacon');
  for (const [x, y, z, ph] of [[34, 0, 29, 0], [-34, 0, 29, 0.3], [0, 34, 29, 0.6], [0, -34, 29, 0.9]]) B.light(MAT.strobe, x, y, z, 0.2, 'strobe', ph);
  const g = B.build();
  g.add(wheel);
  g.userData.wheel = wheel;
  g.userData.ports = ports;
  return g;
}
