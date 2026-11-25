// Planet surfaces: the lander comes down, flies and hops across the land, and you step out and walk.
// Each world has its own gravity, air, wind and day length; the sun's place in the sky comes from where you
// landed and how far the planet has turned. Units are metres. Throwaway sketch code.
import * as THREE from 'three';
import { MAT, makeMaterials, label } from './parts.js';
import { NOISE } from './shaders.js';
import { fbm, ss, createPool, createTerrain, createCover, createScatter, treeModels, leafMaterial, rockModels, shardModels, windify } from './terrain.js';
import { FIELDS, FORDS, clearOf as clearOfF, HANGAR, MAST, FOUNDRY, FORT, AMPHI, RIVER, GROUND, GRAND, SALT, OBS, CRATER, SCOPE, T_FY, E_AY, A_GY, A_BY, A_0, K_0, K_SY } from './fields.js';

const BOUND = 6000;
import { buildLander, createLanderSim, poseLander } from './lander.js';
import { buildAstronaut, poseAstronaut, seatAstronaut } from './astronaut.js';
import { buildRover, createRoverSim, poseRover, SEAT } from './rover.js';
import { createWater } from './water.js';
export { buildLander };


export const WORLDS = {
  technova: { ...FIELDS.technova,
    name: 'Technova', g: 0.62, wind: 0.12, windDir: [0.8, -0.6], drag: 0.03, dust: 0.7, dustCol: [0.34, 0.32, 0.31],
    sky: { dayZen: 0x090d16, dayHor: 0x60636a, setHor: 0x8c5c3e, nightZen: 0x010103, nightHor: 0x0a0b10, sunCol: [1.0, 0.96, 0.9], sunI: 3.0, stars: 0.55, clouds: 0, ring: 0, aurora: 0, sun: [-0.45, 0.42, -0.78] },
    fog: 0.00016, hemi: [0x6a7080, 0x2a2622, 0.55], expo: 1.0,
    glsl: /* glsl */`
float relief(vec2 p, vec3 m){ return fb2(p*0.7, 3)*0.35 + vn2(p*3.1)*0.06; }
vec3 albedo(vec3 p, vec3 n, vec3 m, float dist, inout float rough){
  float slope = 1.0 - n.y, hf = 1.0 - smoothstep(60.0, 300.0, dist);
  float macro = fb2(p.xz*0.0025, 4), meso = fb2(p.xz*0.03, 4), micro = mix(0.5, fb2(p.xz*0.6, 3), hf);
  vec3 c = mix(vec3(0.045,0.044,0.047), vec3(0.13,0.125,0.13), smoothstep(0.3,0.75,meso));
  c = mix(c, vec3(0.26,0.12,0.06), smoothstep(0.52,0.7,macro)*0.85*(1.0-smoothstep(0.2,0.4,slope)));
  float strata = 0.5+0.5*sin(p.y*1.1 + meso*5.0);
  c = mix(c, mix(vec3(0.045,0.045,0.05), vec3(0.24,0.22,0.2), strata*strata), smoothstep(0.22,0.45,slope));
  float vein = 1.0 - smoothstep(0.0, 0.012, abs(fb2(p.xz*0.01+3.0,4)-0.5));
  c = mix(c, vec3(0.6,0.44,0.22), vein*0.75);
  c = mix(c, vec3(0.22,0.21,0.2), smoothstep(0.9,0.99,n.y)*smoothstep(0.55,0.75,fb2(p.xz*0.015+7.0,3))*0.35);
  c = mix(c, vec3(0.15,0.15,0.155)*(0.9+0.2*vn2(p.xz*0.5)), m.x);
  c *= 0.78 + 0.44*micro;
  rough = mix(0.93, 0.55, vein) * (1.0 - m.x*0.15);
  return c;
}`,
  },
  ekatva: { ...FIELDS.ekatva,
    name: 'Ekatva', g: 1.08, wind: 0.55, windDir: [0.9, 0.44], drag: 0.2, dust: 0.25, dustCol: [0.6, 0.45, 0.25],
    sky: { dayZen: 0x56637a, dayHor: 0xe2ad78, setHor: 0xe8683a, nightZen: 0x04060c, nightHor: 0x17141c, sunCol: [1.0, 0.82, 0.58], sunI: 2.8, stars: 0, clouds: 0.6, ring: 0, aurora: 0, sun: [-0.55, 0.28, -0.79] },
    fog: 0.00034, hemi: [0xd8b088, 0x3a2016, 0.75], expo: 1.0, water: -12,
    // the river flows south along its bed; the silt seas are still
    waterSpec: { level: -12, shallow: [0.30, 0.29, 0.17], deep: [0.02, 0.055, 0.05],
      current(x, z, out) { const rx = RIVER(z), d = Math.abs(x - rx), near = 1 - Math.min(1, Math.max(0, (d - 20) / 35)); const dx = (70 / 260) * Math.cos(z / 260) + (380 / 1500) * Math.cos(z / 1500 + 1); const l = Math.hypot(dx, 1); return out.set((dx / l) * 1.3 * near, 0, (1 / l) * 1.3 * near); },
      flow: `vec2 flowAt(vec2 p){ float z = p.y; float rx = 175.0 + 70.0*sin(z/260.0) + 380.0*(sin(z/1500.0+1.0) - sin(1.0));
        float dx = 70.0/260.0*cos(z/260.0) + 380.0/1500.0*cos(z/1500.0+1.0);
        return normalize(vec2(dx, 1.0)) * 1.3 * (1.0 - smoothstep(20.0, 55.0, abs(p.x - rx))); }` },
    glsl: /* glsl */`
float relief(vec2 p, vec3 m){ return fb2(p*0.45, 3)*0.25*(1.0-m.y*0.6) + vn2(p*2.5)*0.05; }
vec3 albedo(vec3 p, vec3 n, vec3 m, float dist, inout float rough){
  float slope = 1.0 - n.y, hf = 1.0 - smoothstep(60.0, 300.0, dist);
  float macro = fb2(p.xz*0.0025, 4), meso = fb2(p.xz*0.03, 4), micro = mix(0.5, fb2(p.xz*0.6, 3), hf);
  vec3 grass = mix(vec3(0.42,0.27,0.07), vec3(0.6,0.42,0.14), smoothstep(0.3,0.75,meso));
  grass = mix(grass, vec3(0.36,0.25,0.08), smoothstep(0.5,0.8,macro)*0.5);
  vec3 c = mix(grass, vec3(0.2,0.075,0.04)*(0.8+0.4*meso), m.x*0.9);
  c = mix(c, vec3(0.64,0.46,0.31)*(0.9+0.2*micro), m.y);
  float strata = 0.5+0.5*sin(p.y*0.8+meso*4.0);
  c = mix(c, mix(vec3(0.44,0.31,0.22), vec3(0.66,0.5,0.36), strata), smoothstep(0.3,0.55,slope));
  c = mix(c, vec3(0.27,0.24,0.16), m.z);
  float snow = smoothstep(190.0,250.0,p.y+meso*50.0)*smoothstep(0.65,0.35,slope);
  c = mix(c, vec3(0.92,0.92,0.9), snow);
  c *= 0.82 + 0.36*micro;
  rough = mix(0.9, 0.45, m.z) * mix(1.0, 0.7, snow);
  return c;
}`,
  },
  arena: { ...FIELDS.arena,
    name: 'The Arena', g: 0.94, wind: 0.75, windDir: [-0.7, 0.7], drag: 0.17, dust: 0.12, dustCol: [0.5, 0.45, 0.3],
    sky: { dayZen: 0x2c6cc8, dayHor: 0xd6e4e2, setHor: 0xff7a3a, nightZen: 0x060a1c, nightHor: 0x1e1426, sunCol: [1.0, 0.86, 0.66], sunI: 2.6, stars: 0.1, clouds: 0.5, ring: 0, aurora: 0.6, sun: [0.75, 0.08, -0.65] },
    fog: 0.00022, hemi: [0x8aa8e0, 0x2a3a12, 0.85], expo: 1.0,
    glsl: /* glsl */`
float relief(vec2 p, vec3 m){ return (fb2(p*0.5,3)*0.18 + vn2(p*2.8)*0.04)*(1.0-m.y); }
vec3 albedo(vec3 p, vec3 n, vec3 m, float dist, inout float rough){
  float slope = 1.0 - n.y, hf = 1.0 - smoothstep(60.0, 300.0, dist);
  float macro = fb2(p.xz*0.0025, 4), meso = fb2(p.xz*0.03, 4), micro = mix(0.5, fb2(p.xz*0.6, 3), hf);
  vec3 c = mix(vec3(0.10,0.34,0.06), vec3(0.30,0.5,0.08), smoothstep(0.3,0.75,meso));
  c = mix(c, vec3(0.5,0.55,0.1), smoothstep(0.6,0.8,macro)*0.5);
  float hue = fb2(p.xz*0.0022+40.0,3);
  vec3 fl = mix(vec3(0.95,0.40,0.04), vec3(0.86,0.07,0.2), smoothstep(0.42,0.56,hue));
  fl = mix(fl, vec3(0.98,0.76,0.08), smoothstep(0.62,0.7,hue));
  fl = mix(fl, vec3(0.62,0.1,0.5), smoothstep(0.34,0.26,hue));
  float speck = mix(0.7, smoothstep(0.35,0.65,fb2(p.xz*0.9,2)), hf);
  c = mix(c, fl, m.x*(0.45+0.5*speck));
  float stripe = step(0.5, fract(p.x/7.0));
  c = mix(c, mix(vec3(0.13,0.42,0.08), vec3(0.18,0.5,0.1), stripe), m.y);
  c = mix(c, vec3(0.9,0.88,0.83)*(0.92+0.08*meso), m.z);
  c = mix(c, mix(vec3(0.45,0.26,0.17), vec3(0.62,0.42,0.3), 0.5+0.5*sin(p.y*0.9)), smoothstep(0.3,0.55,slope));
  c = mix(c, vec3(0.94,0.94,0.96), smoothstep(270.0,330.0,p.y+meso*40.0)*smoothstep(0.65,0.35,slope));
  c *= 0.82 + 0.36*micro;
  rough = mix(0.88, 0.6, m.z);
  return c;
}`,
  },
  cosmos: { ...FIELDS.cosmos,
    name: 'Cosmos', g: 0.24, wind: 0.0, windDir: [1, 0], drag: 0.0, dust: 0.0, dustCol: [0.8, 0.85, 0.9],
    sky: { dayZen: 0x010204, dayHor: 0x101a2c, setHor: 0x1a2438, nightZen: 0x000001, nightHor: 0x05080e, sunCol: [0.9, 0.95, 1.0], sunI: 2.6, stars: 1.0, clouds: 0, ring: 1, aurora: 0, sun: [-0.7, 0.16, -0.7] },
    fog: 0.00008, hemi: [0x5a7aa8, 0x1a2030, 0.5], expo: 1.0,
    glsl: /* glsl */`
float relief(vec2 p, vec3 m){ return fb2(p*0.35,3)*0.2 + vn2(p*2.2)*0.04 + m.x*fb2(p*1.2,3)*0.2; }
vec3 albedo(vec3 p, vec3 n, vec3 m, float dist, inout float rough){
  float slope = 1.0 - n.y, hf = 1.0 - smoothstep(60.0, 300.0, dist);
  float meso = fb2(p.xz*0.03, 4), micro = mix(0.5, fb2(p.xz*0.6, 3), hf);
  vec3 c = mix(vec3(0.56,0.63,0.72), vec3(0.8,0.83,0.87), smoothstep(0.3,0.75,meso));
  float k = abs(fb2(p.xz*0.008,4)-0.5); c = mix(c, vec3(0.2,0.36,0.56), (1.0 - smoothstep(0.002, 0.01, k))*0.85);
  float k2 = abs(fb2(p.xz*0.03+5.0,3)-0.5); c = mix(c, vec3(0.42,0.55,0.7), (1.0-smoothstep(0.003,0.012,k2))*0.5*hf);
  float rock = max(m.x, smoothstep(0.3,0.55,slope));
  c = mix(c, vec3(0.16,0.15,0.145)*(0.8+0.4*meso), rock*0.9);
  c = mix(c, vec3(0.52,0.62,0.74), m.y*0.45);
  c *= 0.86 + 0.28*micro;
  rough = mix(0.32, 0.92, rock);
  return c;
}`,
  },
};
const clearOf = (W, x, z) => clearOfF(W, x, z);

