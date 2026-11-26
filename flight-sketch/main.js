// Flight sketch: a throwaway prototype for judging flight feel. Not production code.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PLANET_VERT, PLANET_FRAG, BAKE_VERT, BAKE_FRAG, ATMO_FRAG, CLOUD_FRAG, AURORA_FRAG, STAR_FRAG, CORONA_FRAG, PROM_VERT, PROM_FRAG, RING_VERT, RING_FRAG } from './shaders.js';
import { createSurface, buildLander } from './surface.js';
import { createInterior } from './interior.js';
import { DESIGNS, animateVessel } from './vessels.js';
import { buildStation } from './station.js';
import { blinkLights } from './parts.js';
import { createQuality } from './quality.js';
import { createTouch } from './touch.js';
import { createAmbience } from './ambience.js';

const Q = new URLSearchParams(location.search);
const KM = 6; // display km per world unit (distances are compressed)
const GFX = createQuality(Q);
if (Q.has('shot') || Q.has('errors')) { // test aid: show errors on the page
  const box = document.createElement('pre'); box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;color:#f66;font-size:11px;max-width:90vw;white-space:pre-wrap;pointer-events:none'; document.body.appendChild(box);
  const add = (m) => { box.textContent += m + '\n'; };
  addEventListener('error', (e) => add('ERR ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  addEventListener('unhandledrejection', (e) => add('REJ ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
}

// ---------- renderers, scene, camera, post ----------
// Two renderers: space needs a logarithmic depth buffer (metres to millions of km), which turns off the GPU's
// early depth test; the surfaces do not need it and are full of overdraw (grass, leaves), so they get their own.
const canvas = document.getElementById('gl');
const canvas2 = document.createElement('canvas'); canvas2.id = 'gl2'; canvas2.setAttribute('aria-label', 'Three-dimensional view of a planet surface'); canvas.after(canvas2);
const makeRenderer = (cv, logDepth) => {
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, logarithmicDepthBuffer: logDepth, preserveDrawingBuffer: Q.has('shot'), powerPreference: 'high-performance' });
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true; r.shadowMap.type = GFX.t.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  return r;
};
const renderer = makeRenderer(canvas, true);
let pixelRatio = Math.min(devicePixelRatio, GFX.t.prMax);
renderer.setPixelRatio(pixelRatio);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.02, 3e6);
scene.add(camera);
// anti-aliasing comes from a multisampled render target (the canvas's own MSAA is bypassed by post-processing)
function makePipeline(r, sc, cam) {
  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: GFX.t.samples });
  const composer = new EffectComposer(r, rt);
  const pass = new RenderPass(sc, cam); composer.addPass(pass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.35, 1.8); bloom.enabled = GFX.t.bloom; composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { r, composer, pass, bloom };
}
const space = makePipeline(renderer, scene, camera);
let ground = null; // the surface pipeline, made on first landing
const composer = space.composer, renderPass = space.pass;

const SUN = new THREE.Vector3(0, 0, 0);

// ---------- the star: it stands for you ----------
function glowTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const starTime = { value: 0 }, starGain = { value: 1 };
const STAR_R = 2500;
const starGroup = new THREE.Group(); scene.add(starGroup);
const starMesh = new THREE.Mesh(new THREE.SphereGeometry(STAR_R, 128, 96), new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: STAR_FRAG, uniforms: { uTime: starTime, uGain: starGain } }));
starGroup.add(starMesh);
scene.add(new THREE.Mesh(new THREE.SphereGeometry(STAR_R * 3.0, 64, 48), new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: CORONA_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: starTime, uGain: starGain, uCenter: { value: new THREE.Vector3() }, uR: { value: STAR_R }, uRs: { value: STAR_R * 3.0 } } })));
// prominences: loops of hot gas anchored in the surface, turning with it
{
  const rnd = (() => { let s = 4242; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let k = 0; k < 14; k++) {
    const d = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 0.9, rnd() - 0.5).normalize();
    const t = new THREE.Vector3().crossVectors(d, new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5)).normalize();
    const w = 0.04 + rnd() * 0.08, H = STAR_R * (0.08 + rnd() * 0.22), twist = (rnd() - 0.5) * 0.4;
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; const dir = d.clone().addScaledVector(t, (u - 0.5) * 2 * w).normalize(); const side = new THREE.Vector3().crossVectors(dir, t).multiplyScalar(Math.sin(u * Math.PI) * twist * STAR_R * 0.05); pts.push(dir.multiplyScalar(STAR_R * 0.995 + Math.sin(u * Math.PI) * H).add(side)); }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, STAR_R * (0.008 + rnd() * 0.012), 10, false);
    starGroup.add(new THREE.Mesh(tube, new THREE.ShaderMaterial({ vertexShader: PROM_VERT, fragmentShader: PROM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: starTime, uGain: starGain, uSeed: { value: k * 3.7 } } })));
  }
}
const starGlow = [];
for (const [size, op, stops] of [
  [26000, 0.28, [[0, 'rgba(255,250,240,1)'], [0.25, 'rgba(255,235,205,0.55)'], [1, 'rgba(255,220,180,0)']]],
  [140000, 0.14, [[0, 'rgba(255,240,220,0.6)'], [0.2, 'rgba(255,220,180,0.12)'], [1, 'rgba(255,200,150,0)']]]]) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(stops), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
  s.scale.set(size, size, 1); scene.add(s); starGlow.push([s, op]);
}
// close to the star the eye adapts: the surface is dimmed so its detail shows, and the glare fades
function adaptToStar(camPos) {
  const d = camPos.length(), ang = STAR_R / Math.max(d, STAR_R);
  starGain.value = THREE.MathUtils.clamp(0.07 / ang, 0.5, 1);
  for (const [s, op] of starGlow) s.material.opacity = op * THREE.MathUtils.clamp((d - 7000) / 25000, 0.12, 1);
}

// ---------- background stars and the galactic band ----------
const sky = new THREE.Group(); scene.add(sky);
{
  const temps = [[1.0, 0.71, 0.42], [1.0, 0.85, 0.69], [1.0, 0.96, 0.91], [0.87, 0.90, 1.0], [0.71, 0.78, 1.0]];
  const mk = (n, size, band) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); const v = new THREE.Vector3();
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, 0.3, 0.4));
    for (let i = 0; i < n; i++) {
      if (band) { const a = Math.random() * Math.PI * 2; const y = (Math.random() + Math.random() + Math.random() - 1.5) * 0.12; v.set(Math.cos(a), y, Math.sin(a)).normalize().applyQuaternion(tilt); }
      else v.randomDirection();
      v.multiplyScalar(1.5e6); pos.set([v.x, v.y, v.z], i * 3);
      const t = temps[Math.floor(Math.random() ** 1.3 * 5)]; const b = band ? 0.06 + Math.random() * 0.18 : 0.12 + Math.random() ** 6 * 1.4;
      col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
  };
  sky.add(mk(7000, 1.5, false), mk(500, 2.4, false), mk(22000, 1.1, true));
}

// ---------- planet maps: each surface is rendered once into cube maps, then only sampled ----------
function bakeTargets(size, clouds) {
  if (Q.has('bake')) size = Math.min(size, +Q.get('bake')); // test override: small maps bake fast in software rendering
  const mk = (s) => new THREE.WebGLCubeRenderTarget(s, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  return { A: mk(size), B: mk(size), E: mk(Math.max(64, size / 2)), C: clouds ? mk(Math.min(GFX.t.cloudCube, size)) : null, size };
}
const blankCube = new THREE.WebGLCubeRenderTarget(4);
function planetMaterial(maps, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, defines: GFX.t.detail ? { DETAIL: 1 } : {},
    uniforms: { ...uniforms, uA: { value: maps.A.texture }, uB: { value: maps.B.texture }, uE: { value: maps.E.texture }, uC: { value: (maps.C || blankCube).texture }, uNM: { value: new THREE.Matrix3() } },
  });
}
// the bake: a box seen from its centre by a cube camera; one face per frame so the page stays responsive
const bakeMat = new THREE.ShaderMaterial({ vertexShader: BAKE_VERT, fragmentShader: BAKE_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false,
  uniforms: { uType: { value: 0 }, uSeed: { value: 0 }, uBump: { value: 0 }, uOut: { value: 0 }, uTexel: { value: 0.002 }, uCScale: { value: 1 }, uCSeed: { value: 0 }, uSun: { value: SUN }, uR: { value: 1 }, uAtmo: { value: new THREE.Color() }, uAtmoK: { value: 0 }, uTime: { value: 0 }, uNear: { value: 0 }, uCloud: { value: new THREE.Vector3() } } });
const bakeScene = new THREE.Scene(); bakeScene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), bakeMat));
const bakeCam = new THREE.CubeCamera(0.1, 10, blankCube); bakeScene.add(bakeCam);
async function bakeAll(list, onProgress) {
  bakeCam.coordinateSystem = renderer.coordinateSystem; bakeCam.updateCoordinateSystem(); bakeCam.updateMatrixWorld(true);
  const jobs = [];
  for (const b of list) for (const [k, out] of [['A', 0], ['B', 1], ['E', 2], ['C', 3]]) if (b.maps[k] && !(Q.get('bakeskip') || '').includes(k)) jobs.push([b, b.maps[k], out, k]);
  const total = jobs.length * 6; let done = 0;
  const prevTM = renderer.toneMapping; const prevRT = renderer.getRenderTarget();
  for (const [b, rt, out, name] of jobs) {
    const u = bakeMat.uniforms; u.uType.value = b.bake.type; u.uSeed.value = b.bake.seed; u.uBump.value = b.bake.bump; u.uOut.value = out; u.uTexel.value = 2 / rt.width;
    if (b.bake.cloud) { u.uCScale.value = b.bake.cloud[0]; u.uCSeed.value = b.bake.cloud[1]; }
    for (let f = 0; f < 6; f++) {
      renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(rt, f); renderer.render(bakeScene, bakeCam.children[f]);
      renderer.setRenderTarget(prevRT); renderer.toneMapping = prevTM;
      onProgress(++done / total, `${b.bake.type}${name}${f}`);
      if (done % 2 === 0 && !Q.has('shot')) await new Promise((r) => requestAnimationFrame(() => r())); // headless test runs give few frames: bake at once there
    }
  }
}