// ---------- sky, with day, sunset and night ----------
const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = `
uniform vec3 uDZ, uDH, uSH, uNZ, uNH, uSun, uSunCol; uniform float uStars, uClouds, uRing, uAurora, uTime;
varying vec3 vDir;
${NOISE}
float h11(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
void main(){
  vec3 d = normalize(vDir); float y = d.y; vec3 s = normalize(uSun);
  float day = smoothstep(-0.08, 0.3, s.y), set = smoothstep(-0.2, 0.0, s.y)*(1.0 - smoothstep(0.06, 0.42, s.y));
  vec3 zen = mix(uNZ, uDZ, day), hor = mix(uNH, uDH, day);
  float toward = pow(max(dot(normalize(d.xz + 1e-4), normalize(s.xz + 1e-4)), 0.0), 2.0);
  hor = mix(hor, uSH, set*(0.3 + 0.7*toward));
  vec3 c = mix(hor, zen, pow(clamp(y,0.0,1.0), 0.42));
  c = mix(c, hor*0.5, smoothstep(0.0,-0.25,y));
  float sd = max(dot(d, s), 0.0), vis = smoothstep(-0.08, 0.04, s.y);
  c += uSunCol*(pow(sd,6.0)*0.25 + pow(sd,60.0)*0.6) * (0.35+0.65*day) * vis;
  c += uSunCol*smoothstep(0.99955,0.9997,sd)*30.0*smoothstep(-0.03,0.01,y);
  float st = uStars + (1.0 - day)*0.9;
  if (st > 0.0) { vec3 g = floor(d*420.0); float h = h11(g); float tw = 0.7+0.3*sin(uTime*2.0+h*50.0); c += vec3(0.95,0.97,1.0)*step(0.9965,h)*(h-0.9965)/0.0035*1.6*min(st,1.0)*tw*smoothstep(-0.02,0.15,y); }
  if (uClouds > 0.0 && y > 0.0) {
    vec2 uv = d.xz/(y+0.12)*1.4 + vec2(uTime*0.004,0.0);
    float n = fbm(vec3(uv*1.2,3.0),5)*0.5+0.5; float cov = smoothstep(0.5,0.72,n)*uClouds*smoothstep(0.0,0.12,y);
    vec3 cc = (mix(hor*1.05, vec3(1.0,0.96,0.9), 0.5) + uSunCol*pow(sd,4.0)*0.6) * (0.06 + 0.94*day);
    cc = mix(cc, uSH*1.1, set*0.6*toward);
    c = mix(c, cc, cov*0.9);
  }
  if (uRing > 0.0) {
    vec3 n = normalize(vec3(0.25,0.42,1.0)); float r = dot(d,n);
    float band = smoothstep(0.11,0.105,abs(r-0.02));
    float rings = 0.55+0.45*sin(r*340.0)*sin(r*97.0);
    c += vec3(0.85,0.88,0.95)*band*rings*0.5*smoothstep(-0.02,0.05,y)*(0.3+0.7*vis);
  }
  if (uAurora > 0.0 && y > 0.0) {
    float lon = atan(d.x,-d.z);
    float fold = lon*3.0 + 0.6*snoise(vec3(lon*1.5, 0.0, uTime*0.03));
    float base = 0.08 + 0.05*snoise(vec3(fold*2.0, 1.0, uTime*0.05));
    float hgt = y - base;
    float sheet = smoothstep(0.0, 0.02, hgt)*exp(-max(hgt,0.0)*7.0);
    float rays = 0.35 + 0.65*pow(snoise(vec3(fold*24.0, 0.0, uTime*0.12))*0.5+0.5, 2.0);
    float where = smoothstep(0.1,0.8, snoise(vec3(fold*0.8, 2.0, uTime*0.02))*0.5+0.5)*smoothstep(0.3,-0.5,d.z);
    vec3 ac = mix(vec3(0.15,1.0,0.5), vec3(0.9,0.3,0.55), smoothstep(0.05,0.22,hgt));
    c += ac*sheet*rays*where*uAurora*(1.0-day)*0.5;
  }
  gl_FragColor = vec4(c,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------- props ----------
function stripeTex(a, b, n, w = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = w; const x = c.getContext('2d');
  for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * w / n, 0, w / n, w); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sandstoneTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#b98462'; x.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 8; i++) { const k = 0.85 + Math.random() * 0.25; x.fillStyle = `rgb(${196 * k},${144 * k},${106 * k})`; x.fillRect(i * 32 + (j % 2) * 16 + 1, j * 16 + 1, 30, 14); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const std = (o) => new THREE.MeshStandardMaterial(o);
let _dot = null;
function softDot() { if (_dot) return _dot; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (_dot = new THREE.CanvasTexture(c)); }
const box = (g, w, h, d, m, x, y, z, ry = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); k.rotation.y = ry; k.castShadow = k.receiveShadow = true; g.add(k); return k; };
const cyl = (g, r0, r1, h, m, x, y, z, seg = 24) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); k.position.set(x, y, z); k.castShadow = k.receiveShadow = true; g.add(k); return k; };
const dome = (g, r, m, x, y, z) => { const k = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m); k.position.set(x, y, z); k.castShadow = k.receiveShadow = true; g.add(k); return k; };
const glowM = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
// a lattice tower made of boxes
function lattice(g, x, y, z, w, h, m, step = 8) {
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) box(g, 0.6, h, 0.6, m, x + sx * w / 2, y + h / 2, z + sz * w / 2);
  for (let k = 0; k < h / step; k++) { const yy = y + k * step + step / 2; for (const r of [0, Math.PI / 2]) { const b = box(g, w * 1.4, 0.3, 0.3, m, x, yy, z, r); b.rotation.z = Math.atan2(step, w) * (k % 2 ? 1 : -1); } }
}

// ---------- features per world. Returns places you can visit, with placeholder content ----------
function features(key, W, root, colliders, lamps, at) {
  makeMaterials();
  if (key === 'technova') {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(16, 16.5, 0.4, 64), std({ color: 0x2b2c2e, roughness: 0.8 })); pad.position.y = 0.05; pad.receiveShadow = true; root.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 0.25, 6, 64), std({ color: 0xd8d4c8 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.27; root.add(ring);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), glowM(5, 4, 2.6)); l.position.set(Math.cos(a) * 16.2, 0.35, Math.sin(a) * 16.2); root.add(l); }
    const [hx, hz] = HANGAR, hy = at(hx, hz);
    const hang = new THREE.Group(); hang.position.set(hx, hy, hz); hang.rotation.y = 0.5; root.add(hang);
    box(hang, 40, 16, 30, MAT.hull, 0, 8, 0); box(hang, 26, 12, 0.5, glowM(1.4, 1.2, 0.95), 0, 6, -15.1);
    for (let i = -2; i <= 2; i++) box(hang, 0.6, 16.5, 31, MAT.darkAlu, i * 9, 8.2, 0);
    box(hang, 42, 1.2, 32, MAT.gold, 0, 16.6, 0);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.8), label('THE WORKSHOP', { w: 1024, h: 128, size: 80, color: '#16161a' })); sign.position.set(0, 13.5, -15.3); sign.rotation.y = Math.PI; hang.add(sign);
    colliders.push({ x: hx, z: hz, r: 24, top: hy + 18 });
    for (const [mx, mz, ry] of [[-55, -70, 0.3], [-72, -95, 1.1]]) {
      const g = new THREE.Group(); g.position.set(mx, at(mx, mz), mz); g.rotation.y = ry; root.add(g);
      const m = cyl(g, 3.2, 3.2, 14, MAT.windows, 0, 4.6, 0, 32); m.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) for (const t of [-1, 1]) cyl(g, 0.25, 0.25, 4, MAT.alu, s * 5, 1.5, t * 2.2, 8);
      colliders.push({ x: mx, z: mz, r: 8, top: at(mx, mz) + 9 });
    }
    for (const [tx, tz] of [[-30, -120], [-22, -128], [-38, -128]]) { const k = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), MAT.white); k.position.set(tx, at(tx, tz) + 4.5, tz); k.castShadow = true; root.add(k); colliders.push({ x: tx, z: tz, r: 4.5, top: at(tx, tz) + 9 }); }
    const [mx, mz] = MAST, my = at(mx, mz);
    for (let i = 0; i < 4; i++) cyl(root, 0.5 - i * 0.08, 0.6 - i * 0.08, 10, MAT.alu, mx, my + 5 + i * 10, mz, 8);
    const db = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 12, 0, Math.PI * 2, 0, 1.0), std({ color: 0xe6e4df, side: THREE.DoubleSide })); db.position.set(mx, my + 42, mz); db.rotation.x = -2.2; root.add(db);
    const bc = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), glowM(8, 0.8, 0.5)); bc.position.set(mx, my + 46, mz); root.add(bc); lamps.push({ m: bc, kind: 'beacon', phase: 0 });
    colliders.push({ x: mx, z: mz, r: 1.2, top: my + 46 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const sx = 40 + i * 12, sz = 40 + j * 10; const p = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 6), MAT.solar); p.position.set(sx, at(sx, sz) + 2.2, sz); p.rotation.x = -0.5; p.castShadow = true; root.add(p); cyl(root, 0.12, 0.12, 2.2, MAT.alu, sx, at(sx, sz) + 1.1, sz, 8); }
    // The Foundry: a tall gantry, a dome hall and a ring of lights, far out on the plain
    const [fx, fz] = FOUNDRY; const F = new THREE.Group(); F.position.set(fx, T_FY, fz); root.add(F);
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(130, 132, 0.6, 96), std({ color: 0x29292b, roughness: 0.85 })); apron.position.y = 0.1; apron.receiveShadow = true; F.add(apron);
    lattice(F, 0, 0, 0, 10, 96, MAT.alu); box(F, 14, 2, 14, MAT.darkAlu, 0, 97, 0);
    cyl(F, 5.5, 5.5, 70, MAT.white, 18, 35, 0, 40); dome(F, 5.5, MAT.white, 18, 70, 0); cyl(F, 5.6, 5.6, 1.2, std({ color: 0xd93a2b, roughness: 0.6 }), 18, 52, 0, 40);
    for (let k = 0; k < 3; k++) box(F, 10, 1.2, 2, MAT.darkAlu, 9, 30 + k * 18, 0);
    const hall = new THREE.Mesh(new THREE.SphereGeometry(42, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), MAT.hull); hall.scale.y = 0.55; hall.position.set(-70, 0, 40); hall.castShadow = hall.receiveShadow = true; F.add(hall);
    box(F, 22, 14, 2, glowM(1.4, 1.2, 0.95), -70, 7, -1.5);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; cyl(F, 0.5, 0.8, 30, MAT.alu, Math.cos(a) * 120, 15, Math.sin(a) * 120, 8); const l = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 0.5), glowM(8, 7.5, 6.5)); l.position.set(Math.cos(a) * 120, 31, Math.sin(a) * 120); l.lookAt(F.position.clone().setY(T_FY + 31)); F.add(l); }
    for (let k = 0; k < 6; k++) { const r = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), glowM(9, 0.8, 0.5)); r.position.set(5, 10 + k * 16, 5); F.add(r); lamps.push({ m: r, kind: 'beacon', phase: k * 0.13 }); }
    colliders.push({ x: fx, z: fz, r: 10, top: T_FY + 100 }, { x: fx + 18, z: fz, r: 6, top: T_FY + 76 }, { x: fx - 70, z: fz + 40, r: 42, top: T_FY + 24 });
    return [{ name: 'The Workshop', x: hx, z: hz, r: 40, text: 'Engineering and software. Each project would be a bay in this hangar: what it is, how it was built, where it runs. [CONTENT — from your repositories]' },
      { name: 'Antenna mast', x: mx, z: mz, r: 20, text: 'Live activity from GitHub would be received here. [LIVE DATA — needs the GitHub API, to be confirmed]' },
      { name: 'The Foundry', x: fx, z: fz, r: 140, text: 'Larger work: systems, infrastructure and what has been shipped. [CONTENT — from your repositories]' }];
  }
  if (key === 'ekatva') {
    const stone = std({ map: sandstoneTex(), roughness: 0.85 });
    const [fx, fz] = FORT; const fy = 34;
    const fort = new THREE.Group(); fort.position.set(fx, fy, fz); root.add(fort);
    const Wd = 70, Dd = 52, H = 11;
    for (const [w, d, x, z] of [[Wd, 3, 0, -Dd / 2], [Wd, 3, 0, Dd / 2], [3, Dd, -Wd / 2, 0], [3, Dd, Wd / 2, 0]]) {
      const wall = box(fort, w, H, d, stone, x, H / 2 - 2, z); wall.material = stone.clone(); wall.material.map = stone.map.clone(); wall.material.map.repeat.set(Math.max(w, d) / 8, 1.4); wall.material.map.needsUpdate = true;
      const n = Math.floor(Math.max(w, d) / 3);
      for (let i = 0; i < n; i++) box(fort, w > d ? 1.4 : 3.2, 1.6, w > d ? 3.2 : 1.4, stone, x + (w > d ? -w / 2 + i * 3 + 1.5 : 0), H - 1.2, z + (w > d ? 0 : -d / 2 + i * 3 + 1.5));
    }
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { cyl(fort, 6, 7, H + 4, stone, sx * Wd / 2, (H + 4) / 2 - 2, sz * Dd / 2, 20); dome(fort, 3, stone, sx * Wd / 2, H + 2.6, sz * Dd / 2); }
    box(fort, 7, 8, 1, std({ color: 0x1b1410 }), 0, 2, Dd / 2 + 1.6);
    box(fort, 26, 14, 18, stone, 0, 5, -4);
    for (const [cx, cz] of [[-9, -10], [9, -10], [-9, 2], [9, 2]]) { for (const [px, pz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) cyl(fort, 0.25, 0.25, 3, stone, cx + px, 13.5, cz + pz, 8); dome(fort, 2.2, stone, cx, 15, cz); }
    dome(fort, 6, stone, 0, 12, -4);
    for (let i = -2; i <= 2; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), glowM(2.2, 1.3, 0.6)); w.position.set(i * 4.5, 6, 5.05); fort.add(w); }
    const lamp = new THREE.PointLight(0xffb070, 0, 70, 2); lamp.position.set(0, 10, 14); fort.add(lamp); lamps.push({ light: lamp, night: 60 });
    colliders.push({ x: fx, z: fz, r: 44, wall: true, top: fy + 16 });
    // The Amphitheatre: stone tiers round a stage
    const [ax, az] = AMPHI; const A = new THREE.Group(); A.position.set(ax, E_AY, az); A.rotation.y = 2.4; root.add(A);
    for (let k = 0; k < 14; k++) { const r0 = 28 + k * 3.2; const t = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 3.2, r0 + 3.2, 1.1 + k * 1.1, 64, 1, false, -Math.PI * 0.6, Math.PI * 1.2), stone); t.position.y = (1.1 + k * 1.1) / 2; t.castShadow = t.receiveShadow = true; A.add(t); }
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 1.4, 48, 1, false, Math.PI * 0.4, Math.PI * 1.2), stone); stage.position.y = 0.7; A.add(stage);
    for (let i = -3; i <= 3; i++) { const a = Math.PI + i * 0.22; const px = Math.sin(a) * 20, pz = Math.cos(a) * 20; cyl(A, 0.8, 0.9, 9, stone, px, 5.9, pz, 12); }
    box(A, 30, 2, 2.4, stone, 0, 11, -20);
    for (let i = 0; i < 8; i++) { const a = -Math.PI * 0.6 + i / 7 * Math.PI * 1.2; const t = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glowM(5, 2.4, 0.8)); t.position.set(Math.sin(a) * 74, 17, Math.cos(a) * 74); A.add(t); lamps.push({ m: t, flicker: true }); }
    colliders.push({ x: ax, z: az, r: 75, wall: true, top: E_AY + 17 });
    return [{ name: 'The Fort', x: fx, z: fz, r: 75, text: 'History, heritage, and the forts and architecture of Rajasthan. [CONTENT — you supply]' },
      { name: 'The river', x: RIVER(-60), z: -60, r: 40, text: 'Books, read and reading, along the slow water. [CONTENT — you supply]' },
      ...[['The ford', FORDS[0]], ['The upper ford', FORDS[1]], ['The lower ford', FORDS[2]]].map(([name, z]) => ({ name, x: RIVER(z), z, r: 35, text: 'A shallow crossing: the rover can drive through here. Elsewhere the river is deep enough to float in, the current carries you downstream, and the banks are too steep to climb out.' })),
      { name: 'Russet forest', x: 60, z: 140, r: 60, text: 'Mythology and philosophy. [CONTENT — you supply]' },
      { name: 'The Amphitheatre', x: ax, z: az, r: 110, text: 'Cinema and music. [CONTENT — you supply]' }];
  }
  if (key === 'arena') {
    const [gx, gz] = GROUND; const gy = A_GY + 0.05;
    const g = new THREE.Group(); g.position.set(gx, gy, gz); root.add(g);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 22), std({ color: 0xc9b27a, roughness: 0.95 })); pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.06; pitch.receiveShadow = true; g.add(pitch);
    for (const z of [-10, 10]) for (const x of [-0.12, 0, 0.12]) cyl(g, 0.02, 0.02, 0.72, std({ color: 0xf0ead8 }), x, 0.36, z, 6);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(1, 0.004, 4, 128), std({ color: 0xffffff })); rope.scale.set(76 * 1.12, 76, 1); rope.rotation.x = Math.PI / 2; rope.position.y = 0.15; g.add(rope);
    for (const z of [-80, 80]) box(g, 16, 6, 0.4, std({ color: 0xf2efe6 }), 0, 3, z);
    const pv = new THREE.Group(); pv.position.set(0, at(gx, gz - 104) - gy, -104); g.add(pv);
    box(pv, 30, 10, 12, std({ color: 0xf1ece0, roughness: 0.7 }), 0, 5, 0); box(pv, 34, 1, 16, std({ color: 0x8a2c1a }), 0, 10.6, 1);
    for (let i = -3; i <= 3; i++) box(pv, 2.6, 3, 0.2, glowM(1.6, 1.3, 0.9), i * 4, 5, 6.1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), label('THE PAVILION', { w: 1024, h: 128, size: 80, color: '#1a1712' })); sign.position.set(0, 8.4, 6.12); pv.add(sign);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, tx = Math.cos(a) * 120, tz = Math.sin(a) * 105;
      const ty = at(gx + tx, gz + tz) - gy;
      cyl(g, 0.6, 1.1, 42, MAT.alu, tx, ty + 21, tz, 8);
      const head = new THREE.Group(); head.position.set(tx, ty + 43, tz); g.add(head); head.lookAt(g.position.clone());
      box(head, 9, 6, 0.6, MAT.darkAlu, 0, 0, 0).castShadow = false;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), glowM(9, 8.6, 7.6)); l.position.set(-3.3 + i * 2.2, -2 + j * 2, 0.35); head.add(l); }
      const sp = new THREE.SpotLight(0xfff2dc, 9000, 260, 0.55, 0.6, 2); sp.position.set(tx, ty + 43, tz); sp.target.position.set(0, 0, 0); g.add(sp, sp.target); lamps.push({ light: sp, day: 2500, night: 9000 });
      colliders.push({ x: gx + tx, z: gz + tz, r: 1.5, top: gy + ty + 46 });
    }
    const cols = [[3, 0.35, 0.05], [3, 1.6, 0.1], [0.3, 2.4, 0.9], [2.6, 0.3, 1.4]];
    for (let i = 0; i < 9; i++) {
      const z = -22 - i * 13, y = at(0, z);
      for (const s of [-1, 1]) cyl(root, 0.1, 0.12, 5, MAT.darkAlu, s * 6, y + 2.5, z, 6);
      for (let k = 0; k < 9; k++) { const t = k / 8; const sag = Math.sin(t * Math.PI) * 0.9; const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), glowM(...cols[(i + k) % 4])); l.position.set(-6 + t * 12, y + 4.9 - sag, z); root.add(l); }
    }
    colliders.push({ x: gx, z: gz - 104, r: 17, top: gy + 16 });
    // The Grand Arena: a stadium bowl with tall light masts, visible from far away (and from orbit)
    const [bx, bz] = GRAND; const S = new THREE.Group(); S.position.set(bx, A_BY, bz); root.add(S);
    const turf = new THREE.Mesh(new THREE.CircleGeometry(1, 96), std({ map: stripeTex('#2f7a1c', '#3a8c22', 30), roughness: 0.9 })); turf.scale.set(150 * 1.25, 150, 1); turf.rotation.x = -Math.PI / 2; turf.position.y = 0.08; turf.receiveShadow = true; S.add(turf);
    const seat = std({ color: 0xe9e3d6, roughness: 0.7 }), seatCol = [0xd93a2b, 0xf2a33a, 0x2f6fb5, 0xf2efe6];
    for (let k = 0; k < 4; k++) {
      const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(158 + t * 60, (k * 0.25 + t * 0.25) * 70)); }
      const tier = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(156 + k * 15, k * 17), new THREE.Vector2(171 + k * 15, k * 17 + 17), new THREE.Vector2(172 + k * 15, k * 17 + 17), new THREE.Vector2(172 + k * 15, k * 17)], 120), std({ color: seatCol[k], roughness: 0.75, side: THREE.DoubleSide }));
      tier.scale.x = 1.25; tier.castShadow = tier.receiveShadow = true; S.add(tier); void prof; void seat;
    }
    const roof = new THREE.Mesh(new THREE.TorusGeometry(232, 3, 8, 160), MAT.alu); roof.scale.set(1.25, 1, 1); roof.rotation.x = Math.PI / 2; roof.position.y = 74; S.add(roof);
    const roofLit = new THREE.Mesh(new THREE.TorusGeometry(228, 0.8, 6, 160), glowM(8, 7.6, 6.8)); roofLit.scale.set(1.25, 1, 1); roofLit.rotation.x = Math.PI / 2; roofLit.position.y = 72; S.add(roofLit);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.3, mx2 = Math.cos(a) * 262 * 1.25, mz2 = Math.sin(a) * 262;
      cyl(S, 1.2, 2.2, 120, MAT.alu, mx2, 60, mz2, 10);
      const hd = new THREE.Group(); hd.position.set(mx2, 122, mz2); S.add(hd); hd.lookAt(S.position.clone());
      box(hd, 16, 10, 1, MAT.darkAlu, 0, 0, 0).castShadow = false;
      const lp = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), glowM(10, 9.4, 8.4)); lp.position.z = 0.6; hd.add(lp);
      colliders.push({ x: bx + mx2, z: bz + mz2, r: 3, top: A_BY + 128 });
    }
    const sp2 = new THREE.SpotLight(0xfff0dc, 40000, 600, 0.9, 0.7, 2); sp2.position.set(0, 200, 0); sp2.target.position.set(0, 0, 0); S.add(sp2, sp2.target); lamps.push({ light: sp2, day: 10000, night: 40000 });
    const bsign = new THREE.Mesh(new THREE.PlaneGeometry(90, 9), label('THE GRAND ARENA', { w: 1024, h: 102, size: 74, color: '#f4efe6' })); bsign.position.set(0, 80, -236); S.add(bsign);
    colliders.push({ x: bx, z: bz, r: 290, wall: true, top: A_BY + 76 });
    return [{ name: 'The Ground', x: gx, z: gz, r: 90, text: 'Cricket: matches, teams and players, under lights that never go off. [LIVE DATA — needs a cricket data API, to be confirmed]' },
      { name: 'The Pavilion', x: gx, z: gz - 104, r: 25, text: 'The records room: scores, tournaments and statistics. [CONTENT — you supply]' },
      { name: 'The Grand Arena', x: bx, z: bz, r: 320, text: 'The big occasions: tournaments and the sport you follow beyond cricket. [CONTENT — you supply]' }];
  }
  // cosmos
  const [ox, oz] = OBS; const oy = 13;
  const domeM = std({ color: 0xdfe3e8, roughness: 0.35, metalness: 0.3 });
  const obs = new THREE.Group(); obs.position.set(ox, oy, oz); root.add(obs);
  cyl(obs, 9, 9, 7, MAT.hull, 0, 3.5, 0, 48); dome(obs, 9.2, domeM, 0, 7, 0);
  box(obs, 2.6, 9.4, 18.6, std({ color: 0x0b0c10 }), 0, 11.4, 0);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 19), glowM(0.5, 0.55, 0.7)); slit.position.set(0, 16.3, 0); obs.add(slit);
  cyl(obs, 5, 5, 4, MAT.hull, 18, 2, 6, 32); dome(obs, 5.2, domeM, 18, 4, 6);
  box(obs, 16, 4, 6, MAT.windows, -14, 2, 8);
  colliders.push({ x: ox, z: oz, r: 11, top: oy + 17 }, { x: ox + 18, z: oz + 6, r: 6, top: oy + 10 });
  for (let i = 0; i < 5; i++) {
    const dx = 60 + i * 32, dz = -110 - i * 34, dy = at(dx, dz);
    const d = new THREE.Group(); d.position.set(dx, dy, dz); root.add(d);
    cyl(d, 0.8, 1.2, 9, MAT.alu, 0, 4.5, 0, 10);
    const prof = []; for (let k = 0; k <= 14; k++) { const t = k / 14; prof.push(new THREE.Vector2(9 * t, 9 * 0.3 * t * t)); }
    const dish = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), std({ color: 0xe8e6e0, side: THREE.DoubleSide, roughness: 0.5 })); dish.position.y = 10; dish.rotation.x = -0.8; dish.rotation.z = 0.4; dish.castShadow = true; d.add(dish);
    colliders.push({ x: dx, z: dz, r: 2.5, top: dy + 16 });
  }
  // The Great Telescope: a dish set into a crater, a receiver hung from three towers
  const [sx, sz] = SCOPE; const T = new THREE.Group(); T.position.set(sx, K_SY - 60, sz); root.add(T);
  const panelTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#c9ced4'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#8a9097'; x.lineWidth = 2; for (let i = 0; i <= 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 6); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const prof = []; for (let k = 0; k <= 24; k++) { const t = k / 24; prof.push(new THREE.Vector2(280 * t, 60 * t * t + 0.6)); }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), std({ map: panelTex, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide })); bowl.receiveShadow = true; T.add(bowl);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const tx = Math.cos(a) * 300, tz = Math.sin(a) * 300; lattice(T, tx, 60, tz, 8, 110, MAT.alu, 10); colliders.push({ x: sx + tx, z: sz + tz, r: 7, top: K_SY + 115 }); }
  const plat = new THREE.Group(); plat.position.y = 150; T.add(plat);
  box(plat, 40, 6, 40, MAT.darkAlu, 0, 0, 0); cyl(plat, 10, 6, 16, MAT.white, 0, -10, 0, 32);
  const cable = new THREE.LineBasicMaterial({ color: 0x9aa0a6 });
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const g2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * 300, 170, Math.sin(a) * 300), new THREE.Vector3(Math.cos(a) * 18, 150, Math.sin(a) * 18)]); T.add(new THREE.Line(g2, cable)); }
  for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), glowM(9, 0.8, 0.5)); const a = k / 3 * Math.PI * 2; r.position.set(Math.cos(a) * 300, 172, Math.sin(a) * 300); T.add(r); lamps.push({ m: r, kind: 'beacon', phase: k * 0.3 }); }
  return [{ name: 'The Observatory', x: ox, z: oz, r: 35, text: 'Astronomy: celestial objects, catalogues and images. [CONTENT — you supply]' },
    { name: 'The Array', x: 124, z: -178, r: 60, text: 'Space missions and live feeds would arrive here. [LIVE DATA — e.g. NASA APIs, to be confirmed]' },
    { name: 'The Great Telescope', x: sx, z: sz, r: 320, text: 'Deep-sky observing: the objects you follow and the images you make. [CONTENT — you supply]' }];
}

// ---------- vegetation and rocks per world ----------
function scatterDefs(key, W, wind) {
  // models only: where each one grows is decided in fields.js (run in the worker), in the same order
  const rockMat = (c, r = 0.9) => std({ color: c, roughness: r, vertexColors: true });
  const tree = (kind, k) => treeModels(kind, 3).map((t) => {
    const wood = windify(std({ color: 0x3a2618, roughness: 1, vertexColors: true }), k * 0.3, wind), crown = windify(std({ color: 0xffffff, roughness: 0.85, vertexColors: true }), k, wind);
    return { lods: [[{ geo: t.wood, mat: wood, tint: false }, { geo: t.crown, mat: crown }, { geo: t.cards, mat: leafMaterial(wind, k) }],
      [{ geo: t.farWood, mat: wood, tint: false }, { geo: t.farCrown, mat: crown }], [{ geo: t.farthestWood, mat: wood, tint: false }, { geo: t.farthestCrown, mat: crown }]] };
  });
  const rocks = (n, o, colour) => { const mat = rockMat(colour); const l0 = rockModels(n, { ...o, detail: 2 }), l1 = rockModels(n, { ...o, detail: 1 }), l2 = rockModels(n, { ...o, detail: 0 }); return l0.map((geo, i) => ({ lods: [[{ geo, mat }], [{ geo: l1[i], mat }], [{ geo: l2[i], mat }]] })); };
  if (key === 'ekatva') return [{ variants: tree('broad', 0.004), cap: 7000, shadow: true, tall: true }, { variants: rocks(3, { seed: 5, flatten: 0.55 }, 0xa47656), cap: 3000, shadow: true }];
  if (key === 'arena') return [{ variants: tree('parasol', 0.003), cap: 2500, shadow: true, tall: true }, { variants: rocks(3, { seed: 9, flatten: 0.6 }, 0x8a6a56), cap: 2000, shadow: true }];
  if (key === 'technova') return [{ variants: rocks(4, { seed: 2, flatten: 0.7, rough: 0.6 }, 0x2c2b2c), cap: 9000, shadow: true }];
  const ice = std({ color: 0xd8e8f8, roughness: 0.15, metalness: 0.05, vertexColors: true });
  return [{ variants: rocks(3, { seed: 4, flatten: 0.6 }, 0x3a3836), cap: 6000, shadow: true }, { variants: shardModels(3).map((geo) => ({ lods: [[{ geo, mat: ice }]] })), cap: 2000, shadow: true }];
}

// ---------- the surface scene ----------
export function createSurface(renderer, key, opts = {}) {
  const W = WORLDS[key];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 30000);
  const S = W.sky;
  scene.fog = new THREE.FogExp2(0x000000, W.fog);
  const sunDir = new THREE.Vector3(...(opts.sun ? opts.sun.toArray() : S.sun)).normalize();
  const col = (h) => new THREE.Color(h);
  const skyU = { uDZ: { value: col(S.dayZen) }, uDH: { value: col(S.dayHor) }, uSH: { value: col(S.setHor) }, uNZ: { value: col(S.nightZen) }, uNH: { value: col(S.nightHor) }, uSun: { value: sunDir }, uSunCol: { value: new THREE.Color(...S.sunCol) }, uStars: { value: S.stars }, uClouds: { value: S.clouds }, uRing: { value: S.ring }, uAurora: { value: S.aurora }, uTime: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  const pm = new THREE.PMREMGenerator(renderer); const envScene = new THREE.Scene(); envScene.add(sky.clone()); let envDir = null, envTex = null;

  let q = opts.q || { shadows: true, shadowMap: 2048, grass: { r: 46, sp: 0.42 }, flowers: true, crad: 3, farSeg: 400, relief: 260, tiles: 4, lod: [140, 450], drawFar: 1150, motes: 1500, inflight: 4, workers: 2 };
  const sun = new THREE.DirectionalLight(new THREE.Color(...S.sunCol), S.sunI);
  sun.castShadow = q.shadows; sun.shadow.mapSize.set(q.shadowMap, q.shadowMap); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -80; sc.right = sc.top = 80; sc.near = 1; sc.far = 900;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(W.hemi[0], W.hemi[1], W.hemi[2]); scene.add(hemi);

  const pool = createPool(key, q.workers);
  const terrain = createTerrain(scene, W, renderer, pool, q);
  const at = (x, z) => terrain.heightAt(x, z);
  const water = W.waterSpec ? createWater(scene, terrain, W.waterSpec) : null;
  const waterAt = water ? water.level : -Infinity;

  const colliders = [], lamps = [];
  const pois = features(key, W, scene, colliders, lamps, at);
  const windDir = new THREE.Vector2(...W.windDir).normalize();
  const wind = { time: terrain.time, amount: { value: W.wind } };
  const scatter = createScatter(scene, scatterDefs(key, W, wind), pool, q);
  // grass and flowers; at lower levels fewer, slightly bigger tufts over a shorter distance
  let covers = [];
  function makeCovers() {
    covers.forEach((c) => { scene.remove(c.mesh); c.dispose(); }); covers = [];
    const g = q.grass, k = g.sp / 0.42, wv = (s) => [windDir.x * W.wind * s, windDir.y * W.wind * s];
    if (key === 'ekatva') {
      covers.push(createCover(scene, terrain, { channel: 'y', radius: g.r, spacing: g.sp, tuft: { blades: 3, segs: 3, height: 0.78, width: 0.07 * k, spread: 0.22 * k }, base: [0.2, 0.11, 0.03], tip: [0.86, 0.63, 0.26], wind: wv(0.6), windK: 1 }));
      if (q.flowers) covers.push(createCover(scene, terrain, { channel: 'z', radius: g.r * 0.82, spacing: 1.0, tuft: { blades: 2, segs: 2, height: 0.6, width: 0.03, head: 0.05 }, base: [0.25, 0.17, 0.05], tip: [0.42, 0.3, 0.1], pal: [[0.98, 0.78, 0.22], [0.82, 0.25, 0.1], [0.95, 0.92, 0.82], [0.9, 0.55, 0.12]], wind: wv(0.6), windK: 1 }));
    } else if (key === 'arena') {
      covers.push(createCover(scene, terrain, { channel: 'y', radius: g.r, spacing: g.sp, tuft: { blades: 3, segs: 3, height: 0.58, width: 0.065 * k, spread: 0.22 * k }, base: [0.03, 0.15, 0.02], tip: [0.36, 0.64, 0.12], wind: wv(0.55), windK: 1 }));
      covers.push(createCover(scene, terrain, { channel: 'z', radius: g.r * 0.87, spacing: q.flowers ? 0.55 : 0.8, tuft: { blades: 3, segs: 2, height: 0.5, width: 0.03, head: q.flowers ? 0.065 : 0.09 }, base: [0.05, 0.2, 0.03], tip: [0.25, 0.45, 0.08], pal: [[1.0, 0.45, 0.05], [0.95, 0.1, 0.25], [1.0, 0.82, 0.1], [0.75, 0.15, 0.6]], wind: wv(0.55), windK: 1 }));
    }
  }
  makeCovers();

  // drifting dust or pollen in the wind
  let motes = null;
  if (W.wind > 0.05) {
    const n = q.motes, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 120, Math.random() * 25, (Math.random() - 0.5) * 120], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, color: key === 'technova' ? 0x9a9690 : 0xf0d8a8, transparent: true, opacity: 0.55, depthWrite: false })); motes.frustumCulled = false; scene.add(motes);
  }
  // engine dust: thrown out by the exhaust, falling under the world's gravity
  const dustN = 900, dustPos = new Float32Array(dustN * 3).fill(-1e5), dustVel = new Float32Array(dustN * 3);
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.7, map: softDot(), color: new THREE.Color(...W.dustCol), transparent: true, opacity: 0, depthWrite: false })); dust.frustumCulled = false; scene.add(dust);
  let dustI = 0;

  // the lander and its flight model
  const lander = buildLander(); scene.add(lander);
  const lights = [];
  for (const s of [-1, 1]) { const sp = new THREE.SpotLight(0xfff3e0, 0, 140, 0.45, 0.5, 1.6); sp.position.set(s * 0.85, 2.98, -1.3); sp.target.position.set(s * 2, -6, -30); lander.add(sp, sp.target); lights.push(sp); }
  const g = W.g * 9.81;
  const groundAt = (x, z) => at(x, z) + (key === 'technova' && Math.hypot(x, z) < 16 ? 0.25 : 0);
  const windNow = new THREE.Vector3();
  const sim = createLanderSim({
    g: W.g, drag: W.drag, height: (x, z) => Math.max(groundAt(x, z), waterAt), pad: new THREE.Vector3(0, 0, 0), solids: colliders.filter((c) => c.top !== undefined),
    wind: () => windNow,
  });
  sim.place(-90, at(-90, 140) + 600, 140, 0.3); sim.s.vel.set(10, -40, -14); sim.s.auto = 'descent'; sim.s.wasContact = false;
  const astro = buildAstronaut(); astro.root.visible = false; scene.add(astro.root);
  // the rover rides down with the lander and is set on the ground when you first step out
  const rover = buildRover(); rover.visible = false; scene.add(rover);
  const rv = createRoverSim({ g: W.g, drag: W.drag, heightAt: (x, z) => groundAt(x, z), solids: colliders, query: (p, r, out) => scatter.query(p, r, out), bound: BOUND,
    water: water ? water.level : null, current: (x, z, out) => (water ? water.current(x, z, out) : out.set(0, 0, 0)), wind: () => windNow });
  // splashes: thrown up by the wheels and the paddling, falling back into the water
  const spN = 400, spPos = new Float32Array(spN * 3).fill(-1e5), spVel = new Float32Array(spN * 3); let spI = 0;
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const splash = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.35, map: softDot(), color: 0xe8e4d8, transparent: true, opacity: 0.7, depthWrite: false })); splash.frustumCulled = false; scene.add(splash);
  function spawnSplash(n, x, z, yaw, sp) {
    for (let k = 0; k < n; k++) { const i = spI++ % spN, side = Math.random() < 0.5 ? -1 : 1, a = yaw + side * (1.2 + Math.random() * 0.6);
      spPos.set([x + Math.sin(yaw) * (Math.random() * 3 - 1.5) + side * Math.cos(yaw) * 1.3, waterAt + 0.1, z + Math.cos(yaw) * (Math.random() * 3 - 1.5) - side * Math.sin(yaw) * 1.3], i * 3);
      spVel.set([-Math.sin(a) * sp * (0.3 + Math.random() * 0.4), 1.5 + Math.random() * 2.5 * Math.min(1, sp / 4), -Math.cos(a) * sp * (0.3 + Math.random() * 0.4)], i * 3); }
  }
  const wake = { x: 0, z: 0, speed: 0, on: false };
  let roverOut = false;
  const landerSolid = { x: 0, z: 0, r: 2.6 }; // kept at the lander for the rover's collisions
  const seatW = new THREE.Vector3();

  const st = {
    phase: 'descent', t: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, camYaw: 0.6, camPitch: 0.22, camDist: 22, camOff: 0, walk: 0, onGround: true,
    poi: null, msg: '', done: false, lander: sim.s,
  };

  // ---------- day and night ----------
  let day = 1, night = 0;
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  function applySun() {
    const e = sunDir.y;
    day = ss(-0.08, 0.3, e); night = 1 - ss(-0.2, 0.04, e);
    const setK = ss(-0.2, 0.0, e) * (1 - ss(0.06, 0.42, e));
    skyU.uSun.value.copy(sunDir);
    sun.intensity = S.sunI * ss(-0.03, 0.12, e);
    sun.color.setRGB(...S.sunCol).lerp(tmpC.setRGB(1.0, 0.55, 0.28), 1 - ss(0.0, 0.3, e));
    hemi.intensity = W.hemi[2] * (0.4 + 0.6 * day);
    hemi.color.set(W.hemi[0]).lerp(tmpC.setRGB(0.16, 0.19, 0.27), 1 - day);
    // fog takes the colour of the horizon
    scene.fog.color.set(S.nightHor).lerp(tmpC.set(S.dayHor), day).lerp(tmpC.set(S.setHor), setK * 0.45);
    scene.environmentIntensity = 0.12 + 0.55 * day;
    renderer.toneMappingExposure = W.expo * (1 + 0.55 * night);
    for (const l of lamps) if (l.light) l.light.intensity = l.night !== undefined ? (l.day ?? 0) + ((l.night) - (l.day ?? 0)) * night : l.light.intensity;
    for (const sp of lights) sp.intensity = night * 2600;
    astro.spot.intensity = night * 60; astro.lampM.color.setScalar(0.3 + night * 5);
    for (const lm of lander.userData.lamps) lm.material.color.setScalar(0.3 + night * 6);
    if (!envDir || envDir.angleTo(sunDir) > 0.06) {
      envDir = sunDir.clone(); const old = envTex; envTex = pm.fromScene(envScene, 0.04).texture; scene.environment = envTex; if (old) old.dispose();
    }
  }
  applySun();

  function spawnDust(n, L, spMin, spMax, lift) {
    if (W.dust <= 0) return;
    const gy = groundAt(L.x, L.z);
    for (let k = 0; k < n; k++) { const i = dustI++ % dustN; const an = Math.random() * 6.28, sp = spMin + Math.random() * (spMax - spMin); dustPos.set([L.x + Math.cos(an) * 1.5, gy + 0.3, L.z + Math.sin(an) * 1.5], i * 3); dustVel.set([Math.cos(an) * sp, lift * Math.random(), Math.sin(an) * sp], i * 3); }
  }
  const focus = new THREE.Vector3();
  // the ground round the landing point, the plants on it and the shaders are all ready before you see anything
  let isReady = false;
  const ready = (async () => {
    const f = new THREE.Vector3(sim.s.pos.x, 0, sim.s.pos.z), t0 = performance.now();
    const tr = terrain.ready(f, 1);
    while (performance.now() - t0 < 6000) { terrain.update(f); scatter.update(f); if (!terrain.busy && !scatter.busy) break; await new Promise((r) => setTimeout(r, 30)); }
    await tr;
    camera.position.set(f.x, at(f.x, f.z) + 40, f.z + 30); camera.lookAt(f.x, at(f.x, f.z), f.z);
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* older browsers compile on first draw */ }
    isReady = true;
  })();
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  let camYawS = null;

  return {
    scene, camera, key, W, pois, st,
    get wind() { return W.wind; },
    get gravity() { return W.g; },
    get sunElev() { return Math.asin(THREE.MathUtils.clamp(sunDir.y, -1, 1)); },
    get night() { return night; },
    landerPos: () => sim.s.pos,
    thrust: () => sim.s.thrust,
    setSun(v) { sunDir.copy(v).normalize(); },
    skipToLanded(x = 0, z = 0, yaw = 0.3) { sim.place(x, groundAt(x, z) + 0.05, z, yaw); sim.s.auto = null; sim.s.aglHold = 0; sim.s.wasContact = true; sim.s.contact = true; sim.s.landed = true; sim.s.thrust = 0; st.phase = 'pilot'; },
    stepOut() {
      if (st.phase !== 'pilot' || !sim.s.landed) return false;
      st.phase = 'walk'; astro.root.visible = true;
      if (!roverOut) { // unload the rover beside the lander, facing the same way
        const o = new THREE.Vector3(5.2, 0, 1.0).applyAxisAngle(new THREE.Vector3(0, 1, 0), sim.s.yaw);
        rv.place(sim.s.pos.x + o.x, sim.s.pos.z + o.z, sim.s.yaw); rover.visible = true; roverOut = true;
      }
      const off = new THREE.Vector3(-1.6, 0, -4.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), sim.s.yaw);
      st.pos.copy(sim.s.pos).add(off); st.pos.y = groundAt(st.pos.x, st.pos.z); st.vel.set(0, 0, 0); st.yaw = sim.s.yaw; st.camDist = 7; st.camYaw = sim.s.yaw + 0.5; return true;
    },
    ready,
    get loading() { return !isReady ? 1 : terrain.busy + scatter.busy; },
    // back to the lander from wherever you have walked (the way off the planet is from its cabin)
    get roverOut() { return roverOut; },
    rover: rv.s,
    // into the rover (when next to it) or out of it
    drive() {
      if (st.phase === 'walk' && roverOut && st.pos.distanceTo(rv.s.pos) < 4.5) { st.phase = 'drive'; st.camDist = 12; camYawS = null; st.camOff = 0; return true; }
      if (st.phase === 'drive') {
        if (Math.abs(rv.s.speed) > 2) return false;
        const o = new THREE.Vector3(-2.3, 0, 0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), rv.s.yaw);
        st.phase = 'walk'; st.pos.copy(rv.s.pos).add(o); st.pos.y = groundAt(st.pos.x, st.pos.z); st.vel.set(0, 0, 0); st.yaw = rv.s.yaw; st.camYaw = rv.s.yaw + 0.4; st.camDist = 7;
        astro.root.rotation.set(0, rv.s.yaw, 0); return true;
      }
      return false;
    },
    // the rover drives itself to you (shown with a fade by the caller)
    summon() {
      if (st.phase !== 'walk') return false;
      const o = new THREE.Vector3(3.5, 0, -2).applyAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw);
      rv.place(st.pos.x + o.x, st.pos.z + o.z, st.yaw); rover.visible = true; roverOut = true; return true;
    },
    recall() { if (st.phase === 'drive') { st.phase = 'walk'; astro.root.rotation.set(0, 0, 0); } if (st.phase !== 'walk') return false; st.phase = 'pilot'; astro.root.visible = false; st.camDist = 22; st.camYaw = sim.s.yaw + 0.5; camYawS = null; return true; },
    setQuality(nq) {
      const mapChanged = nq.shadowMap !== q.shadowMap; q = nq;
      sun.castShadow = q.shadows; if (mapChanged) { sun.shadow.mapSize.set(q.shadowMap, q.shadowMap); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
      scatter.setQuality(q); makeCovers();
    },
    board() { if (st.phase !== 'walk') return false; if (st.pos.distanceTo(sim.s.pos) > 7) return false; st.phase = 'pilot'; astro.root.visible = false; st.camDist = 22; return true; },
    takeOff() { if (st.phase !== 'pilot') return; st.phase = 'ascent'; st.t = 0; sim.s.auto = 'ascent'; },
    resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
    labels() {
      const out = pois.map((p) => ({ name: p.name, pos: new THREE.Vector3(p.x, at(p.x, p.z) + 12, p.z) }));
      if (st.phase === 'walk' || st.phase === 'drive') out.push({ name: 'Lander', pos: sim.s.pos.clone().add(new THREE.Vector3(0, 6.5, 0)), lander: true });
      if (st.phase === 'walk' && roverOut) out.push({ name: 'Rover', pos: rv.s.pos.clone().add(new THREE.Vector3(0, 3.2, 0)), lander: true });
      return out;
    },
    get here() { return st.phase === 'walk' ? st.pos : st.phase === 'drive' ? rv.s.pos : sim.s.pos; },
    update(dt, input) {
      if (!isReady) return;
      terrain.time.value += dt; skyU.uTime.value = terrain.time.value;
      const t = terrain.time.value;
      applySun();
      const gust = 0.6 + 0.4 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1);
      windNow.set(windDir.x, 0, windDir.y).multiplyScalar(W.wind * 14 * gust);
      // ---- the lander ----
      const L = sim.s;
      if (st.phase === 'descent') {
        const any = input.fwd || input.turn || input.strafe || input.up;
        if (any && L.agl < 400) { L.auto = null; L.aglHold = Math.min(L.agl, 60); st.phase = 'pilot'; sim.say('Manual control'); }
      }
      const pilotIn = st.phase === 'pilot' ? { fwd: input.fwd, strafe: input.strafe, turn: input.turn, up: input.up, down: input.down, boost: input.boost } : { fwd: 0, strafe: 0, turn: 0, up: false, down: false };
      sim.update(dt, pilotIn);
      if (st.phase === 'descent' && L.landed) { L.auto = null; L.aglHold = 0; st.phase = 'pilot'; }
      if (st.phase === 'ascent') { st.t += dt; if (st.t > 7.5 || L.agl > 450) st.done = true; }
      if (st.phase === 'pilot' || st.phase === 'descent') scatter.collide(L.pos, 2.6, L.pos.y);
      L.pos.x = THREE.MathUtils.clamp(L.pos.x, -BOUND, BOUND); L.pos.z = THREE.MathUtils.clamp(L.pos.z, -BOUND, BOUND);
      poseLander(lander, L, t);
      if (L.agl < 18 && L.thrust > 0.15) spawnDust(Math.round(26 * L.thrust * (1 - L.agl / 18)), L.pos, 8, 20, 3);
      for (const l of lamps) { if (l.kind === 'beacon' && l.m) l.m.visible = ((t + l.phase) % 1.6) < 0.14; if (l.flicker) l.m.scale.setScalar(0.85 + 0.15 * Math.sin(t * 13 + l.m.position.x)); }
      for (const l of lander.userData.lights || []) { if (l.kind === 'beacon') l.m.visible = ((t + l.phase) % 1.6) < 0.14; else if (l.kind === 'strobe') l.m.visible = ((t + l.phase) % 1.1) < 0.06; }
      for (let i = 0; i < dustN; i++) { const k = i * 3; if (dustPos[k + 1] < -1e4) continue; dustVel[k + 1] -= g * 0.15 * dt; for (let a = 0; a < 3; a++) { dustVel[k + a] *= 1 - dt * (0.4 + W.dust); dustPos[k + a] += dustVel[k + a] * dt; } if (dustPos[k + 1] < groundAt(dustPos[k], dustPos[k + 2])) { dustVel[k] = dustVel[k + 1] = dustVel[k + 2] = 0; } }
      dustGeo.attributes.position.needsUpdate = true; dust.material.opacity = W.dust > 0 ? 0.35 : 0;
      if (water) {
        for (let i = 0; i < spN; i++) { const k = i * 3; if (spPos[k + 1] < -1e4) continue; spVel[k + 1] -= g * dt; spPos[k] += spVel[k] * dt; spPos[k + 1] += spVel[k + 1] * dt; spPos[k + 2] += spVel[k + 2] * dt; if (spPos[k + 1] < waterAt - 0.1) spPos[k + 1] = -1e5; }
        spGeo.attributes.position.needsUpdate = true;
        // the wake follows whoever is moving through the water
        const inWater = (roverOut && (rv.s.float || rv.s.depth > 0.3)) ? rv.s : null;
        if (inWater) { wake.x = rv.s.pos.x; wake.z = rv.s.pos.z; wake.speed = Math.abs(rv.s.speed); wake.on = true; }
        else if (st.phase === 'walk' && waterAt - groundAt(st.pos.x, st.pos.z) > 0.3) { wake.x = st.pos.x; wake.z = st.pos.z; wake.speed = Math.hypot(st.vel.x, st.vel.z) * 0.5; wake.on = true; }
        else wake.on = false;
        const dz = tmpC.set(S.nightZen).lerp(tmpC2.set(S.dayZen), day);
        water.update(t, sunDir, sun.color, Math.max(0.15, S.sunI * ss(-0.03, 0.12, sunDir.y) / 2.5), day, dz, scene.fog.color, wake);
      }

      // ---- the rover ----
      if (roverOut) {
        const driving = st.phase === 'drive';
        landerSolid.x = L.pos.x; landerSolid.z = L.pos.z; if (!colliders.includes(landerSolid)) colliders.push(landerSolid);
        rv.update(dt, driving ? { fwd: input.fwd, turn: THREE.MathUtils.clamp(input.turn + input.strafe, -1, 1), brake: input.jump, boost: input.run } : { fwd: 0, turn: 0, brake: true, boost: false });
        poseRover(rover, rv.s, rv.groundAt, night, t, dt);
        if (rv.s.splash > 0.3 && Math.random() < Math.min(1, rv.s.splash * 0.5)) spawnSplash(Math.ceil(rv.s.splash), rv.s.pos.x, rv.s.pos.z, rv.s.yaw, Math.abs(rv.s.speed) + 1);
        for (const l of rover.userData.lights || []) if (l.kind === 'beacon') l.m.visible = ((t + l.phase) % 1.6) < 0.14;
        if (driving) { // the astronaut sits in the driver's seat
          seatW.copy(SEAT).applyQuaternion(rover.quaternion).add(rover.position);
          astro.root.position.copy(seatW); astro.root.quaternion.copy(rover.quaternion);
          seatAstronaut(astro, rv.s.steer, dt);
          st.pos.copy(rv.s.pos);
          if (Math.abs(rv.s.speed) > 3 && W.dust > 0 && Math.random() < 0.6) spawnDust(2, new THREE.Vector3(rv.s.pos.x - Math.sin(rv.s.yaw) * -2.2, 0, rv.s.pos.z - Math.cos(rv.s.yaw) * -2.2), 0.5, 2, 1.5);
        }
      }
      // ---- on foot ----
      if (st.phase === 'walk') {
        const fwd = new THREE.Vector3(-Math.sin(st.camYaw), 0, -Math.cos(st.camYaw)), right = new THREE.Vector3(Math.cos(st.camYaw), 0, -Math.sin(st.camYaw));
        const mv = new THREE.Vector3().addScaledVector(fwd, input.fwd).addScaledVector(right, input.side);
        const moving = mv.lengthSq() > 0; if (moving) mv.normalize();
        // uphill is slower, downhill a little faster
        let grade = 0; if (moving) grade = (groundAt(st.pos.x + mv.x * 0.6, st.pos.z + mv.z * 0.6) - groundAt(st.pos.x, st.pos.z)) / 0.6;
        const wdepth = waterAt - groundAt(st.pos.x, st.pos.z), swim = wdepth > 1.35;
        const top = (input.run ? 5.4 : 2.1) * THREE.MathUtils.clamp(1 - grade * 1.1, 0.25, 1.25) * (swim ? 0.45 : wdepth > 0.2 ? 1 - Math.min(0.6, wdepth * 0.45) : 1);
        if (moving) st.yaw = Math.atan2(-mv.x, -mv.z);
        // grip depends on gravity: low gravity means less traction, so you slide and drift
        const grip = st.onGround ? THREE.MathUtils.clamp(W.g * 9, 1.6, 10) : 0.4;
        st.vel.x = THREE.MathUtils.lerp(st.vel.x, mv.x * top, 1 - Math.exp(-dt * grip)); st.vel.z = THREE.MathUtils.lerp(st.vel.z, mv.z * top, 1 - Math.exp(-dt * grip));
        const lowG = W.g < 0.4;
        if (st.onGround && input.jump) { st.vel.y = 3.3; st.onGround = false; }
        else if (st.onGround && lowG && moving && input.run) { st.vel.y = 1.3; st.onGround = false; } // the lope
        st.vel.y -= g * dt;
        st.vel.x += windNow.x * W.drag * 0.05 * dt; st.vel.z += windNow.z * W.drag * 0.05 * dt;
        st.pos.addScaledVector(st.vel, dt);
        for (const c of [...colliders, { x: L.pos.x, z: L.pos.z, r: 2.4 }, ...(roverOut ? [{ x: rv.s.pos.x, z: rv.s.pos.z, r: 1.6 }] : [])]) { if (c.top !== undefined && st.pos.y > c.top) continue; const dx = st.pos.x - c.x, dz = st.pos.z - c.z, d = Math.hypot(dx, dz); if (d < c.r + 0.35 && !(c.wall && d < c.r - 4)) { const s = (c.r + 0.35) / Math.max(d, 1e-3); st.pos.x = c.x + dx * s; st.pos.z = c.z + dz * s; } }
        scatter.collide(st.pos, 0.35, st.pos.y);
        st.pos.x = THREE.MathUtils.clamp(st.pos.x, -BOUND, BOUND); st.pos.z = THREE.MathUtils.clamp(st.pos.z, -BOUND, BOUND);
        if (swim) { // afloat: head above the water, carried a little by the current
          const c = water.current(st.pos.x, st.pos.z, new THREE.Vector3()); st.pos.x += c.x * dt * 0.8; st.pos.z += c.z * dt * 0.8;
          st.pos.y = waterAt - 1.25 + Math.sin(t * 2) * 0.04; st.vel.y = 0; st.onGround = true;
        }
        if (wdepth > 0.2 && (st.vel.x * st.vel.x + st.vel.z * st.vel.z) > 1 && Math.random() < 0.3) spawnSplash(1, st.pos.x, st.pos.z, st.yaw, 1.2);
        const gy = swim ? st.pos.y : groundAt(st.pos.x, st.pos.z);
        if (st.pos.y <= gy) { if (!st.onGround && st.vel.y < -4) st.land = 0.25; st.pos.y = gy; st.vel.y = 0; st.onGround = true; } else if (st.pos.y > gy + 0.06) st.onGround = false;
        astro.root.position.copy(st.pos); astro.root.rotation.x = astro.root.rotation.z = 0;
        astro.root.rotation.y += wrapAngle(st.yaw - astro.root.rotation.y) * (1 - Math.exp(-dt * 10));
        const hs = Math.hypot(st.vel.x, st.vel.z); st.walk += dt * hs * (lowG ? 1.5 : 2.3);
        poseAstronaut(astro, { phase: st.walk, speed: hs, air: !st.onGround && st.vel.y > -0.5 && !lowG, lowG, lean: Math.min(0.12, hs * 0.02), dt, t });
      }
      // ---- camera ----
      focus.copy(st.phase === 'walk' ? st.pos : st.phase === 'drive' ? rv.s.pos : L.pos).add(new THREE.Vector3(0, st.phase === 'walk' ? 1.5 : st.phase === 'drive' ? 1.8 : 3, 0));
      let yaw, dist;
      if (st.phase === 'walk') { yaw = st.camYaw; dist = st.camDist; }
      else if (st.phase === 'drive') { // a chase camera that swings round behind the rover as it turns
        if (!input.dragging) st.camOff *= Math.exp(-dt * (Math.abs(rv.s.speed) > 2 ? 1.2 : 0.05));
        const want = rv.s.yaw + st.camOff; camYawS = camYawS === null ? want : camYawS + wrapAngle(want - camYawS) * (1 - Math.exp(-dt * 3.5));
        yaw = camYawS; dist = st.camDist * (1 + Math.min(0.4, Math.abs(rv.s.speed) / 50)); st.camYaw = yaw;
      }
      else if (st.phase === 'pilot') {
        if (!input.dragging) st.camOff *= Math.exp(-dt * (Math.hypot(L.vel.x, L.vel.z) > 3 ? 0.8 : 0.05));
        const want = L.yaw + st.camOff; camYawS = camYawS === null ? want : camYawS + wrapAngle(want - camYawS) * (1 - Math.exp(-dt * 3));
        yaw = camYawS; dist = st.camDist * (1 + Math.min(0.5, Math.hypot(L.vel.x, L.vel.z) / 60)); st.camYaw = yaw;
      } else { if (!input.dragging) st.camYaw += dt * 0.12; yaw = st.camYaw; dist = st.phase === 'descent' ? 30 : 26; camYawS = null; }
      const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(st.camPitch), Math.sin(st.camPitch), Math.cos(yaw) * Math.cos(st.camPitch)).multiplyScalar(dist);
      camera.position.copy(focus).add(off);
      const minY = groundAt(camera.position.x, camera.position.z) + 0.8; if (camera.position.y < minY) camera.position.y = minY;
      camera.lookAt(focus);
      sky.position.copy(camera.position);
      sun.position.copy(focus).addScaledVector(sunDir.y > 0 ? sunDir : new THREE.Vector3(sunDir.x, 0.05, sunDir.z).normalize(), 400); sun.target.position.copy(focus);
      // stream the land, the plants and the rocks around you
      terrain.update(focus); scatter.update(focus); for (const c of covers) c.update(camera.position);
      if (motes) { motes.position.set(focus.x, focus.y - 8, focus.z); const a = motes.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let x = a.getX(i) + windNow.x * dt * 0.4, z = a.getZ(i) + windNow.z * dt * 0.4; if (x > 60) x -= 120; if (x < -60) x += 120; if (z > 60) z -= 120; if (z < -60) z += 120; a.setX(i, x); a.setZ(i, z); a.setY(i, a.getY(i) + Math.sin(t + i) * dt * 0.2); } a.needsUpdate = true; }
      const here = st.phase === 'walk' ? st.pos : st.phase === 'drive' ? rv.s.pos : L.pos;
      st.poi = pois.find((q) => Math.hypot(here.x - q.x, here.z - q.z) < q.r) || null;
      st.nearLander = st.phase === 'walk' && st.pos.distanceTo(L.pos) < 7;
      st.nearRover = st.phase === 'walk' && roverOut && st.pos.distanceTo(rv.s.pos) < 4.5;
      st.roverFar = st.phase === 'walk' && (!roverOut || st.pos.distanceTo(rv.s.pos) > 30);
    },
    dispose() {
      terrain.dispose(); scatter.dispose(); covers.forEach((c) => c.dispose()); pool.dispose(); if (water) water.dispose();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      if (envTex) envTex.dispose(); pm.dispose(); renderer.toneMappingExposure = 1.0;
    },
  };
}