// ---------- planets: each on its own tilted orbit round the star ----------
// orbit: radius; inc: inclination of the orbit to the reference plane; node: where it crosses it; period: one year (s);
// day: sunrise to sunrise on the surface (s), from which the spin (rad/s) follows; tilt: the axial tilt
const BODIES = [
  { key: 'technova', name: 'Technova', num: 'I', what: 'Engineering', type: 0, R: 650, scale: [1.16, 0.93, 0.95], g: 0.62, moon: true, orbit: 40000, inc: 0.07, node: 0.4, period: 3600, ang: 1.25, tilt: 0.12, atmo: [0.50, 0.56, 0.68], atmoK: 0.25, rs: 1.03, bump: 0.035, clouds: { cov: 0.68, scale: 2.0 }, seed: 2.1, day: 1200, shine: [0.18, 0.16, 0.15] },
  { key: 'ekatva', name: 'Ekatva', num: 'II', what: 'Culture', type: 1, R: 1350, scale: [1, 0.95, 1], g: 1.08, orbit: 60000, inc: -0.13, node: 2.1, period: 4800, ang: 1.45, tilt: 0.36, atmo: [0.80, 0.56, 0.36], atmoK: 0.45, rs: 1.08, bump: 0.02, clouds: { cov: 0.55, scale: 3.4 }, seed: 5.3, day: 1800, shine: [0.4, 0.26, 0.14] },
  { key: 'arena', name: 'The Arena', num: 'III', what: 'Sport', type: 2, R: 1000, scale: [1.05, 0.86, 1.05], g: 0.94, orbit: 80000, inc: 0.2, node: 4.0, period: 6000, ang: 1.78, tilt: 0.18, atmo: [0.95, 0.80, 0.58], atmoK: 0.35, rs: 1.06, bump: 0.02, clouds: { cov: 0.60, scale: 6.0 }, seed: 8.7, day: 2400, aurora: true, shine: [0.22, 0.4, 0.14] },
  { key: 'cosmos', name: 'Cosmos', num: 'IV', what: 'Astronomy', type: 3, R: 460, scale: [1, 1, 1], g: 0.24, ring: [1.55, 2.7], orbit: 100000, inc: -0.3, node: 5.4, period: 7200, ang: 1.2, tilt: 0.5, atmo: [0.55, 0.70, 0.95], atmoK: 0.22, rs: 1.025, bump: 0.04, clouds: null, seed: 11.9, day: 1500, shine: [0.5, 0.55, 0.62] },
];
const clock = { value: 0 };
const orbitPoint = (b, a, out = new THREE.Vector3()) => out.set(Math.cos(a) * b.orbit, 0, Math.sin(a) * b.orbit).applyAxisAngle(new THREE.Vector3(Math.cos(b.node), 0, Math.sin(b.node)), b.inc);
const orbitLines = new THREE.Group(); scene.add(orbitLines);
for (const b of BODIES) {
  b.spin = 2 * Math.PI / b.day - 2 * Math.PI / b.period; // the spin runs against the orbit, so the solar day is set by both
  b.pos = orbitPoint(b, b.ang);
  const grp = new THREE.Group(); grp.position.copy(b.pos); grp.rotation.z = b.tilt; grp.scale.set(...b.scale); scene.add(grp); b.group = grp;
  b.Rmax = b.R * Math.max(...b.scale);
  const common = { uSun: { value: SUN }, uTime: clock };
  b.near = { value: 0 };
  b.maps = bakeTargets(GFX.t.planetCube, !!b.clouds);
  b.bake = { type: b.type, seed: b.seed, bump: b.bump, cloud: b.clouds ? [b.clouds.scale, b.seed + 3] : null };
  const [sw, sh] = GFX.t.planetSeg;
  const surf = new THREE.Mesh(new THREE.SphereGeometry(b.R, sw, sh), planetMaterial(b.maps, { ...common, uSeed: { value: b.seed }, uAtmo: { value: new THREE.Color(...b.atmo) }, uAtmoK: { value: b.atmoK }, uNear: b.near,
    uCloud: { value: new THREE.Vector3(b.clouds ? b.clouds.cov : -1, b.clouds ? b.clouds.scale : 1, b.seed + 3) } }));
  grp.add(surf); b.surf = surf;
  if (b.clouds) grp.add(new THREE.Mesh(new THREE.SphereGeometry(b.R * 1.012, Math.round(sw * 0.66), Math.round(sh * 0.7)), new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false,
    uniforms: { ...common, uCov: { value: b.clouds.cov }, uC: { value: b.maps.C.texture } },
  })));
  if (b.aurora) grp.add(new THREE.Mesh(new THREE.SphereGeometry(b.R * 1.035, 128, 90), new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: AURORA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...common, uCenter: { value: b.pos } },
  })));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(b.R * b.rs, 96, 64), new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: ATMO_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSun: { value: SUN }, uCenter: { value: b.pos }, uAtmo: { value: new THREE.Color(...b.atmo) }, uR: { value: b.R }, uRs: { value: b.R * b.rs }, uK: { value: b.atmoK * 2.0 }, uInvM: { value: new THREE.Matrix4() } },
  }));
  atmo.rotation.z = b.tilt; atmo.scale.set(...b.scale); scene.add(atmo); b.atmo = atmo;
  if (b.ring) { // the ring lies in the planet's equator
    const rg = new THREE.Mesh(new THREE.RingGeometry(b.R * b.ring[0], b.R * b.ring[1], 256, 4), new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uSun: { value: SUN }, uCenter: { value: b.pos }, uR: { value: b.R }, uIn: { value: b.R * b.ring[0] }, uOut: { value: b.R * b.ring[1] }, uN: { value: new THREE.Vector3() } } }));
    rg.rotation.set(Math.PI / 2, 0, b.tilt, 'ZYX'); scene.add(rg); b.ringMesh = rg; rg.material.uniforms.uN.value.set(0, 0, 1).applyQuaternion(rg.quaternion);
  }
  if (b.moon) {
    const mg = new THREE.Group(); scene.add(mg); b.moonGroup = mg; mg.rotation.z = 0.25;
    const moon = { maps: bakeTargets(256, false), bake: { type: 4, seed: 17.3, bump: 0.05, cloud: null } };
    const m = new THREE.Mesh(new THREE.SphereGeometry(95, 64, 48), planetMaterial(moon.maps, { uSun: { value: SUN }, uTime: clock, uSeed: { value: 17.3 }, uAtmo: { value: new THREE.Color(0, 0, 0) }, uAtmoK: { value: 0 }, uNear: { value: 0 }, uCloud: { value: new THREE.Vector3(-1, 1, 0) } }));
    m.scale.set(1.35, 0.85, 0.9); m.position.set(b.R * 4.2, 0, 0); mg.add(m); moon.surf = m; b.moon = moon;
  }
  // the path of the orbit, faint
  const pts = []; for (let i = 0; i <= 512; i++) pts.push(orbitPoint(b, (i / 512) * Math.PI * 2));
  orbitLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xe8e6e1, transparent: true, opacity: 0.07, depthWrite: false })));
}
orbitLines.visible = !Q.has('shot') || Q.has('orbits');
// move every planet along its orbit; returns how far each moved this step (to carry a vessel along)
function updateOrbits(dt) {
  for (const b of BODIES) {
    const prev = b.pos.clone();
    b.ang += (2 * Math.PI / b.period) * dt;
    orbitPoint(b, b.ang, b.pos);
    b.delta = b.pos.clone().sub(prev);
    b.group.position.copy(b.pos); b.group.rotation.y += b.spin * dt;
    b.atmo.position.copy(b.pos); b.atmo.updateMatrixWorld(true); b.atmo.material.uniforms.uInvM.value.copy(b.atmo.matrixWorld).invert();
    if (b.ringMesh) b.ringMesh.position.copy(b.pos);
    if (b.moonGroup) { b.moonGroup.position.copy(b.pos); b.moonGroup.rotation.y += dt * 0.03; b.moonGroup.updateMatrixWorld(true); b.moon.surf.material.uniforms.uNM.value.getNormalMatrix(b.moon.surf.matrixWorld); }
    b.group.updateMatrixWorld(true); b.surf.material.uniforms.uNM.value.getNormalMatrix(b.surf.matrixWorld);
  }
}
updateOrbits(0);

// ---------- Mission Control ----------
const STATION = { key: 'station', name: 'Mission Control', num: '', what: 'Base', R: 40, pos: new THREE.Vector3(5000, 18000, 125000) };
STATION.group = buildStation();
STATION.group.position.copy(STATION.pos);
scene.add(STATION.group);
const STAR = { key: 'star', name: 'The Star', num: '', what: 'You', R: STAR_R, Rmax: STAR_R, pos: new THREE.Vector3(), star: true };
const TARGETS = [...BODIES, STATION, STAR];

// ---------- light ----------
const sunLight = new THREE.DirectionalLight(0xfff2e2, 2.1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.02;
scene.add(sunLight, sunLight.target);
const planetLight = new THREE.DirectionalLight(0xffffff, 0); scene.add(planetLight, planetLight.target);
scene.add(new THREE.AmbientLight(0x3a4050, 0.12));
// a simple space environment for reflections: black, with a bright sun in the right direction
const pmrem = new THREE.PMREMGenerator(renderer);
let envDir = new THREE.Vector3(0, 0, 0);
function updateEnvironment(toSun) {
  if (envDir.angleTo(toSun) < 0.15 && scene.environment) return;
  envDir.copy(toSun);
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.MeshBasicMaterial({ color: 0x050608, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(10, 9, 7.5) })); sun.position.copy(toSun).multiplyScalar(60); s.add(sun);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.5, 0.4) })); halo.position.copy(toSun).multiplyScalar(80); s.add(halo);
  const old = scene.environment; scene.environment = pmrem.fromScene(s, 0.02).texture; if (old) old.dispose();
}

// ---------- flight state ----------
const flight = { mode: 'docked', target: null, pending: null, t: 0, T: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), alignT: 0, q0: new THREE.Quaternion(), q1: new THREE.Quaternion(), warp: 0, orbitAxis: new THREE.Vector3(), orbitR: 0, view: Q.has('shot') ? 'chase' : 'inspect', progress: 0, aref: 100 };
const BERTH = { pos: STATION.pos.clone().add(STATION.group.userData.ports[0].pos), dir: STATION.group.userData.ports[0].dir.clone() };
const CORRIDOR = 60; // final approach starts this far out along the docking axis
const WORLD_UP = new THREE.Vector3(0, 1, 0);
// measured thrust, which drives the engine and thruster glow
const thrust = { reset: true, prevPos: new THREE.Vector3(), prevVel: new THREE.Vector3(), prevQuat: new THREE.Quaternion(), acc: new THREE.Vector3(), omega: new THREE.Vector3(), main: 0, torque: new THREE.Vector3(), force: new THREE.Vector3() };

// ---------- the vessel ----------
const ship = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), speed: 0, throttle: 0, level: 1, design: +(Q.get('design') || 0), mesh: null };
const dockPose = () => {
  const pos = BERTH.pos.clone().addScaledVector(BERTH.dir, DESIGNS[ship.design].dock);
  return { pos, quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, BERTH.pos, WORLD_UP)) };
};
function park() { const p = dockPose(); ship.pos.copy(p.pos); ship.quat.copy(p.quat); ship.speed = 0; ship.throttle = 0; flight.mode = 'docked'; thrust.reset = true; }
function setDesign(i) {
  if (ship.mesh) scene.remove(ship.mesh);
  ship.design = i; ship.mesh = DESIGNS[i].build(); scene.add(ship.mesh);
  document.querySelectorAll('#designs button').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.design === i)));
  if (flight.mode === 'docked') park();
}
setDesign(ship.design);
park();

// Speed levels: manual top speed (units/s) and journey time for a full crossing (s)
const LEVELS = [
  { name: 'Manoeuvre', max: 40, T: null },
  { name: 'Cruise', max: 3000, T: 30 },
  { name: 'Fast', max: 11000, T: 9 },
  { name: 'Warp', max: 70000, T: 1.6 },
];
function setLevel(i) {
  ship.level = i;
  document.querySelectorAll('.levels button').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.level === i)));
  if (flight.mode === 'travel') beginTravel(flight.target, true);
}

const fwd = (q = ship.quat) => new THREE.Vector3(0, 0, -1).applyQuaternion(q);
const up = (q = ship.quat) => new THREE.Vector3(0, 1, 0).applyQuaternion(q);
const journeyTime = (dist) => { const L = LEVELS[Math.max(ship.level, 1)]; return ship.level === 3 ? L.T : L.T * Math.sqrt(THREE.MathUtils.clamp(dist / 65000, 0.15, 2.0)); };
const stopDist = (b) => (b.key === 'station' ? CORRIDOR : b.star ? b.R * 3.4 : b.Rmax * 3.2);
const corridorPoint = () => BERTH.pos.clone().addScaledVector(BERTH.dir, CORRIDOR);
const DOCKING = ['docked', 'undock', 'dockAlign', 'dockApproach'];

function setCourse(b) {
  if (flight.mode === 'docked' || flight.mode === 'undock') { if (b.key === 'station') return; flight.pending = b; if (flight.mode === 'docked') startUndock(); markSel(b); return; }
  if (ship.level === 0) setLevel(1); // a journey always runs at Cruise or faster
  flight.target = b; beginTravel(b, false); markSel(b);
}
const markSel = (b) => document.querySelectorAll('.mk').forEach((m) => m.classList.toggle('sel', !!b && m.dataset.key === b.key));
function beginTravel(b, keepHeading) {
  flight.from.copy(ship.pos);
  if (b.key === 'station') flight.to.copy(corridorPoint());
  else { const dir = b.pos.clone().sub(ship.pos).normalize(); flight.to.copy(b.pos).addScaledVector(dir, -stopDist(b)); }
  flight.toRel = b.key === 'station' ? null : flight.to.clone().sub(b.pos);
  const D = flight.from.distanceTo(flight.to);
  flight.T = b.key === 'station' && D < 2000 ? 8 + D / 120 : journeyTime(D);
  flight.aref = Math.max(5, 6 * D / (flight.T * flight.T));
  flight.t = 0;
  flight.q0.copy(ship.quat);
  flight.q1.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, flight.to.distanceTo(ship.pos) > 1 ? flight.to : b.pos, up()));
  flight.alignT = ship.level === 3 ? 0.8 : 1.6;
  flight.mode = keepHeading ? 'travel' : 'align';
}
function startUndock() { flight.mode = 'undock'; flight.t = 0; flight.from.copy(ship.pos); flight.q0.copy(ship.quat); flight.target = null; }
function startDock() {
  flight.mode = 'dockAlign'; flight.t = 0; flight.from.copy(ship.pos); flight.q0.copy(ship.quat);
  flight.q1.setFromRotationMatrix(new THREE.Matrix4().lookAt(corridorPoint(), BERTH.pos, WORLD_UP));
}
function cancelCourse() {
  if (flight.mode === 'align' || flight.mode === 'travel') { flight.mode = 'manual'; ship.throttle = Math.min(1, ship.speed / LEVELS[ship.level].max); }
  if (flight.mode === 'orbit' || flight.mode === 'dockAlign' || flight.mode === 'dockApproach') { flight.mode = 'manual'; ship.speed = 0; ship.throttle = 0; }
  if (flight.mode === 'undock') return;
  flight.target = null; flight.pending = null; markSel(null);
}
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);

// ---------- input ----------
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyP' && !e.repeat) GFX.cycle();
  if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
  if (WORLD.mode === 'surface') {
    const s = WORLD.surface;
    if (e.code === 'KeyE' && !e.repeat) {
      if (s.st.phase === 'pilot') { if (!s.stepOut()) s.st.lander.msg = 'Land first: hold Shift to settle', s.st.lander.msgT = 2.5; }
      else if (s.st.phase === 'walk') { if (s.st.nearRover) s.drive(); else s.board(); }
      else if (s.st.phase === 'drive' && !s.drive()) { s.st.lander.msg = 'Slow down to get out'; s.st.lander.msgT = 2; }
    }
    if (e.code === 'KeyF' && !e.repeat) summonRover();
    if (e.code === 'KeyT') recallToLander(true);
    if (e.code === 'KeyB') recallToLander(false);
    if (e.code === 'KeyN') cycleSound(); if (e.code === 'KeyL') cycleLuna(); if (e.code === 'KeyM') { WORLD.labels = !WORLD.labels; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') e.preventDefault();
    return;
  }
  if (WORLD.mode === 'interior') { if ((e.code === 'KeyE' && WORLD.interior.st.near && WORLD.interior.st.near.hatch) || e.code === 'KeyI' || e.code === 'Escape') leaveInterior(); if (e.code === 'KeyN') cycleSound(); if (e.code === 'KeyL') cycleLuna(); return; }
  if (e.code === 'KeyG') { if (flight.mode === 'orbit') startLanding(); else if (flight.mode === 'manual' && ship.pos.distanceTo(STATION.pos) < 3000) setCourse(STATION); }
  if (e.code === 'KeyI' && flight.mode === 'docked') enterInterior();
  if (e.code === 'KeyC') toggleView();
  if (e.code === 'KeyV') toggleInspect();
  if (e.code === 'KeyH') setCourse(STATION);
  if (e.code === 'KeyU' && flight.mode === 'docked') startUndock();
  if (e.code === 'Tab' && flight.view === 'inspect') { e.preventDefault(); cycleSubject(e.shiftKey ? -1 : 1); }
  if (e.code === 'KeyN') cycleSound();
  if (e.code === 'KeyL') cycleLuna();
  if (e.code === 'KeyO') orbitLines.visible = !orbitLines.visible;
  if (e.code === 'Escape') cancelCourse();
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) setLevel(+e.code.slice(5) - 1);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const drag = { on: false, x: 0, y: 0, dx: 0, dy: 0, lx: 0, ly: 0 };
// two fingers: pinch to zoom (surface camera, inspect)
const pinch = { ptrs: new Map(), d: 1 };
const pinchDist = () => { const [a, b] = [...pinch.ptrs.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
function zoomBy(k) {
  if (WORLD.mode === 'surface') { const st = WORLD.surface.st; st.camDist = THREE.MathUtils.clamp(st.camDist * k, 2.5, 80); }
  else if (flight.view === 'inspect') insp.zoom = THREE.MathUtils.clamp(insp.zoom * k, 0.35, 4);
}
for (const cv of [canvas, canvas2]) {
cv.addEventListener('pointerdown', (e) => { pinch.ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (pinch.ptrs.size === 2) { pinch.d = pinchDist(); drag.on = false; return; } drag.on = true; drag.x = drag.lx = e.clientX; drag.y = drag.ly = e.clientY; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (pinch.ptrs.has(e.pointerId)) pinch.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch.ptrs.size === 2) { const d = pinchDist(), k = pinch.d / Math.max(d, 1); pinch.d = d; zoomBy(k); return; }
  if (!drag.on) return;
  if (WORLD.mode === 'surface') { const st = WORLD.surface.st; if (st.phase === 'pilot') st.camOff -= (e.clientX - drag.lx) * 0.006; else st.camYaw -= (e.clientX - drag.lx) * 0.006; st.camPitch = THREE.MathUtils.clamp(st.camPitch + (e.clientY - drag.ly) * 0.005, -0.3, 1.3); drag.lx = e.clientX; drag.ly = e.clientY; return; }
  if (WORLD.mode === 'interior') { const st = WORLD.interior.st; st.yaw -= (e.clientX - drag.lx) * 0.005; st.pitch = THREE.MathUtils.clamp(st.pitch - (e.clientY - drag.ly) * 0.004, -1.2, 1.2); drag.lx = e.clientX; drag.ly = e.clientY; return; }
  if (flight.view === 'inspect') { insp.yaw -= (e.clientX - drag.lx) * 0.006; insp.pitch = THREE.MathUtils.clamp(insp.pitch + (e.clientY - drag.ly) * 0.005, -1.4, 1.4); insp.auto = false; drag.lx = e.clientX; drag.ly = e.clientY; return; }
  drag.dx = THREE.MathUtils.clamp((e.clientX - drag.x) / 160, -1, 1); drag.dy = THREE.MathUtils.clamp((e.clientY - drag.y) / 160, -1, 1);
});
cv.addEventListener('wheel', (e) => { if (WORLD.mode === 'surface') { e.preventDefault(); const st = WORLD.surface.st; st.camDist = THREE.MathUtils.clamp(st.camDist * Math.exp(e.deltaY * 0.0012), 2.5, 80); return; } if (flight.view !== 'inspect') return; e.preventDefault(); insp.zoom = THREE.MathUtils.clamp(insp.zoom * Math.exp(e.deltaY * 0.0012), 0.35, 4); }, { passive: false });
const lift = (e) => { pinch.ptrs.delete(e.pointerId); endDrag(); };
cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
}
function endDrag() { drag.on = false; drag.dx = drag.dy = 0; }
const tap = (id, fn) => { const el = document.getElementById(id); el.addEventListener('click', (e) => { fn(e); el.blur(); }); };
tap('t-plus', () => { leaveAuto(); ship.throttle = Math.min(1, ship.throttle + 0.2); });
tap('t-minus', () => { ship.throttle = Math.max(0, ship.throttle - 0.2); });
document.querySelectorAll('.levels button').forEach((b) => b.addEventListener('click', () => { setLevel(+b.dataset.level); b.blur(); }));
document.querySelectorAll('#designs button').forEach((b) => (b.onclick = () => setDesign(+b.dataset.design)));
tap('btn-land', () => startLanding()); tap('btn-inside', () => enterInterior()); tap('btn-dock', () => setCourse(STATION));
tap('btn-view', toggleView); tap('btn-inspect', toggleInspect); tap('btn-undock', () => { if (flight.mode === 'docked') startUndock(); }); tap('btn-home', () => setCourse(STATION)); tap('btn-sound', cycleSound);
function leaveAuto() { if (flight.mode === 'docked') startUndock(); else if (flight.mode === 'orbit') { flight.mode = 'manual'; flight.target = null; } }
function toggleInspect() {
  flight.view = flight.view === 'inspect' ? 'chase' : 'inspect';
  document.body.classList.remove('cockpit'); document.getElementById('btn-view').textContent = 'Cockpit · C';
  if (flight.view === 'inspect') { const near = nearestBody(); setSubject(flight.target && flight.target.key !== 'station' ? flight.target.key : near && ship.pos.distanceTo(near.pos) < near.R * 8 ? near.key : 'vessel'); }
  document.body.classList.toggle('inspecting', flight.view === 'inspect' && document.getElementById('mc').hidden);
}
// ---------- inspect: orbit any subject with drag, zoom with the wheel ----------
const SUBJECTS = ['vessel', 'technova', 'ekatva', 'arena', 'cosmos', 'star', 'station'];
const INFO = {
  vessel: () => [DESIGNS[ship.design].name, 'Your vessel. Drag to turn it, scroll to zoom.'],
  star: () => ['The Star · you', 'The centre of the system, and it stands for you: everything else turns round it. A yellow-white star with boiling granules, dark spots, loops of glowing gas at the edge and a streaming corona. Orbit it to read about you. Too hot to land.'],
  technova: () => ['Technova · I', 'Gravity 0.62 g. Sunrise to sunrise takes 20 minutes, a year an hour. Its orbit is tilted 4°. Oval: stretched by its moon. Engineering, software and projects. Basalt plateaus, iron flats, ore veins and terraced canyons under thin air and hard light.'],
  ekatva: () => ['Ekatva · II', 'Gravity 1.08 g. Sunrise to sunrise takes 30 minutes, a year 80. Orbit tilted 7° the other way. The largest world. History, heritage, forts, books, cinema, music, philosophy and mythology. Russet forest, gold grass, a sandstone belt and silt seas under amber air.'],
  arena: () => ['The Arena · III', 'Gravity 0.94 g. Sunrise to sunrise takes 40 minutes, with long golden evenings, a year 100. Orbit tilted 11°. Flattened at the poles. Cricket and sport. Grassland, flower plains, salt flats and mineral lakes. Floodlit grounds and auroras on the night side.'],
  cosmos: () => ['Cosmos · IV', 'Gravity 0.24 g. Sunrise to sunrise takes 25 minutes, a year two hours. The steepest orbit, tilted 17°. The smallest world, with an ice ring. Astronomy and space science. Ice plains, fractures, crater basins and bare rock under thin, clear air.'],
  station: () => ['Mission Control', 'The base. A habitat wheel, three large ports and the vessel’s berth, solar arrays and radiators.'],
};
const insp = { subject: 'vessel', yaw: 0.7, pitch: 0.25, zoom: 1, auto: true };
function setSubject(key) {
  insp.subject = key; insp.zoom = 1; insp.auto = true; insp.pitch = 0.22;
  const b = key === 'station' ? STATION : key === 'star' ? STAR : BODIES.find((x) => x.key === key);
  if (b) { const s = SUN.clone().sub(b.pos).normalize(); insp.yaw = Math.atan2(s.x, s.z) + 0.75; }
  document.querySelectorAll('#inspect [data-subject]').forEach((el) => el.setAttribute('aria-checked', String(el.dataset.subject === key)));
  const [t, d] = INFO[key](); document.getElementById('insp-title').textContent = t; document.getElementById('insp-text').textContent = d;
}
function cycleSubject(k) { setSubject(SUBJECTS[(SUBJECTS.indexOf(insp.subject) + k + SUBJECTS.length) % SUBJECTS.length]); }
document.querySelectorAll('#inspect [data-subject]').forEach((el) => el.addEventListener('click', () => { setSubject(el.dataset.subject); el.blur(); }));
tap('insp-close', toggleInspect);
function nearestBody() { let best = null, bd = Infinity; for (const b of BODIES) { const d = ship.pos.distanceTo(b.pos) / b.Rmax; if (d < bd) { bd = d; best = b; } } return best; }
function toggleView() {
  flight.view = flight.view === 'cockpit' ? 'chase' : 'cockpit';
  document.body.classList.toggle('cockpit', flight.view === 'cockpit');
  document.getElementById('btn-view').textContent = flight.view === 'cockpit' ? 'Chase view · C' : 'Cockpit · C';
}

// ---------- markers (kept clear of the controls) ----------
const markerBox = document.getElementById('markers');
for (const b of TARGETS) {
  const el = document.createElement('button'); el.className = 'mk'; el.type = 'button'; el.dataset.key = b.key; el.style.setProperty('--c', '#E8E6E1');
  el.innerHTML = `<span class="br"></span><span class="lb"><span class="n">${b.name}${b.num ? ' · ' + b.num : ''}</span><span class="d"></span></span>`;
  el.setAttribute('aria-label', `Set course for ${b.name}`);
  el.addEventListener('click', () => { if (!document.getElementById('mc').hidden) { boardIfNeeded(); flight.view = 'chase'; camInit = false; } setCourse(b); el.blur(); });
  markerBox.appendChild(el); b.marker = el;
}
const fmtKm = (u) => { const k = u * KM; return k > 1e6 ? (k / 1e6).toFixed(2) + ' M km' : Math.round(k).toLocaleString('en-GB') + ' km'; };
const fmtT = (s) => (s < 60 ? Math.max(1, Math.round(s)) + ' s' : Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'));
const v3 = new THREE.Vector3();
function updateMarkers() {
  const w = innerWidth, h = innerHeight;
  const top = 120, bottom = h - (flight.view === 'cockpit' ? 200 : 190);
  for (const b of TARGETS) {
    const el = b.marker; v3.copy(b.pos).project(camera);
    const dist = camera.position.distanceTo(b.pos);
    const ahead = v3.z < 1 && v3.z > -1;
    const pxR = (b.R / dist) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (h / 2);
    if (b.near) b.near.value = pxR > 260 ? 1 : 0;
    if (flight.view === 'inspect') { el.style.display = 'none'; continue; }
    const sel = flight.target === b;
    let x = (v3.x * 0.5 + 0.5) * w, y = (-v3.y * 0.5 + 0.5) * h;
    const tooClose = pxR > h * 0.22 || (b.key === 'station' && dist < 400);
    const inHud = y < top || y > bottom || x < 20 || x > w - 280;
    if (!ahead || tooClose || (inHud && !sel)) { el.style.display = 'none'; continue; }
    if (sel) { x = THREE.MathUtils.clamp(x, 40, w - 300); y = THREE.MathUtils.clamp(y, top + 20, bottom - 20); }
    const half = Math.max(12, Math.min(pxR * 1.25, 120));
    el.style.display = 'block'; el.style.transform = `translate(${(x - half).toFixed(1)}px, ${(y - half).toFixed(1)}px)`; el.style.width = el.style.height = half * 2 + 'px';
    const range = Math.max(0, ship.pos.distanceTo(b.pos) - stopDist(b));
    el.querySelector('.d').textContent = sel && flight.mode === 'travel' ? `${fmtKm(range)} · arriving ${fmtT(flight.T - flight.t)}`
      : sel && flight.mode === 'orbit' ? 'In orbit' : `${fmtKm(range)} · ${b.what} · ≈ ${fmtT(journeyTime(range))}`;
  }
}

// ---------- warp streaks and space dust ----------
const STREAKS = 600;
const streakPos = new Float32Array(STREAKS * 6), streakSeed = [];
for (let i = 0; i < STREAKS; i++) { const a = Math.random() * Math.PI * 2, r = 10 + Math.random() ** 0.6 * 160; streakSeed.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: -Math.random() * 600 }); }
const streakGeo = new THREE.BufferGeometry(); streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
const streakMat = new THREE.LineBasicMaterial({ color: 0xfff1e0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const streaks = new THREE.LineSegments(streakGeo, streakMat); streaks.frustumCulled = false; camera.add(streaks);
function updateStreaks(dt, speed, warp) {
  const dustLen = Math.min(speed * 0.004, 30) + warp * 120;
  const flow = speed * 0.02 + warp * 2400 + 4;
  for (let i = 0; i < STREAKS; i++) {
    const s = streakSeed[i]; s.z += flow * dt; if (s.z > 0) s.z -= 600;
    streakPos[i * 6] = streakPos[i * 6 + 3] = s.x; streakPos[i * 6 + 1] = streakPos[i * 6 + 4] = s.y;
    streakPos[i * 6 + 2] = s.z; streakPos[i * 6 + 5] = s.z - Math.max(0.05, dustLen);
  }
  streakGeo.attributes.position.needsUpdate = true;
  streakMat.opacity = Math.min(0.32, 0.03 + Math.min(speed / 12000, 1) * 0.16 + warp * 0.26);
}

// ---------- Luna ----------
const lunaCv = document.getElementById('luna-cv'), lctx = lunaCv.getContext('2d');
const LN = 96; const lunaAlb = new Float32Array(LN * LN);
{
  const craters = Array.from({ length: 42 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, r: 0.04 + Math.random() ** 3 * 0.25 }));
  for (let j = 0; j < LN; j++) for (let i = 0; i < LN; i++) {
    const x = (i + 0.5) / LN * 2 - 1, y = (j + 0.5) / LN * 2 - 1; let a = 0.72 + 0.08 * Math.sin(x * 9 + y * 4) * Math.cos(y * 7 - x * 3);
    if ((x + 0.25) ** 2 + (y - 0.15) ** 2 < 0.18 || (x - 0.35) ** 2 + (y + 0.3) ** 2 < 0.06) a *= 0.62;
    for (const c of craters) { const d = Math.hypot(x - c.x, y - c.y) / c.r; if (d < 1) a *= 0.82 + 0.18 * d; else if (d < 1.25) a *= 1.1; }
    lunaAlb[j * LN + i] = a;
  }
}
const lunaImg = lctx.createImageData(LN, LN);
function drawLuna(f) {
  const th = Math.PI * (1 - f); const lx = Math.sin(th), lz = Math.cos(th);
  for (let j = 0; j < LN; j++) for (let i = 0; i < LN; i++) {
    const x = (i + 0.5) / LN * 2 - 1, y = (j + 0.5) / LN * 2 - 1, r2 = x * x + y * y, k = (j * LN + i) * 4;
    if (r2 > 1) { lunaImg.data[k + 3] = 0; continue; }
    const z = Math.sqrt(1 - r2); const ndl = x * lx + z * lz;
    const lit = Math.max(0, ndl) ** 0.8 * 1.1 + 0.05;
    const v = Math.min(255, lunaAlb[j * LN + i] * lit * 255);
    lunaImg.data[k] = v; lunaImg.data[k + 1] = v * 0.97; lunaImg.data[k + 2] = v * 0.92; lunaImg.data[k + 3] = 255 * Math.min(1, (1 - Math.sqrt(r2)) * LN / 2);
  }
  lctx.putImageData(lunaImg, 0, 0);
}
const TRACKS = [{ t: '[DEMO TRACK]', d: 204 }, { t: '[DEMO TRACK 2]', d: 238 }];
const music = { i: 0, pos: 204 * 0.35 };
const luna = { state: 0 };
function cycleLuna() { luna.state = (luna.state + 1) % 4; applyLuna(); }
function applyLuna() {
  const el = document.getElementById('luna');
  el.hidden = luna.state === 3; document.getElementById('luna-tab').hidden = luna.state !== 3;
  el.classList.toggle('min', luna.state === 2);
  document.getElementById('luna-panel').hidden = luna.state !== 1;
}
tap('luna-orb', () => { luna.state = luna.state === 1 ? 0 : 1; applyLuna(); });
tap('luna-tab', () => { luna.state = 0; applyLuna(); });
const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
let lunaTick = 0;
function updateLuna(dt) {
  music.pos += dt; if (music.pos > TRACKS[music.i].d) { music.pos = 0; music.i = (music.i + 1) % TRACKS.length; }
  lunaTick -= dt; if (lunaTick > 0) return; lunaTick = 0.25;
  const tr = TRACKS[music.i], f = music.pos / tr.d;
  drawLuna(f);
  document.getElementById('luna-track').textContent = tr.t;
  document.getElementById('lp-track').textContent = tr.t;
  document.getElementById('lp-time').textContent = `${mmss(music.pos)} / ${mmss(tr.d)}`;
  const arc = document.getElementById('luna-arc'); const C = 2 * Math.PI * 48;
  const p = (flight.mode === 'travel' || flight.mode === 'align') ? flight.progress : 0;
  arc.setAttribute('stroke-dasharray', `${(C * p).toFixed(1)} ${C}`);
  document.getElementById('lp-journey').textContent = flight.target && p > 0 ? `To ${flight.target.name} · ${Math.round(p * 100)}%` : flight.mode === 'orbit' && flight.target ? `Orbiting ${flight.target.name}` : 'No course set';
}

// ---------- sound (Web Audio, synthesised; starts on boarding) ----------
const SOUND = ['Vacuum', 'Ambience', 'Music', 'Off'];
const audio = { ctx: null, mode: 1 };
function initAudio() {
  if (audio.ctx) return;
  const ctx = new AudioContext(); audio.ctx = ctx;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
  audio.master = ctx.createGain(); audio.master.gain.value = 0.7; audio.master.connect(ctx.destination);
  const chain = (node, ...rest) => { rest.reduce((a, b) => (a.connect(b), b), node); return rest[rest.length - 1]; };
  audio.cabin = ctx.createGain(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
  chain(src(), lp, audio.cabin, audio.master);
  audio.hum = ctx.createGain(); for (const f of [55, 110, 220]) { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.value = f === 55 ? 1 : 0.3; o.connect(g).connect(audio.hum); o.start(); }
  audio.hum.connect(audio.master);
  audio.engine = ctx.createGain(); const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 140; chain(src(), bp, audio.engine, audio.master);
  audio.warp = ctx.createGain(); audio.warpF = ctx.createBiquadFilter(); audio.warpF.type = 'bandpass'; audio.warpF.Q.value = 2; chain(src(), audio.warpF, audio.warp, audio.master);
  audio.wind = ctx.createGain(); const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 520; wf.Q.value = 0.5; chain(src(), wf, audio.wind, audio.master);
  for (const g of [audio.cabin, audio.hum, audio.engine, audio.warp, audio.wind]) g.gain.value = 0;
}
function cycleSound() { audio.mode = (audio.mode + 1) % 4; document.getElementById('btn-sound').textContent = `Sound: ${SOUND[audio.mode]} · N`; if (audio.mode === 2 && luna.state !== 1) { luna.state = 1; applyLuna(); } }
let audioLast = 0, audioDt = 0;
function updateAudio() {
  if (!audio.ctx) return; const t = audio.ctx.currentTime, k = 0.15; audioDt = Math.min(0.5, Math.max(0, t - audioLast)); audioLast = t;
  const m = audio.mode; let thr = Math.min(1, thrust.main + (flight.mode === 'travel' ? 0.4 : 0));
  if (WORLD.mode === 'surface') thr = WORLD.surface.thrust() * 1.6;
  // the planet's own soundscape on a surface (ambience.js); the generic wind is for elsewhere
  const ear = WORLD.mode === 'surface' && WORLD.surface && m !== 3 ? WORLD.surface.listen() : null;
  if (ear && (!audio.amb || audio.amb.key !== ear.key)) { if (audio.amb) audio.amb.dispose(); audio.amb = createAmbience(audio.ctx, audio.master, ear.key); }
  if (!ear && audio.amb) { audio.amb.dispose(); audio.amb = null; }
  if (audio.amb) { audio.amb.setLevel([0.25, 1, 0.55, 0][m]); audio.amb.update(ear, audioDt); }
  audio.wind.gain.setTargetAtTime(0, t, 0.4);
  const lv = m === 0 ? [0.012, 0.004, 0.25, 0.15] : m === 1 ? [0.06, 0.018, 1, 1] : m === 2 ? [0.03, 0.009, 0.5, 0.5] : [0, 0, 0, 0];
  audio.cabin.gain.setTargetAtTime(lv[0], t, k);
  audio.hum.gain.setTargetAtTime(lv[1], t, k);
  audio.engine.gain.setTargetAtTime(0.12 * thr * lv[2], t, k);
  audio.warp.gain.setTargetAtTime(0.5 * flight.warp * lv[3], t, 0.05);
  audio.warpF.frequency.setTargetAtTime(200 + flight.warp * 1800, t, 0.1);
}

// ---------- boarding ----------
function boardIfNeeded() {
  document.getElementById('mc').hidden = true;
  initAudio(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
}
tap('board', () => { boardIfNeeded(); flight.view = 'chase'; camInit = false; document.body.classList.remove('inspecting'); });


// ---------- worlds: space, a planet's surface, inside Mission Control ----------
const WORLD = { mode: 'space', surface: null, interior: null, cube: null, cubeRT: null, lander: null, sep: 0, busy: false };
const fadeEl = document.getElementById('fade');
const fade = (to, ms = 700) => { fadeEl.style.transition = `opacity ${ms}ms ease`; fadeEl.style.opacity = to; return new Promise((r) => setTimeout(r, ms + 40)); };
const setActive = (sc, cam) => { renderPass.scene = sc; renderPass.camera = cam; };
function startLanding() {
  const b = flight.target;
  if (flight.mode !== 'orbit' || !b || b.star || WORLD.lander) return;
  const L = buildLander(); L.scale.setScalar(0.1); scene.add(L); WORLD.lander = L; WORLD.sep = 0; WORLD.landTarget = b;
  const out = ship.pos.clone().sub(b.pos).normalize();
  L.position.copy(ship.pos).addScaledVector(out, -0.8); L.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
  WORLD.sepVel = out.clone().multiplyScalar(-1.5);
  setSite(b, out); // you land under the vessel, so it is day or night there as it is on the planet below
}
// the landing site, fixed to the turning planet; the sun's place in its sky follows from the spin and the orbit
function setSite(b, worldUp) { WORLD.site = { body: b, local: worldUp.clone().normalize().applyQuaternion(b.group.quaternion.clone().invert()) }; }
function siteSun() {
  const { body: b, local } = WORLD.site;
  const up = local.clone().applyQuaternion(b.group.quaternion).normalize();
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(b.group.quaternion);
  let N = axis.clone().addScaledVector(up, -axis.dot(up)); if (N.lengthSq() < 1e-6) N.set(1, 0, 0); N.normalize();
  const E = new THREE.Vector3().crossVectors(N, up);
  const toSun = SUN.clone().sub(b.pos).normalize();
  return new THREE.Vector3(toSun.dot(E), toSun.dot(up), -toSun.dot(N));
}
// when the sun next sets and rises at the site: run the planet's spin and its orbit forward and find the crossings
const _sq = new THREE.Quaternion(), _se = new THREE.Euler(), _sp = new THREE.Vector3(), _su = new THREE.Vector3();
function elevAt(t) { // sine of the sun's height above the horizon, t seconds from now
  const { body: b, local } = WORLD.site;
  orbitPoint(b, b.ang + (2 * Math.PI / b.period) * t, _sp);
  _sq.setFromEuler(_se.set(0, b.group.rotation.y + b.spin * t, b.tilt));
  return _su.copy(local).applyQuaternion(_sq).dot(_sp.negate().normalize());
}
const solarDay = (b) => (2 * Math.PI) / (b.spin + 2 * Math.PI / b.period); // the spin runs against the orbit
function nextCross(rising, from = 0) {
  const b = WORLD.site.body, D = solarDay(b), step = D / 240, end = from + D * 2.2;
  let t = from, prev = elevAt(t);
  while (t < end) {
    const t2 = t + step, cur = elevAt(t2);
    if (rising ? prev < 0 && cur >= 0 : prev > 0 && cur <= 0) {
      let lo = t, hi = t2; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2, v = elevAt(m); if (rising ? v < 0 : v > 0) lo = m; else hi = m; }
      return hi;
    }
    t = t2; prev = cur;
  }
  return null; // the sun stays up (or down) for now
}
function sunTimes() {
  const set = nextCross(false), rise = nextCross(true);
  const rise2 = rise !== null ? nextCross(true, rise + 1) : null;
  return { set, rise, day: rise2 !== null ? rise2 - rise : solarDay(WORLD.site.body), at: clock.value };
}
// a site where the sun stands at the given height (degrees), in the morning or the afternoon (for tests)
function siteAtElevation(b, deg, afternoon = true) {
  const toSun = SUN.clone().sub(b.pos).normalize();
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(b.group.quaternion);
  const east = new THREE.Vector3().crossVectors(axis, toSun).normalize().multiplyScalar(afternoon ? 1 : -1);
  const e = THREE.MathUtils.degToRad(deg);
  setSite(b, toSun.clone().multiplyScalar(Math.sin(e)).addScaledVector(east, Math.cos(e)));
}
function updateSeparation(dt) {
  const L = WORLD.lander; if (!L) return;
  WORLD.sep += dt;
  const b = WORLD.landTarget; L.position.add(b.delta || new THREE.Vector3());
  const inward = b.pos.clone().sub(L.position).normalize();
  if (WORLD.sep > 1.0) WORLD.sepVel.addScaledVector(inward, dt * (8 + WORLD.sep * 30));
  L.position.addScaledVector(WORLD.sepVel, dt);
  L.userData.plume.material.opacity = WORLD.sep > 1.0 ? 0.9 : 0; L.userData.plume.scale.set(1, 1.2, 1);
  blinkLights(L, clock.value);
  if (WORLD.sep > 3.6 && !WORLD.busy) enterSurface(b);
}
async function enterSurface(b) {
  WORLD.busy = true;
  await fade(1, 700);
  scene.remove(WORLD.lander); WORLD.lander = null;
  if (!WORLD.site || WORLD.site.body !== b) setSite(b, ship.pos.clone().sub(b.pos));
  if (!ground) { ground = makePipeline(makeRenderer(canvas2, false), new THREE.Scene(), camera); sizePipeline(ground); }
  showLoading(`Landing on ${b.name} · preparing the ground`);
  WORLD.surface = createSurface(ground.r, b.key, { sun: siteSun(), q: GFX.t });
  WORLD.mode = 'surface'; document.body.dataset.world = 'surface'; ground.pass.scene = WORLD.surface.scene; ground.pass.camera = WORLD.surface.camera; WORLD.surface.resize();
  await Promise.race([WORLD.surface.ready, new Promise((r) => setTimeout(r, 12000))]);
  showLoading(null); WORLD.sun = null;
  await fade(0, 1000); WORLD.busy = false;
}
// back to the lander from anywhere on foot; with leave, straight on up to orbit
async function recallToLander(leave) {
  const s = WORLD.surface; if (!s || WORLD.busy) return;
  if (s.st.phase === 'walk' || s.st.phase === 'drive') { WORLD.busy = true; await fade(1, 350); s.recall(); if (leave) s.takeOff(); await fade(0, 500); WORLD.busy = false; }
  else if (leave && s.st.phase === 'pilot') s.takeOff();
}
// the rover drives over to you (the trip is skipped with a short fade)
async function summonRover() {
  const s = WORLD.surface; if (!s || WORLD.busy || s.st.phase !== 'walk' || s.st.nearRover) return;
  WORLD.busy = true; await fade(1, 300); s.summon(); await fade(0, 400); WORLD.busy = false;
}
const loadingEl = document.getElementById('w-loading');
function showLoading(text) { loadingEl.hidden = !text; if (text) loadingEl.textContent = text; }
async function leaveSurface() {
  WORLD.busy = true;
  await fade(1, 800);
  WORLD.surface.dispose(); WORLD.surface = null;
  WORLD.mode = 'space'; document.body.dataset.world = 'space'; setActive(scene, camera); camInit = false; thrust.reset = true;
  flight.mode = 'orbit'; if (flight.rel) ship.pos.copy(flight.target.pos).add(flight.rel); WORLD.site = null;
  await fade(0, 1000); WORLD.busy = false;
}
async function enterInterior() {
  if (flight.mode !== 'docked' || WORLD.busy) return;
  WORLD.busy = true; await fade(1, 500);
  if (!WORLD.cube) { WORLD.cubeRT = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.HalfFloatType }); WORLD.cube = new THREE.CubeCamera(2, 3e6, WORLD.cubeRT); scene.add(WORLD.cube); }
  WORLD.cube.position.copy(STATION.pos).add(new THREE.Vector3(0, 0, -6));
  sky.position.copy(WORLD.cube.position); ship.mesh.visible = true; WORLD.cube.update(renderer, scene);
  const bodies = BODIES.map((b) => ({ name: b.name, ang: b.ang, c: '#' + new THREE.Color(...b.shine).multiplyScalar(1.8).getHexString(), size: 0.05 + b.R / 22000, squash: b.scale, ring: !!b.ring }));
  WORLD.interior = createInterior(renderer, WORLD.cubeRT.texture, {
    bodies,
    vessel: [['Design', DESIGNS[ship.design].name], ['Dock', 'Hard-docked', true], ['Berth', 'K.№ 01'], ['Propellant', '100%'], ['Lander', 'Stowed']],
    dest: BODIES.map((b) => [b.name, `${b.g} g · ${b.what}`]).concat([['The Star', 'Orbit only']]),
  });
  WORLD.mode = 'interior'; document.body.dataset.world = 'interior'; setActive(WORLD.interior.scene, WORLD.interior.camera); WORLD.interior.resize();
  await fade(0, 800); WORLD.busy = false;
}
async function leaveInterior() {
  if (WORLD.busy) return; WORLD.busy = true; await fade(1, 500);
  WORLD.interior = null; WORLD.mode = 'space'; document.body.dataset.world = 'space'; setActive(scene, camera); camInit = false;
  await fade(0, 700); WORLD.busy = false;
}
const worldEls = { t: document.getElementById('w-title'), s: document.getElementById('w-sub'), p: document.getElementById('w-prompt'), h: document.getElementById('w-hint'), card: document.getElementById('w-card'), ct: document.getElementById('w-card-t'), cx: document.getElementById('w-card-x') };
function updateWorldHUD() {
  let poi = null;
  if (WORLD.mode === 'surface') {
    const s = WORLD.surface, st = s.st, W = s.W, L = st.lander;
    const el = THREE.MathUtils.radToDeg(s.sunElev); const rising = el > (WORLD.lastElev ?? el); WORLD.lastElev = el;
    const tod = el > 20 ? (rising ? 'Morning' : 'Afternoon') : el > 4 ? (rising ? 'Early morning' : 'Evening') : el > -6 ? (rising ? 'Dawn' : 'Dusk') : 'Night';
    setText(worldEls.t, W.name);
    setText(worldEls.s, `Gravity ${W.g} g · Wind ${W.wind > 0.5 ? 'strong' : W.wind > 0.1 ? 'light' : W.wind > 0 ? 'faint' : 'none, almost no air'} · ${tod}, sun ${el.toFixed(0)}°`);
    const rs = s.rover, msg = st.phase === 'drive' ? (rs.msgT > 0 ? rs.msg : '') : L.msgT > 0 ? L.msg : '';
    const T = document.body.classList.contains('touch'); // on a touch screen the prompts name buttons, not keys
    setText(worldEls.p, msg || (st.phase === 'descent' ? (T ? 'Descending · move the stick to take over' : 'Descending · any flight key to take over')
      : st.phase === 'ascent' ? 'Lifting off to orbit'
      : st.phase === 'pilot' ? (L.landed ? (T ? 'Landed · step outside, or Up to lift off' : 'Landed · E step outside · Space lift off · T back to orbit') : L.aglHold <= 0.4 ? 'Settling' : (T ? 'Flying · hold Down to land' : 'Flying · Shift down to land'))
      : st.phase === 'drive' ? `Driving · ${Math.round(Math.abs(rs.speed) * 3.6)} km/h${rs.air ? ' · airborne' : rs.float ? ' · afloat' : rs.depth > 0.25 ? ' · wading' : ''}${st.poi ? ' · ' + st.poi.name : ''}`
      : T ? (st.nearRover ? 'The rover · tap Get in' : st.nearLander ? 'The lander · tap Board' : st.poi ? `You are at ${st.poi.name}` : 'Explore')
      : st.nearRover ? 'E · Drive the rover' : st.nearLander ? 'E · Board the lander' : st.poi ? `You are at ${st.poi.name}` : s.roverOut ? 'Explore · F call the rover · B back to the lander' : 'Explore · B back to the lander · T leave the planet'));
    setText(worldEls.h, st.phase === 'drive' ? 'W S drive / reverse · A D steer · Shift fast · Space brake · E get out · B lander · drag to look'
      : st.phase === 'walk' ? 'W A S D walk · Shift run · Space jump · drag to look · scroll to zoom · F rover · B lander · T leave · M labels · P graphics'
      : st.phase === 'pilot' ? 'W S forward/back · A D turn · ← → sideways · Space up · Shift down · R boost · drag to look · M labels · P graphics' : 'Drag to look around');
    updateSunPanel(el);
    updateActions(st, L);
    const r = document.getElementById('w-read'); r.hidden = st.phase === 'walk' || st.phase === 'drive';
    if (!r.hidden) {
      setText(document.getElementById('wr-alt'), `${Math.max(0, L.agl).toFixed(L.agl < 10 ? 1 : 0)} m`);
      setText(document.getElementById('wr-vs'), `${L.vel.y >= 0 ? '+' : '−'}${Math.abs(L.vel.y).toFixed(1)} m/s`);
      setText(document.getElementById('wr-gs'), `${Math.hypot(L.vel.x, L.vel.z).toFixed(1)} m/s`);
      setText(document.getElementById('wr-thr'), `${Math.round(L.thrust * 100)}%`);
      document.getElementById('wr-bar').style.width = Math.round(L.thrust * 100) + '%';
    }
    poi = st.poi;
  } else if (WORLD.mode === 'interior') {
    const st = WORLD.interior.st;
    setText(worldEls.t, 'Mission Control'); setText(worldEls.s, 'Inside · the Great Chart room');
    setText(worldEls.p, st.near && st.near.hatch ? 'E · Back to the vessel' : st.near ? st.near.name : 'Walk around');
    setText(worldEls.h, 'W A S D walk · drag to look · I or Esc to leave');
    poi = st.near && !st.near.hatch ? st.near : null;
  }
  worldEls.card.hidden = !poi; if (poi) { setText(worldEls.ct, poi.name); setText(worldEls.cx, poi.text); }
  updateSurfaceLabels();
}
// sunset and sunrise at the landing site, counted down; the dial shows the sun's way through the day or the night
const sunEls = { box: document.getElementById('sunp'), dot: document.getElementById('sunp-dot'), ka: document.getElementById('sunp-ka'), a: document.getElementById('sunp-a'), kb: document.getElementById('sunp-kb'), b: document.getElementById('sunp-b'), c: document.getElementById('sunp-c') };
const fmtDur = (s) => { if (s === null || !isFinite(s)) return '—'; s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), r = s % 60; return m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`; };
function updateSunPanel(elevDeg) {
  if (!WORLD.site) { sunEls.box.hidden = true; return; }
  sunEls.box.hidden = false;
  if (!WORLD.sun || clock.value - WORLD.sun.at > 6 || clock.value < WORLD.sun.at) WORLD.sun = sunTimes();
  const S = WORLD.sun, gone = clock.value - S.at;
  const toSet = S.set === null ? null : S.set - gone, toRise = S.rise === null ? null : S.rise - gone;
  const up = elevDeg > 0;
  const first = up ? ['Sunset in', toSet] : ['Sunrise in', toRise], second = up ? ['Sunrise in', toRise] : ['Sunset in', toSet];
  setText(sunEls.ka, first[0]); setText(sunEls.a, first[1] === null ? (up ? 'Not today' : 'Not tonight') : fmtDur(first[1]));
  setText(sunEls.kb, second[0]); setText(sunEls.b, fmtDur(second[1]));
  // light and dark within one solar day
  let k = 0.5, dayLen = null;
  if (toSet !== null && toRise !== null) {
    const night = up ? toRise - toSet : S.day - (toSet - toRise), light = S.day - night; dayLen = light;
    k = up ? 1 - toSet / light : 1 - toRise / night;
  }
  const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`;
  setText(sunEls.c, dayLen === null ? mmss(S.day) : `${mmss(dayLen)} light · ${mmss(S.day - dayLen)} dark`);
  const th = up ? Math.PI * (1 - THREE.MathUtils.clamp(k, 0, 1)) : -Math.PI * THREE.MathUtils.clamp(k, 0, 1);
  sunEls.dot.setAttribute('cx', (32 + 16 * Math.cos(th)).toFixed(2)); sunEls.dot.setAttribute('cy', (22 - 16 * Math.sin(th)).toFixed(2));
  sunEls.box.classList.toggle('night', !up);
}
// on-screen actions for the surface (the same as the keys; needed on touch screens)
const actEls = {}; document.querySelectorAll('#w-actions button').forEach((b) => { actEls[b.dataset.act] = b; b.addEventListener('click', () => { dispatchEvent(new KeyboardEvent('keydown', { code: b.dataset.key })); setTimeout(() => keys.delete(b.dataset.key), 60); b.blur(); }); });
function updateActions(st, L) {
  const walk = st.phase === 'walk', pilot = st.phase === 'pilot';
  const drive = st.phase === 'drive';
  actEls.out.hidden = !(pilot && L.landed); actEls.board.hidden = !(walk && st.nearLander && !st.nearRover);
  actEls.drive.hidden = !(walk && st.nearRover); actEls.exit.hidden = !drive; actEls.call.hidden = !(walk && st.roverFar && !st.nearLander);
  actEls.back.hidden = !((walk && !st.nearLander) || drive); actEls.leave.hidden = !(walk || pilot || drive);
}
// labels over the places on a surface, with their distance
const sBox = document.getElementById('s-markers'); const sEls = new Map();
function updateSurfaceLabels() {
  const s = WORLD.mode === 'surface' ? WORLD.surface : null;
  sBox.hidden = !s || WORLD.labels === false; if (sBox.hidden) return;
  const cam = s.camera, w = innerWidth, h = innerHeight, from = s.here, seen = new Set();
  for (const l of s.labels()) {
    let el = sEls.get(l.name); if (!el) { el = document.createElement('div'); el.className = 'smk'; el.innerHTML = '<span class="n"></span><span class="d"></span>'; sBox.appendChild(el); sEls.set(l.name, el); el.querySelector('.n').textContent = l.name; }
    seen.add(l.name);
    const v = l.pos.clone().project(cam); const d = from.distanceTo(l.pos);
    const show = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && d > 30;
    el.style.display = show ? 'flex' : 'none'; if (!show) continue;
    el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
    setText(el.querySelector('.d'), d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m');
  }
  for (const [k, el] of sEls) if (!seen.has(k)) el.style.display = 'none';
}
// what the star says about you, shown while you orbit it
const starCard = document.getElementById('star-card');
function updateStarCard() {
  const show = WORLD.mode === 'space' && flight.view !== 'inspect' && ((flight.mode === 'orbit' && flight.target === STAR) || (flight.mode === 'manual' && ship.pos.length() < STAR_R * 4));
  starCard.hidden = !show;
}
// docking guidance when flying yourself near the berth
const guideEl = document.getElementById('dockguide');
function updateDockGuide() {
  const range = ship.pos.distanceTo(dockPose().pos);
  const show = (flight.mode === 'manual' && range < 300) || flight.mode === 'dockApproach';
  guideEl.hidden = !show; if (!show) return;
  const rel = BERTH.pos.clone().sub(ship.pos).applyQuaternion(ship.quat.clone().invert());
  const ax = THREE.MathUtils.clamp(rel.x / Math.max(1, -rel.z), -1, 1), ay = THREE.MathUtils.clamp(rel.y / Math.max(1, -rel.z), -1, 1);
  document.getElementById('dg-dot').setAttribute('transform', `translate(${(ax * 80).toFixed(1)} ${(-ay * 80).toFixed(1)})`);
  const off = ship.pos.clone().sub(BERTH.pos); const lateral = off.clone().addScaledVector(BERTH.dir, -off.dot(BERTH.dir)).length() * 10;
  const nose = THREE.MathUtils.radToDeg(fwd().angleTo(BERTH.pos.clone().sub(ship.pos)));
  setText(document.getElementById('dg-range'), `${(range * 10).toFixed(0)} m`);
  setText(document.getElementById('dg-close'), `${(ship.speed * 10).toFixed(1)} m/s`);
  setText(document.getElementById('dg-off'), `${lateral.toFixed(1)} m`);
  setText(document.getElementById('dg-nose'), `${nose.toFixed(0)}°`);
  setText(document.getElementById('dg-msg'), flight.mode === 'dockApproach' ? 'Captured · drawing in' : nose > 25 ? 'Turn the nose onto the berth' : range > 150 ? 'Close in slowly · W / S' : 'Assist holding the axis · capture inside 70 m');
}

// ---------- simulation ----------
const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4();
// the system keeps moving whatever you are doing: planets orbit and turn, the star turns, the wheel spins
function advanceSystem(dt) {
  clock.value += dt; starTime.value += dt;
  updateOrbits(dt); starGroup.rotation.y += dt * 0.004;
  STATION.group.userData.wheel.rotation.z += dt * 0.06;
  blinkLights(STATION.group, clock.value);
}
function step(dt) {
  advanceSystem(dt);
  const prev = tmpV.copy(ship.pos);
  const px = prev.x, py = prev.y, pz = prev.z;
  const steerYaw = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0) - drag.dx;
  const steerPitch = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0) - drag.dy;
  const steerRoll = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
  if (keys.has('KeyW')) { leaveAuto(); if (flight.mode === 'manual') ship.throttle = Math.min(1, ship.throttle + dt * 0.6); }
  if (keys.has('KeyS')) ship.throttle = Math.max(0, ship.throttle - dt * 0.8);
  const braking = keys.has('Space');
  if (braking) { ship.throttle = 0; if (!['manual', 'docked', 'undock'].includes(flight.mode)) cancelCourse(); }

  let warpTarget = 0;
  if (flight.mode === 'align') {
    flight.t += dt; const a = Math.min(1, flight.t / flight.alignT);
    ship.quat.slerpQuaternions(flight.q0, flight.q1, smoother(a)); flight.progress = 0;
    ship.throttle = THREE.MathUtils.lerp(ship.throttle, 0.15, 1 - Math.exp(-dt * 2));
    if (a >= 1) { flight.mode = 'travel'; flight.t = 0; flight.from.copy(ship.pos); }
  } else if (flight.mode === 'travel') {
    flight.t += dt; const u = Math.min(1, flight.t / flight.T);
    if (flight.toRel) flight.to.copy(flight.target.pos).add(flight.toRel);
    ship.pos.lerpVectors(flight.from, flight.to, smoother(u)); flight.progress = u;
    tmpQ.setFromRotationMatrix(tmpM.lookAt(ship.pos, flight.target.pos, up())); ship.quat.slerp(tmpQ, 1 - Math.exp(-dt * 3));
    ship.throttle = THREE.MathUtils.lerp(ship.throttle, u < 0.6 ? 1 : 0.1, 1 - Math.exp(-dt * 2));
    if (ship.level === 3) warpTarget = Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.6;
    else if (ship.level === 2) warpTarget = 0.12 * Math.sin(Math.PI * u);
    if (u >= 1) { if (flight.target.key === 'station') startDock(); else enterOrbit(); }
  } else if (flight.mode === 'orbit') {
    const b = flight.target; const rel = flight.rel || ship.pos.clone().sub(b.pos);
    const r = THREE.MathUtils.lerp(rel.length(), flight.orbitR, 1 - Math.exp(-dt * 0.5));
    rel.applyAxisAngle(flight.orbitAxis, dt * (2 * Math.PI / (b.star ? 240 : 120))).setLength(r);
    flight.rel = rel; ship.pos.copy(b.pos).add(rel);
    const tangent = new THREE.Vector3().crossVectors(flight.orbitAxis, rel).normalize();
    tmpQ.setFromRotationMatrix(tmpM.lookAt(ship.pos, ship.pos.clone().add(tangent), rel.clone().normalize()));
    ship.quat.slerp(tmpQ, 1 - Math.exp(-dt * 1.5)); ship.throttle = 0.05;
  } else if (flight.mode === 'undock') {
    flight.t += dt; const t = flight.t;
    ship.pos.copy(flight.from).addScaledVector(BERTH.dir, 35 * smoother(THREE.MathUtils.clamp((t - 1.2) / 6, 0, 1)));
    if (t > 7.2) { tmpQ.setFromRotationMatrix(tmpM.lookAt(ship.pos, ship.pos.clone().addScaledVector(BERTH.dir, 10).add(new THREE.Vector3(0.001, 0, 0)), WORLD_UP)); ship.quat.slerpQuaternions(flight.q0, tmpQ, smoother(Math.min(1, (t - 7.2) / 3.2))); }
    if (t > 10.6) { flight.mode = 'manual'; ship.speed = 0; ship.throttle = 0; const p = flight.pending; flight.pending = null; markSel(null); if (p) setCourse(p); }
  } else if (flight.mode === 'dockAlign') {
    flight.t += dt; const a = smoother(Math.min(1, flight.t / 3.5));
    ship.pos.lerpVectors(flight.from, corridorPoint(), a); ship.quat.slerpQuaternions(flight.q0, flight.q1, a);
    if (flight.t >= 3.5) { flight.mode = 'dockApproach'; flight.t = 0; flight.from.copy(ship.pos); flight.T_dock = 14; }
  } else if (flight.mode === 'dockApproach') {
    flight.t += dt; const T = flight.T_dock || 14; const p = dockPose();
    ship.pos.lerpVectors(flight.from, p.pos, smoother(Math.min(1, flight.t / T))); ship.quat.slerp(p.quat, 1 - Math.exp(-dt * 3));
    if (flight.t >= T) { park(); thrust.reset = false; flight.target = null; markSel(null); flight.contact = clock.value; }
  } else if (flight.mode === 'manual') {
    const rate = ship.level === 0 ? 1.0 : 0.7;
    tmpQ.setFromEuler(new THREE.Euler(steerPitch * rate * dt, steerYaw * rate * dt, steerRoll * 1.2 * dt)); ship.quat.multiply(tmpQ).normalize();
    const target = braking ? 0 : ship.throttle * LEVELS[ship.level].max;
    const tau = ship.level === 3 ? 0.8 : ship.level === 0 ? 0.6 : 1.6;
    ship.speed = THREE.MathUtils.lerp(ship.speed, target, 1 - Math.exp(-dt / (braking ? 0.5 : tau)));
    ship.pos.addScaledVector(fwd(), ship.speed * dt);
    { // near the berth: an approach speed governor, an axis-holding assist, and soft capture
      const dp = dockPose(), range = dp.pos.distanceTo(ship.pos);
      if (range < 300) {
        const cap = Math.max(2.5, range * 0.18); if (ship.speed > cap) ship.speed = THREE.MathUtils.lerp(ship.speed, cap, 1 - Math.exp(-dt * 2));
        const ang = fwd().angleTo(BERTH.pos.clone().sub(ship.pos));
        if (range < 150 && ang < 0.45) {
          tmpQ.setFromRotationMatrix(tmpM.lookAt(ship.pos, BERTH.pos, WORLD_UP)); ship.quat.slerp(tmpQ, 1 - Math.exp(-dt * 0.8));
          const axisPt = BERTH.pos.clone().addScaledVector(BERTH.dir, ship.pos.clone().sub(BERTH.pos).dot(BERTH.dir)); ship.pos.lerp(axisPt, 1 - Math.exp(-dt * 0.35));
        }
        if (range < 7 && ang < 0.5) { flight.mode = 'dockApproach'; flight.t = 0; flight.from.copy(ship.pos); flight.T_dock = 3 + range * 0.5; flight.target = STATION; }
      }
    }
    if (ship.level === 3) warpTarget = Math.min(1, ship.speed / LEVELS[3].max) * 0.8;
  }
  if (flight.mode === 'manual' || flight.mode === 'align') { // inside a planet's reach you move with it
    for (const b of BODIES) if (ship.pos.distanceTo(b.pos) < b.Rmax * 9) { ship.pos.add(b.delta); break; }
  }
  for (const b of [...BODIES, STAR]) { const d = ship.pos.clone().sub(b.pos); const min = b.star ? b.R * 1.6 : b.Rmax * (b.rs + 0.08); if (d.length() < min) ship.pos.copy(b.pos).add(d.setLength(min)); }
  if (flight.mode !== 'manual' && flight.mode !== 'docked') { // speed relative to the world you are with, not to the star
    const d = flight.target && flight.target.delta && (flight.mode === 'orbit' || flight.mode === 'travel') ? flight.target.delta : null;
    ship.speed = Math.hypot(ship.pos.x - px - (d ? d.x : 0), ship.pos.y - py - (d ? d.y : 0), ship.pos.z - pz - (d ? d.z : 0)) / Math.max(dt, 1e-4);
  }
  flight.warp = THREE.MathUtils.lerp(flight.warp, warpTarget, 1 - Math.exp(-dt * 8));
}
function measureThrust(dt) {
  if (thrust.reset) { thrust.prevPos.copy(ship.pos); thrust.prevQuat.copy(ship.quat); thrust.prevVel.set(0, 0, 0); thrust.acc.set(0, 0, 0); thrust.omega.set(0, 0, 0); thrust.reset = false; return; }
  const carry = flight.target && flight.target.delta && ['orbit', 'travel'].includes(flight.mode) ? flight.target.delta : null;
  const vel = ship.pos.clone().sub(thrust.prevPos).sub(carry || new THREE.Vector3()).divideScalar(dt);
  const accL = vel.clone().sub(thrust.prevVel).divideScalar(dt).applyQuaternion(ship.quat.clone().invert());
  thrust.prevVel.copy(vel); thrust.prevPos.copy(ship.pos);
  thrust.acc.lerp(accL, 1 - Math.exp(-dt * 8));
  const dq = thrust.prevQuat.clone().invert().multiply(ship.quat); thrust.prevQuat.copy(ship.quat);
  if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
  const ang = 2 * Math.acos(Math.min(1, dq.w)), s = Math.sqrt(Math.max(1e-12, 1 - dq.w * dq.w));
  const om = ang < 1e-6 ? new THREE.Vector3() : new THREE.Vector3(dq.x / s, dq.y / s, dq.z / s).multiplyScalar(ang / dt);
  thrust.omega.lerp(om, 1 - Math.exp(-dt * 10));
  const m = flight.mode, docking = m === 'undock' || m === 'dockAlign' || m === 'dockApproach';
  const aref = m === 'travel' ? flight.aref : docking ? 1.0 : Math.max(4, LEVELS[ship.level].max / 6);
  const a = thrust.acc.clone().divideScalar(aref);
  if (docking) { thrust.main = 0; thrust.force.copy(a).clampLength(0, 1); }
  else if (m === 'orbit' || m === 'docked') { thrust.main = 0; thrust.force.set(0, 0, 0); }
  else { thrust.main = THREE.MathUtils.clamp(-a.z, 0, 1); thrust.force.set(0, 0, THREE.MathUtils.clamp(a.z, 0, 1)); }
  thrust.torque.copy(thrust.omega).divideScalar(0.3).clampLength(0, 1);
}
function enterOrbit() {
  const b = flight.target; flight.mode = 'orbit';
  const rel = ship.pos.clone().sub(b.pos); flight.rel = rel.clone(); flight.orbitR = b.star ? b.R * 2.6 : b.Rmax * 1.75;
  flight.orbitAxis.crossVectors(rel, new THREE.Vector3(0, 1, 0)).normalize();
  if (flight.orbitAxis.lengthSq() < 0.1) flight.orbitAxis.set(1, 0, 0);
}

// ---------- camera: rigidly attached to the vessel; only its rotation is smoothed ----------
const camQ = new THREE.Quaternion(); let camInit = false;
function updateCamera(dt) {
  ship.mesh.position.copy(ship.pos); ship.mesh.quaternion.copy(ship.quat);
  const cockpit = flight.view === 'cockpit';
  ship.mesh.visible = !cockpit;
  const fov = 58 + flight.warp * 18 + Math.min(ship.speed / 20000, 1) * 4;
  camera.fov = THREE.MathUtils.lerp(camera.fov, fov, 1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix();
  if (!camInit) { camQ.copy(ship.quat); camInit = true; }
  camQ.slerp(ship.quat, 1 - Math.exp(-dt * 4));
  const L = ship.mesh.userData.length || 4;
  if (flight.view === 'inspect') {
    let c, d, minD, frameQ = null;
    if (insp.subject === 'vessel') { c = ship.pos; d = L * 1.5; minD = L * 0.6; frameQ = ship.quat; }
    else if (insp.subject === 'station') { c = STATION.pos; d = 80; minD = 30; }
    else if (insp.subject === 'star') { c = STAR.pos; d = STAR_R * 3.2; minD = STAR_R * 1.7; }
    else { const b = BODIES.find((x) => x.key === insp.subject); c = b.pos; d = b.Rmax * 2.7; minD = b.Rmax * 1.15; }
    if (insp.auto && !drag.on) insp.yaw += dt * (insp.subject === 'vessel' ? 0.25 : 0.05);
    const dist = Math.max(minD, d * insp.zoom);
    const off = new THREE.Vector3(Math.sin(insp.yaw) * Math.cos(insp.pitch), Math.sin(insp.pitch), Math.cos(insp.yaw) * Math.cos(insp.pitch)).multiplyScalar(dist);
    if (frameQ) off.applyQuaternion(frameQ);
    camera.position.copy(c).add(off);
    camera.quaternion.setFromRotationMatrix(tmpM.lookAt(camera.position, c, frameQ ? up(frameQ) : WORLD_UP));
  } else if (cockpit) {
    camera.position.copy(DESIGNS[ship.design].cockpit).applyQuaternion(ship.quat).add(ship.pos);
    camera.quaternion.copy(ship.quat);
  } else {
    const back = L * 1.75 + flight.warp * 2;
    camera.position.copy(new THREE.Vector3(0, L * 0.3, back).applyQuaternion(camQ).add(ship.pos));
    const look = ship.pos.clone().addScaledVector(fwd(camQ), L * 4);
    camera.quaternion.setFromRotationMatrix(tmpM.lookAt(camera.position, look, up(camQ)));
  }
  sky.position.copy(camera.position);
  // sun light and its shadow box follow the vessel (wider near the station)
  const toSun = SUN.clone().sub(ship.pos).normalize();
  const nearStation = ship.pos.distanceTo(STATION.pos) < 260;
  const S = nearStation ? 70 : L * 1.4;
  const sc = sunLight.shadow.camera;
  if (sc.right !== S) { sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.near = 1; sc.far = S * 6; sc.updateProjectionMatrix(); }
  const centre = nearStation ? STATION.pos.clone().lerp(ship.pos, 0.5) : ship.pos;
  sunLight.position.copy(centre).addScaledVector(toSun, S * 3); sunLight.target.position.copy(centre);
  updateEnvironment(toSun);
  // planet-shine: the nearest world lights the vessel from its side
  let best = null, bi = 0;
  for (const b of BODIES) { const k = (b.R / ship.pos.distanceTo(b.pos)) ** 2; if (k > bi) { bi = k; best = b; } }
  planetLight.color.setRGB(...best.shine); planetLight.intensity = Math.min(3, bi * 14);
  planetLight.position.copy(best.pos); planetLight.target.position.copy(ship.pos);
}

// ---------- HUD ----------
const hudEls = { title: document.getElementById('state-title'), sub: document.getElementById('state-sub'), spd: document.getElementById('spd'), thr: document.getElementById('thr'), thrL: document.getElementById('thr-label') };
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
function updateHUD() {
  const m = flight.mode, b = flight.target;
  const dockRange = ship.pos.distanceTo(dockPose().pos) * 10;
  const title = m === 'docked' ? (clock.value - (flight.contact ?? -99) < 3 ? 'Contact · latched' : 'Docked')
    : m === 'undock' ? (flight.t < 1.2 ? 'Releasing' : flight.t < 7.2 ? 'Undocking' : 'Turning away')
    : m === 'dockAlign' ? 'Lining up' : m === 'dockApproach' ? 'Final approach'
    : m === 'align' ? 'Turning onto course' : m === 'travel' ? (flight.t / flight.T > 0.8 ? 'Approach' : LEVELS[ship.level].name) : m === 'orbit' ? 'Orbit' : 'Free flight';
  setText(hudEls.title, title);
  setText(hudEls.sub, m === 'docked' ? 'Mission Control · U to undock, or click a world'
    : m === 'undock' ? `Clearing the berth · ${dockRange.toFixed(0)} m${flight.pending ? ' · then ' + flight.pending.name : ''}`
    : m === 'dockAlign' ? 'Docking corridor · Mission Control'
    : m === 'dockApproach' ? `Range ${dockRange.toFixed(1)} m · closing ${(ship.speed * 10).toFixed(1)} m/s`
    : WORLD.lander ? `Lander separating · descending to ${WORLD.landTarget.name}` : b ? `${b.name}${m === 'orbit' ? (b.star ? ' · you · too hot to land · W to leave' : ' · G to land · W to leave orbit') : ''}` : 'No destination set');
  document.getElementById('btn-undock').hidden = m !== 'docked';
  document.getElementById('btn-inside').hidden = m !== 'docked';
  document.getElementById('btn-land').hidden = !(m === 'orbit' && b && !b.star) || !!WORLD.lander;
  document.getElementById('btn-dock').hidden = !(m === 'manual' && ship.pos.distanceTo(STATION.pos) < 3000);
  const slow = DOCKING.includes(m);
  const kms = ship.speed * KM;
  setText(document.getElementById('spd-unit'), slow ? 'm/s' : 'km/s');
  setText(hudEls.spd, slow ? (ship.speed * 10).toFixed(1) : kms < 10 ? kms.toFixed(1) : Math.round(kms).toLocaleString('en-GB'));
  hudEls.thr.style.width = Math.round(ship.throttle * 100) + '%';
  setText(hudEls.thrL, slow ? 'Thrusters · docking autopilot' : (m === 'travel' || m === 'align') ? `Autopilot · ${LEVELS[ship.level].name}` : `Throttle ${Math.round(ship.throttle * 100)}% · ${LEVELS[ship.level].name}`);
  if (flight.view === 'cockpit') {
    const set = (id, t) => setText(document.getElementById(id), t);
    if (b) {
      const range = Math.max(0, ship.pos.distanceTo(b.pos) - stopDist(b));
      set('c-target', b.name); set('c-range', fmtKm(range)); set('c-closing', Math.round(kms).toLocaleString('en-GB') + ' km/s');
      set('c-eta', m === 'travel' ? fmtT(flight.T - flight.t) : m === 'orbit' ? 'In orbit' : '—');
      const rel = b.pos.clone().sub(ship.pos).applyQuaternion(ship.quat.clone().invert());
      document.getElementById('hdg-target').setAttribute('transform', `rotate(${(Math.atan2(rel.x, -rel.z) * 180 / Math.PI).toFixed(1)} 110 110)`);
      document.getElementById('hdg-target').style.display = '';
    } else { set('c-target', 'Free flight'); set('c-range', '—'); set('c-closing', '—'); set('c-eta', '—'); document.getElementById('hdg-target').style.display = 'none'; }
  }
}
{
  const g = document.getElementById('ticks'); let s = '';
  for (let a = 0; a < 360; a += 10) { const r0 = a % 30 === 0 ? 82 : 87, rad = a * Math.PI / 180; s += `<path d="M${110 + 92 * Math.sin(rad)} ${110 - 92 * Math.cos(rad)} L${110 + r0 * Math.sin(rad)} ${110 - r0 * Math.cos(rad)}" stroke="${a % 30 === 0 ? '#E8E6E1' : '#6A6964'}"></path>`; }
  g.innerHTML = s;
}

// ---------- test presets (?shot=…) for screenshots ----------
function preset(name) {
  const at = (key, k = 3.2, side = 0.6, lift = 0.25) => {
    const b = BODIES.find((x) => x.key === key); const dir = SUN.clone().sub(b.pos).normalize();
    const side3 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    ship.pos.copy(b.pos).addScaledVector(dir.clone().multiplyScalar(Math.cos(side)).addScaledVector(side3, Math.sin(side)).setY(lift).normalize(), b.R * k);
    ship.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, b.pos.clone().addScaledVector(side3, b.R * 0.9), new THREE.Vector3(0, 1, 0)));
    flight.mode = 'manual'; flight.target = b; return b;
  };
  document.getElementById('mc').hidden = true;
  if (name.startsWith('planet-')) at(name.slice(7), 2.6, 1.15, 0.2);
  if (name.startsWith('night-')) at(name.slice(6), 2.6, 2.3, 0.2);
  if (name === 'cockpit') { at('ekatva', 6, 0.4, 0.1); toggleView(); }
  if (name === 'warp') { setLevel(3); flight.mode = 'manual'; ship.speed = 60000; ship.throttle = 1; flight.warp = 0.85; }
  if (name.startsWith('design-')) { setDesign(+name.slice(7)); at('ekatva', 2.4, 1.0, 0.1); flight.view = 'inspect'; clock.value = +(Q.get('a') || 2.2); }
  if (name === 'start') { /* the docked first view, overlay hidden */ }
  if (name === 'travel') { setCourse(BODIES[1]); flight.mode = 'travel'; flight.from.copy(ship.pos); flight.t = flight.T * 0.45; ship.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, BODIES[1].pos, new THREE.Vector3(0, 1, 0))); camInit = false; }
  if (name === 'mc') document.getElementById('mc').hidden = false;
  if (name.startsWith('surface-')) { const b = BODIES.find((x) => x.key === name.slice(8)); flight.target = b; fadeEl.style.transition = 'none';
    at(b.key, 1.75, 0.6, 0.2); flight.mode = 'orbit'; flight.rel = ship.pos.clone().sub(b.pos); flight.orbitR = b.Rmax * 1.75; flight.orbitAxis.set(0, 1, 0);
    siteAtElevation(b, +(Q.get('sun') ?? 35), !Q.has('am'));
    enterSurface(b).then(() => { const s = WORLD.surface; if (Q.has('landed') || Q.has('walk')) s.skipToLanded(+(Q.get('lx') || 0), +(Q.get('lz') || 0), +(Q.get('ly') || 0.3)); if (Q.has('walk')) { s.stepOut(); if (Q.has('drive')) { s.st.pos.copy(s.rover.pos); s.drive(); } s.st.pos.x += +(Q.get('dx') || 0); s.st.pos.z += +(Q.get('dz') || 0); } s.st.camYaw = +(Q.get('y') || 0.6); s.st.camPitch = +(Q.get('p') || 0.25); if (Q.has('cd')) s.st.camDist = +Q.get('cd'); if (Q.has('fly')) { s.st.lander.aglHold = +Q.get('fly'); s.st.lander.pos.y += +Q.get('fly'); } }); }
  if (name === 'inside') { enterInterior().then(() => { if (Q.has('y')) WORLD.interior.st.yaw = +Q.get('y'); }); }
  if (name === 'dockguide') { ship.pos.copy(BERTH.pos).addScaledVector(BERTH.dir, 110).add(new THREE.Vector3(4, 2, 0)); ship.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, BERTH.pos, WORLD_UP)); flight.mode = 'manual'; thrust.reset = true; }
  if (name.startsWith('landflow-')) { const b = BODIES.find((x) => x.key === name.slice(9)); at(b.key, 3, 0.6, 0.2); setCourse(b); flight.mode = 'travel'; flight.t = flight.T; setTimeout(() => startLanding(), 1500); }
  if (name.startsWith('orbit-')) { const b = BODIES.find((x) => x.key === name.slice(6)); at(b.key, 3, 0.6, 0.2); setCourse(b); flight.mode = 'travel'; flight.t = flight.T; }
  if (name === 'staror') { setCourse(STAR); flight.mode = 'travel'; flight.t = flight.T; }
  if (name === 'starclose') { ship.pos.set(0, 900, STAR_R * 2.3); ship.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, new THREE.Vector3(STAR_R * 0.5, 0, 0), WORLD_UP)); flight.mode = 'manual'; flight.target = STAR; }
  if (name === 'system') { ship.pos.set(30000, 70000, 160000); ship.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, new THREE.Vector3(0, 0, 0), WORLD_UP)); flight.mode = 'manual'; orbitLines.visible = true; camera.far = 3e6; }
  if (name === 'ringview') { // behind Cosmos, looking past it at the star
    const b = BODIES.find((x) => x.key === 'cosmos'); const away = b.pos.clone().normalize();
    ship.pos.copy(b.pos).addScaledVector(away, b.R * +(Q.get('k') || 5)).add(new THREE.Vector3(0, b.R * +(Q.get('h') || 0.6), b.R * +(Q.get('s') || 0.8)));
    ship.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, b.pos.clone().lerp(SUN, +(Q.get('l') || 0.0)), WORLD_UP)); flight.mode = 'manual'; flight.target = b; flight.view = Q.has('insp') ? 'inspect' : 'chase'; }
  if (name === 'ringinsp') { const b = BODIES.find((x) => x.key === 'cosmos'); const away = b.pos.clone().normalize(); flight.view = 'inspect'; document.body.classList.add('inspecting'); setSubject('cosmos'); insp.auto = false; insp.yaw = Math.atan2(away.x, away.z) + +(Q.get('dy') || 0); insp.pitch = +(Q.get('p') || 0.12); insp.zoom = +(Q.get('z') || 1); }
  if (name === 'ringstar') { // looking at the star through Cosmos's ring
    const b = BODIES.find((x) => x.key === 'cosmos'); b.ringMesh.updateMatrixWorld(true);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(b.ringMesh.quaternion); const toSun = SUN.clone().sub(b.pos).normalize();
    const P = b.pos.clone().addScaledVector(new THREE.Vector3().crossVectors(n, toSun).normalize(), b.R * +(Q.get('r') || 2.1));
    ship.pos.copy(P).addScaledVector(P.clone().sub(SUN).normalize(), +(Q.get('d') || 1500)); ship.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, SUN, WORLD_UP)); flight.mode = 'manual'; flight.target = b; }
  if (name === 'starview') { at('technova', 3, 0.0, 0.0); ship.pos.set(0, 1500, 9000); ship.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, new THREE.Vector3(), WORLD_UP)); }
  if (name === 'shapes') { flight.view = 'inspect'; document.body.classList.add('inspecting'); setSubject(Q.get('s') || 'arena'); }
  if (name === 'home') { ship.pos.copy(STATION.pos).add(new THREE.Vector3(800, 200, -3000)); flight.mode = 'manual'; thrust.reset = true; setCourse(STATION); }
  if (name === 'homefar') { flight.mode = 'manual'; ship.pos.copy(BODIES[1].pos).add(new THREE.Vector3(0, 0, 4000)); thrust.reset = true; setCourse(STATION); }
  if (name === 'undock') { startUndock(); flight.t = +(Q.get('t') || 3.2); thrust.reset = true; }
  if (name === 'approach') { ship.pos.copy(corridorPoint()); ship.quat.copy(dockPose().quat); flight.mode = 'dockApproach'; flight.from.copy(ship.pos); flight.t = +(Q.get('t') || 5); thrust.reset = true; }
  if (name.startsWith('inspect-')) { flight.view = 'inspect'; document.body.classList.add('inspecting'); setSubject(name.slice(8)); insp.zoom = +(Q.get('z') || 1); }
  if (name === 'rcs') { at('ekatva', 2.4, 1.0, 0.1); keys.add(Q.get('k') || 'KeyA'); flight.view = 'inspect'; document.body.classList.add('inspecting'); setSubject('vessel'); insp.yaw = +(Q.get('y') || 0.9); }
  if (name === 'station') { flight.view = 'inspect'; ship.pos.copy(STATION.pos).add(new THREE.Vector3(40, 20, -90)); ship.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(ship.pos, STATION.pos, new THREE.Vector3(0, 1, 0))); }
}

// ---------- loop, with adaptive resolution and graphics levels ----------
function sizePipeline(p) {
  p.r.setPixelRatio(pixelRatio); p.r.setSize(innerWidth, innerHeight, false);
  p.composer.setPixelRatio(pixelRatio); p.composer.setSize(innerWidth, innerHeight);
  const k = pixelRatio * GFX.t.bloomScale; p.bloom.setSize(Math.max(64, Math.round(innerWidth * k)), Math.max(64, Math.round(innerHeight * k)));
}
function resize() {
  if (WORLD.surface) WORLD.surface.resize(); if (WORLD.interior) WORLD.interior.resize();
  sizePipeline(space); if (ground) sizePipeline(ground);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
// a new level: resolution range, anti-aliasing, bloom and shadows change at once; ground detail on the surface too.
// Planet map sizes and terrain reach take effect on the next load or landing.
function applyTier(t) {
  pixelRatio = Math.min(devicePixelRatio, t.prMax);
  for (const p of [space, ground]) {
    if (!p) continue;
    p.bloom.enabled = t.bloom;
    for (const rt of [p.composer.renderTarget1, p.composer.renderTarget2]) if (rt.samples !== t.samples) { rt.samples = t.samples; rt.dispose(); }
  }
  sunLight.castShadow = t.shadows; if (sunLight.shadow.mapSize.x !== t.shadowMap) { sunLight.shadow.mapSize.set(t.shadowMap, t.shadowMap); if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; } }
  for (const b of BODIES) { const m = b.surf.material; const want = !!t.detail; if (!!m.defines.DETAIL !== want) { if (want) m.defines.DETAIL = 1; else delete m.defines.DETAIL; m.needsUpdate = true; } }
  if (WORLD.surface) WORLD.surface.setQuality(t);
  resize(); perf.slow = perf.fast = 0; perf.cool = 4;
}
GFX.onChange((t) => { applyTier(t); updateGfxLabel(); });
const gfxBtn = document.getElementById('btn-gfx');
function updateGfxLabel() { setText(gfxBtn, `Graphics: ${GFX.label()}${perf.fps ? ' · ' + perf.fps + ' fps' : ''} · P`); }
tap('btn-gfx', () => GFX.cycle());
// frame-time watch: lower the resolution when frames run long, raise it again when there is headroom;
// in Auto, drop a whole level if even the lowest resolution of this one is too slow
const perf = { ema: 16, best: 16, t: 0, slow: 0, fast: 0, cool: 3, fps: 0, n: 0, acc: 0, lbl: 0 };
function watchFrames(raw, dt) {
  if (raw > 250 || document.hidden) return; // a hitch or a background tab says nothing about steady speed
  perf.ema = perf.ema * 0.92 + raw * 0.08; perf.best = Math.min(perf.best * 1.0005 + 0.0005, perf.ema);
  perf.n++; perf.acc += raw; perf.lbl += dt;
  if (perf.lbl > 0.5) { perf.fps = Math.round(1000 / (perf.acc / perf.n)); perf.n = perf.acc = perf.lbl = 0; updateGfxLabel(); }
  perf.t += dt; perf.cool -= dt;
  if (perf.t < 1.2 || Q.has('shot') || WORLD.busy) return;
  perf.t = 0;
  const t = GFX.t, budget = 1000 / 55; // aim to hold at least ~55 fps
  if (perf.ema > budget) { perf.slow++; perf.fast = 0; } else if (perf.ema < Math.max(perf.best * 1.15, 9)) { perf.fast++; perf.slow = 0; } else { perf.slow = perf.fast = 0; }
  const cap = Math.min(devicePixelRatio, t.prMax);
  if (perf.slow >= 2) {
    perf.slow = 0; perf.cool = 8;
    if (pixelRatio > t.prMin + 0.01) { pixelRatio = Math.max(t.prMin, pixelRatio * (perf.ema > budget * 1.5 ? 0.8 : 0.9)); resize(); }
    else if (GFX.stepDown()) { /* applyTier runs from the listener */ }
  } else if (perf.fast >= 4 && perf.cool <= 0 && pixelRatio < cap - 0.01) {
    perf.fast = 0; pixelRatio = Math.min(cap, pixelRatio + 0.1); resize();
  }
}
const pipeline = () => (WORLD.mode === 'surface' && ground ? ground : space);
if (Q.has('shot')) window.__dbg = { get world() { return WORLD; }, get info() { const r = pipeline().r.info.render; return { calls: r.calls, tris: r.triangles, pr: pixelRatio, tier: GFX.key, mode: WORLD.mode, loading: WORLD.surface ? WORLD.surface.loading : 0 }; } };
setLevel(1); applyLuna(); updateGfxLabel();
// ---------- touch: the controls on screen follow what you are doing ----------
const touchAxes = { x: 0, y: 0 };
function tapKey(code) { dispatchEvent(new KeyboardEvent('keydown', { code })); setTimeout(() => { keys.delete(code); }, 120); }
function touchContext() {
  const none = { stick: null, throttle: null, holds: [], actions: [], more: [] };
  if (!document.getElementById('mc').hidden || WORLD.busy) return none;
  const common = [{ label: 'Sound', code: 'KeyN' }, { label: 'Graphics', code: 'KeyP' }], labels = { label: 'Labels', code: 'KeyM' };
  if (WORLD.mode === 'interior') return { ...none, stick: 'Walk', holds: [{ label: 'Sprint', code: 'ShiftLeft', toggle: true }], actions: [{ label: 'Back to the vessel', code: 'KeyI', primary: true }], more: common };
  if (WORLD.mode === 'surface') {
    const s = WORLD.surface, st = s.st, L = st.lander, leave = { label: 'Leave the planet', code: 'KeyT' };
    if (st.phase === 'descent') return { ...none, stick: 'Take over', more: [labels, ...common] };
    if (st.phase === 'ascent') return { ...none, more: common };
    if (st.phase === 'pilot') return { ...none, stick: 'Fly', holds: [{ label: 'Up', code: 'Space' }, { label: 'Down', code: 'ShiftLeft' }, { label: 'Boost', code: 'KeyR' }],
      actions: [L.landed && { label: 'Step out', code: 'KeyE', primary: true }, leave].filter(Boolean), more: [labels, ...common] };
    if (st.phase === 'walk') return { ...none, stick: 'Move', holds: [{ label: 'Jump', code: 'Space' }, { label: 'Sprint', code: 'ShiftLeft', toggle: true }],
      actions: [st.nearRover && { label: 'Get in', code: 'KeyE', primary: true }, st.nearLander && !st.nearRover && { label: 'Board the lander', code: 'KeyE', primary: true },
        s.roverOut && st.roverFar && { label: 'Call the rover', code: 'KeyF' }, !st.nearLander && { label: 'To the lander', code: 'KeyB' }].filter(Boolean),
      more: [leave, labels, ...common] };
    if (st.phase === 'drive') return { ...none, stick: 'Drive', holds: [{ label: 'Brake', code: 'Space' }, { label: 'Boost', code: 'ShiftLeft', toggle: true }],
      actions: [{ label: 'Get out', code: 'KeyE', primary: true }, { label: 'To the lander', code: 'KeyB' }], more: [leave, labels, ...common] };
    return none;
  }
  const m = flight.mode;
  const view = [{ label: flight.view === 'cockpit' ? 'Chase view' : 'Cockpit view', code: 'KeyC' }, { label: 'Inspect', code: 'KeyV' }, { label: 'Orbit paths', code: 'KeyO' }, ...common];
  if (flight.view === 'inspect') return { ...none, actions: [{ label: 'Next', code: 'Tab' }, { label: 'Zoom +', run: () => { insp.zoom = Math.max(0.35, insp.zoom * 0.8); } }, { label: 'Zoom −', run: () => { insp.zoom = Math.min(4, insp.zoom * 1.25); } }, { label: 'Back to flight', code: 'KeyV', primary: true }] };
  if (m === 'docked') return { ...none, actions: [{ label: 'Undock', code: 'KeyU', primary: true }, { label: 'Go inside', code: 'KeyI' }], more: view };
  if (m === 'undock' || m === 'dockAlign' || m === 'dockApproach') return { ...none, more: view };
  if (m === 'travel' || m === 'align') return { ...none, actions: [{ label: 'Cancel course', code: 'Escape' }], more: view };
  if (m === 'orbit') return { ...none, actions: [flight.target && !flight.target.star && { label: 'Land', code: 'KeyG', primary: true }, { label: 'Leave orbit', run: () => { leaveAuto(); ship.throttle = Math.max(ship.throttle, 0.25); } }, { label: 'Mission Control', code: 'KeyH' }].filter(Boolean), more: view };
  const nearStation = ship.pos.distanceTo(STATION.pos) < 3000;
  return { stick: 'Steer', throttle: { get: () => ship.throttle, set: (v) => { if (v > 0.02) leaveAuto(); ship.throttle = v; } },
    holds: [{ label: 'Brake', code: 'Space' }, { label: 'Roll ◁', code: 'KeyQ' }, { label: 'Roll ▷', code: 'KeyE' }],
    actions: [nearStation ? { label: 'Dock', code: 'KeyG', primary: true } : { label: 'Mission Control', code: 'KeyH' }, flight.target && { label: 'Cancel course', code: 'Escape' }].filter(Boolean), more: view };
}
createTouch({ keys, axes: touchAxes, tap: tapKey, context: touchContext });
// the planets' maps are rendered at load, a little at a time
const loadEl = document.getElementById('loading');
for (const b of BODIES) { b.group.visible = false; b.atmo.visible = false; if (b.ringMesh) b.ringMesh.visible = false; if (b.moonGroup) b.moonGroup.visible = false; }
const baked = bakeAll([...BODIES, ...BODIES.filter((b) => b.moonGroup).map((b) => b.moon)], (k, what) => { if (loadEl) loadEl.textContent = `Preparing the worlds · ${Math.round(k * 100)}%` + (Q.has('shot') ? ' ' + what : ''); }).then(() => {
  for (const b of BODIES) { b.group.visible = true; b.atmo.visible = true; if (b.ringMesh) b.ringMesh.visible = true; if (b.moonGroup) b.moonGroup.visible = true; }
  if (loadEl) loadEl.hidden = true; document.body.classList.add('baked');
});
if (Q.has('shot')) baked.then(() => preset(Q.get('shot')));
if (Q.has('hold')) baked.then(() => setTimeout(() => Q.get('hold').split(',').forEach((k) => keys.add(k)), +(Q.get('after') || 2500)));
if (Q.has('sim')) { // advance the simulation without rendering, logging every mode change (test only)
  let last = '';
  for (let i = 0; i < +Q.get('sim'); i++) {
    step(1 / 30); measureThrust(1 / 30);
    const k = flight.mode + (flight.target ? ':' + flight.target.key : '');
    if (k !== last) { console.log('SIM', (i / 30).toFixed(1), k, ship.pos.distanceTo(dockPose().pos).toFixed(1)); last = k; }
  }
  console.log('SIM end', flight.mode, ship.pos.distanceTo(dockPose().pos).toFixed(2));
}
let lastT = performance.now(), frameN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = now - lastT; lastT = now;
  const dt = THREE.MathUtils.clamp(raw / 1000, 0.001, 0.05) * (+(Q.get('ts') || 1));
  watchFrames(raw, dt);
  const k = (c) => (keys.has(c) ? 1 : 0);
  if (WORLD.mode === 'surface') {
    const s = WORLD.surface; advanceSystem(dt); s.setSun(siteSun());
    const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const cl = (v) => THREE.MathUtils.clamp(v, -1, 1);
    s.update(dt, { fwd: cl(k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown') - touchAxes.y), side: cl(k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft') + touchAxes.x), turn: cl(k('KeyD') - k('KeyA') + touchAxes.x), strafe: k('ArrowRight') - k('ArrowLeft'),
      up: keys.has('Space'), down: shift, run: shift, jump: keys.has('Space'), boost: keys.has('KeyR'), dragging: drag.on });
    if (s.st.done && !WORLD.busy) leaveSurface();
    updateWorldHUD();
  } else if (WORLD.mode === 'interior') {
    advanceSystem(dt);
    WORLD.interior.update(dt, { fwd: THREE.MathUtils.clamp(k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown') - touchAxes.y, -1, 1), side: THREE.MathUtils.clamp(k('KeyD') - k('KeyA') + touchAxes.x, -1, 1), turn: k('ArrowRight') - k('ArrowLeft'), run: keys.has('ShiftLeft') || keys.has('ShiftRight') });
    updateWorldHUD();
  } else {
    if (!drag.on && (touchAxes.x || touchAxes.y || document.body.classList.contains('touch'))) { drag.dx = touchAxes.x; drag.dy = touchAxes.y; }
    step(dt); measureThrust(dt); updateSeparation(dt); updateCamera(dt); updateStreaks(dt, ship.speed, flight.warp);
    animateVessel(ship.mesh, thrust.main, thrust.torque, thrust.force, clock.value, flight.warp);
    adaptToStar(camera.position);
    updateMarkers(); updateHUD(); updateDockGuide(); updateStarCard();
  }
  updateLuna(dt); updateAudio();
  { const P = pipeline(); P.r.info.autoReset = false; P.r.info.reset(); P.composer.render(dt); }
  if (Q.has('debug') && WORLD.mode === 'surface' && (frameN = (frameN || 0) + 1) % 10 === 0) { const L = WORLD.surface.st.lander; console.log('LND', WORLD.surface.st.phase, L.agl.toFixed(1), L.vel.toArray().map((v) => v.toFixed(1)).join(','), L.thrust.toFixed(2), L.landed, L.contact, L.msg); }
  if (Q.has('debug') && WORLD.mode === 'space' && (frameN = (typeof frameN === 'number' ? frameN : 0) + 1) % 2 === 0) console.log('DBG', flight.mode, flight.t.toFixed(2), thrust.main.toFixed(2), thrust.torque.toArray().map((v) => v.toFixed(2)).join(','), thrust.force.toArray().map((v) => v.toFixed(2)).join(','), (ship.mesh.userData.jets || []).length, (ship.mesh.userData.jets || []).map((j) => j.f.material.opacity.toFixed(1)).join(''));
}
requestAnimationFrame(frame);
