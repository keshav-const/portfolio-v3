// Streamed terrain for the planet surfaces: detailed chunks around you, a coarse skirt out to the horizon,
// GPU grass and flowers, and scattered trees and rocks. Heights and placement are computed in a worker
// (terrain-worker.js), so streaming never stalls a frame. Throwaway sketch code.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vnoise } from './noise.js';
export { hash, vnoise, fbm, ss, lerp, ridge, craters } from './noise.js';

// ---------- GLSL noise (2D, integer hash: stable far from the origin) ----------
export const GLNOISE2 = /* glsl */`
float h2(vec2 p){ uvec2 q = uvec2(ivec2(floor(p))) * uvec2(1597334673U, 3812015801U); uint n = (q.x ^ q.y) * 1597334673U; return float(n) * 2.3283064e-10; }
float vn2(vec2 p){ vec2 i = floor(p), f = p - i; vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1.0,0.0)), u.x), mix(h2(i+vec2(0.0,1.0)), h2(i+vec2(1.0,1.0)), u.x), u.y); }
float fb2(vec2 p, int o){ float a=0.5, s=0.0, n=0.0; for(int k=0;k<7;k++){ if(k>=o) break; s+=a*vn2(p); n+=a; p = mat2(1.6,1.2,-1.2,1.6)*p + 17.3; a*=0.5; } return s/n; }
`;

export const CHUNK = 160, CSEG = 64, CELL = CHUNK / CSEG;
const FAR_HALF = 12000;
const ITEM = 25; // floats per scattered item (see terrain-worker.js)
const ck = (i, j) => (i + 2048) * 4096 + (j + 2048);
const md = (a, n) => ((a % n) + n) % n;

// ---------- a small pool of workers that build chunks and tiles ----------
export function createPool(key, n = 2) {
  const workers = [], waiting = new Map(); let next = 0, id = 0;
  for (let k = 0; k < n; k++) {
    const w = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => { const r = waiting.get(data.id); if (r) { waiting.delete(data.id); r(data); } };
    w.onerror = (e) => { console.error('terrain worker', e.message || e); setTimeout(() => { throw new Error('terrain worker: ' + (e.message || 'failed to load')); }); };
    w.postMessage({ type: 'init', key, cell: CELL }); workers.push(w);
  }
  return {
    run(msg) { return new Promise((res) => { msg.id = ++id; waiting.set(msg.id, res); workers[next++ % workers.length].postMessage(msg); }); },
    dispose() { workers.forEach((w) => w.terminate()); waiting.clear(); },
  };
}

// ---------- terrain material: colour and fine relief are computed per pixel from world position ----------
function terrainMaterial(W, far, hole, time, q) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHole = hole; sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aMask; varying vec3 vMask; varying vec3 vWPos; varying vec3 vWNrm; uniform vec3 uHole;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vMask = aMask; vWNrm = normal;
${far ? 'transformed.y -= 1.5; vec2 dd = abs(position.xz - uHole.xy); if (max(dd.x, dd.y) < uHole.z) transformed.y -= 60.0;' : ''}
vWPos = transformed;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vMask; varying vec3 vWPos; varying vec3 vWNrm; uniform float uTime;
${GLNOISE2}
${W.glsl}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float tDist = length(vWPos - cameraPosition);
float tRough = 0.9;
vec3 tN = normalize(vWNrm);
diffuseColor.rgb *= albedo(vWPos, tN, vMask, tDist, tRough);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
${q.relief > 0 && !far ? `{ // fine relief that the mesh is too coarse to carry, faded out with distance
  float k = 1.0 - smoothstep(${(q.relief * 0.2).toFixed(1)}, ${q.relief.toFixed(1)}, tDist);
  if (k > 0.001) {
    vec2 p = vWPos.xz; float e = 0.12;
    float h0 = relief(p, vMask), hx = relief(p + vec2(e, 0.0), vMask), hz = relief(p + vec2(0.0, e), vMask);
    vec3 g = vec3((hx - h0) / e, 0.0, (hz - h0) / e) * k;
    vec3 wn = normalize(tN - g);
    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  }
}` : ''}`);
  };
  m.customProgramCacheKey = () => 'terrain-' + W.name + (far ? '-far' : '') + q.relief;
  return m;
}

// ---------- the terrain ----------
// q: { crad (chunks each side), farSeg, relief (metres; 0 = off), inflight }
export function createTerrain(scene, W, renderer, pool, q) {
  const CRAD = q.crad, NT = CSEG * (2 * CRAD + 1);
  const hole = { value: new THREE.Vector3(0, 0, -1) }, time = { value: 0 };
  const matNear = terrainMaterial(W, false, hole, time, q), matFar = terrainMaterial(W, true, hole, time, q);
  // the height-and-cover map around you (toroidal), read by the grass and flowers on the GPU and by heightAt
  const hm = new Float32Array(NT * NT * 4);
  const hmTex = new THREE.DataTexture(hm, NT, NT, THREE.RGBAFormat, THREE.FloatType);
  hmTex.minFilter = hmTex.magFilter = THREE.NearestFilter; hmTex.needsUpdate = true;
  renderer.initTexture(hmTex);
  const gl = renderer.getContext();
  function upload(ci, cj, patch) {
    const tx0 = md(ci * CSEG, NT), tz0 = md(cj * CSEG, NT);
    for (let r = 0; r < CSEG; r++) hm.set(patch.subarray(r * CSEG * 4, (r + 1) * CSEG * 4), ((tz0 + r) * NT + tx0) * 4);
    const t = renderer.properties.get(hmTex).__webglTexture;
    if (!t) { hmTex.needsUpdate = true; return; }
    renderer.state.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, tx0, tz0, CSEG, CSEG, gl.RGBA, gl.FLOAT, patch);
  }
  function geometry(r, n) {
    const idx = new Uint32Array((n - 1) * (n - 1) * 6); let k = 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = (j + 1) * n + i, c = (j + 1) * n + i + 1, d = j * n + i + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = a; idx[k++] = c; idx[k++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(r.nrm, 3)); g.setAttribute('aMask', new THREE.BufferAttribute(r.msk, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    return g;
  }

  let far = null;
  const farReady = pool.run({ type: 'grid', x0: -FAR_HALF, z0: -FAR_HALF, cell: FAR_HALF * 2 / q.farSeg, seg: q.farSeg, near: false }).then((r) => {
    far = new THREE.Mesh(geometry(r, q.farSeg + 1), matFar); far.receiveShadow = true; scene.add(far);
  });

  const chunks = new Map(), slots = new Map(), pending = new Set(); let region = null, target = null, queue = [], disposed = false;
  function place(i, j, r) {
    pending.delete(ck(i, j));
    if (disposed || !target || Math.abs(i - target.fi) > CRAD || Math.abs(j - target.fj) > CRAD || chunks.has(ck(i, j))) return;
    const s = md(i, 2 * CRAD + 1) * 64 + md(j, 2 * CRAD + 1), old = slots.get(s);
    if (old !== undefined && chunks.has(old)) { const m = chunks.get(old); scene.remove(m); m.geometry.dispose(); chunks.delete(old); }
    const m = new THREE.Mesh(geometry(r, CSEG + 1), matNear); m.receiveShadow = true; scene.add(m);
    chunks.set(ck(i, j), m); slots.set(s, ck(i, j)); m.userData.ij = [i, j];
    upload(i, j, r.hm);
  }
  function update(focus) {
    const fi = Math.floor(focus.x / CHUNK), fj = Math.floor(focus.z / CHUNK);
    if (!target || target.fi !== fi || target.fj !== fj) {
      target = { fi, fj }; queue = [];
      for (let i = fi - CRAD; i <= fi + CRAD; i++) for (let j = fj - CRAD; j <= fj + CRAD; j++) if (!chunks.has(ck(i, j))) queue.push([i, j, Math.hypot(i - fi, j - fj)]);
      queue.sort((a, b) => a[2] - b[2]);
    }
    while (queue.length && pending.size < q.inflight) {
      const [i, j] = queue.shift(); const k = ck(i, j); if (chunks.has(k) || pending.has(k)) continue;
      pending.add(k); pool.run({ type: 'grid', x0: i * CHUNK, z0: j * CHUNK, cell: CELL, seg: CSEG, near: true }).then((r) => place(i, j, r));
    }
    if (!queue.length && !pending.size && (!region || region.fi !== target.fi || region.fj !== target.fj)) {
      region = target;
      for (const [k, m] of chunks) { const [i, j] = m.userData.ij; if (Math.abs(i - fi) > CRAD || Math.abs(j - fj) > CRAD) { scene.remove(m); m.geometry.dispose(); chunks.delete(k); } }
      hole.value.set((fi + 0.5) * CHUNK, (fj + 0.5) * CHUNK, (CRAD + 0.5) * CHUNK - 70);
    }
  }
  // height exactly as the mesh draws it (two triangles per 2.5 m cell); read from the map when the chunk is in
  const loaded = (gx, gz) => chunks.has(ck(Math.floor(gx / CSEG), Math.floor(gz / CSEG)));
  const hAt = (gx, gz) => (loaded(gx, gz) ? hm[(md(gz, NT) * NT + md(gx, NT)) * 4] : W.h(gx * CELL, gz * CELL));
  function heightAt(x, z) {
    const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL), fx = x / CELL - gx, fz = z / CELL - gz;
    const h00 = hAt(gx, gz), h11 = hAt(gx + 1, gz + 1);
    if (fz >= fx) { const h01 = hAt(gx, gz + 1); return h00 + fx * (h11 - h01) + fz * (h01 - h00); }
    const h10 = hAt(gx + 1, gz); return h00 + fx * (h10 - h00) + fz * (h11 - h10);
  }
  function normalAt(x, z, e = 1.2) {
    const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    return new THREE.Vector3(-dx, 1, -dz).normalize();
  }
  // resolves once the horizon and the ground round the focus are in
  async function ready(focus, ring = 1) {
    update(focus); await farReady;
    const fi = Math.floor(focus.x / CHUNK), fj = Math.floor(focus.z / CHUNK);
    for (let n = 0; n < 400; n++) {
      update(focus); let ok = true;
      for (let i = fi - ring; i <= fi + ring && ok; i++) for (let j = fj - ring; j <= fj + ring; j++) if (!chunks.has(ck(i, j))) { ok = false; break; }
      if (ok) return; await new Promise((r) => setTimeout(r, 25));
    }
  }
  return {
    update, heightAt, normalAt, hmTex, time, NT, ready,
    get busy() { return queue.length + pending.size; },
    dispose() { disposed = true; for (const m of chunks.values()) m.geometry.dispose(); if (far) far.geometry.dispose(); hmTex.dispose(); matNear.dispose(); matFar.dispose(); },
  };
}

// ---------- grass and flowers: instanced on a grid that follows the camera, heights read from the map ----------
function tuftGeometry({ blades = 3, segs = 3, height = 0.6, width = 0.06, lean = 0.18, spread = 0.22, head = 0 }) {
  const pos = [], aT = [], aH = [], idx = []; let v = 0;
  const R = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let b = 0; b < blades; b++) {
    const a = R() * Math.PI * 2, ox = (R() - 0.5) * spread, oz = (R() - 0.5) * spread, hh = height * (0.7 + R() * 0.5), ca = Math.cos(a), sa = Math.sin(a);
    const lx = Math.cos(a + 1.3) * lean, lz = Math.sin(a + 1.3) * lean;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, w = width * (1 - t ** 1.4) * 0.5 + 0.002;
      const cx = ox + lx * t * t, cz = oz + lz * t * t, y = t * hh;
      pos.push(cx - ca * w, y, cz - sa * w, cx + ca * w, y, cz + sa * w); aT.push(t, t); aH.push(0, 0);
      if (s < segs) idx.push(v, v + 1, v + 3, v, v + 3, v + 2);
      v += 2;
    }
    if (head) { // a small cross of petals at the tip
      const tx = ox + lx, tz = oz + lz, y = hh;
      for (const [dx, dz] of [[1, 0], [0, 1]]) {
        pos.push(tx - dx * head, y - head * 0.4, tz - dz * head, tx + dx * head, y - head * 0.4, tz + dz * head, tx + dx * head, y + head * 0.9, tz + dz * head, tx - dx * head, y + head * 0.9, tz - dz * head);
        aT.push(1, 1, 1, 1); aH.push(1, 1, 1, 1); idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
      }
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1)); g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setIndex(idx); return g;
}
export function createCover(scene, terrain, o) {
  const G = Math.ceil((o.radius * 2) / o.spacing);
  const geo = tuftGeometry(o.tuft); geo.instanceCount = G * G;
  const U = {
    uHM: { value: terrain.hmTex }, uOrigin: { value: new THREE.Vector2() }, uSp: { value: o.spacing }, uCam: { value: new THREE.Vector3() }, uRad: { value: o.radius },
    uTime: terrain.time, uWind: { value: new THREE.Vector2(o.wind[0], o.wind[1]) }, uWindK: { value: o.windK },
    uBase: { value: new THREE.Color(...o.base) }, uTip: { value: new THREE.Color(...o.tip) }, uPal: { value: (o.pal || [[1, 1, 1]]).concat([[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]).slice(0, 4).map((c) => new THREE.Color(...c)) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uHM; uniform vec2 uOrigin; uniform float uSp; uniform vec3 uCam; uniform float uRad; uniform float uTime; uniform vec2 uWind; uniform float uWindK;
uniform vec3 uBase; uniform vec3 uTip; uniform vec3 uPal[4];
attribute float aT; attribute float aH; varying vec3 vGCol;
float gh(vec2 p){ uvec2 q = uvec2(ivec2(floor(p))) * uvec2(1597334673U, 3812015801U); uint n = (q.x ^ q.y) * 1597334673U; return float(n) * 2.3283064e-10; }
vec4 hmAt(vec2 xz){ vec2 g = xz / ${CELL.toFixed(3)}; vec2 i = floor(g), f = g - i;
  ivec2 a = ivec2(mod(i, ${terrain.NT}.0)), b = ivec2(mod(i + 1.0, ${terrain.NT}.0));
  vec4 h00 = texelFetch(uHM, ivec2(a.x, a.y), 0), h10 = texelFetch(uHM, ivec2(b.x, a.y), 0), h01 = texelFetch(uHM, ivec2(a.x, b.y), 0), h11 = texelFetch(uHM, ivec2(b.x, b.y), 0);
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y); }`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `
int gi = gl_InstanceID % ${G}, gj = gl_InstanceID / ${G};
vec2 cell = uOrigin + vec2(float(gi), float(gj));
float r1 = gh(cell + 0.5), r2 = gh(cell + 71.3), r3 = gh(cell + 13.7), r4 = gh(cell + 29.1), r5 = gh(cell + 53.9);
vec2 wp = (cell + vec2(r1, r2)) * uSp;
vec4 hm = hmAt(wp);
float dens = hm.${o.channel};
float dcam = length(wp - uCam.xz);
float keep = step(r3, dens) * (1.0 - smoothstep(uRad * 0.6, uRad, dcam));
float sc = keep * (0.6 + 0.8 * r4) * (0.75 + 0.25 * dens);
float an = r5 * 6.2831; float ca = cos(an), sa = sin(an);
vec3 lp = position * sc; lp.xz = mat2(ca, -sa, sa, ca) * lp.xz;
float gust = 0.55 + 0.45 * sin(uTime * 0.42 + wp.x * 0.021 + wp.y * 0.013);
float wv = (0.55 + 0.45 * sin(uTime * 2.3 + wp.x * 0.37 + wp.y * 0.23 + r4 * 3.0)) * gust * uWindK;
lp.xz += uWind * wv * aT * aT * sc;
lp.y *= 1.0 - 0.25 * wv * aT;
vec3 transformed = vec3(wp.x, hm.x - 0.04, wp.y) + lp;
vec3 tint = mix(vec3(0.82), vec3(1.15), hm.w) * (0.85 + 0.3 * r1);
vGCol = aH > 0.5 ? uPal[int(r2 * 3.999)] * (0.8 + 0.4 * r4) : mix(uBase, uTip, aT) * tint;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGCol;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vGCol;');
  };
  mat.customProgramCacheKey = () => 'cover-' + o.channel + G;
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.receiveShadow = true; scene.add(mesh);
  return {
    mesh,
    update(cam) { U.uCam.value.copy(cam); U.uOrigin.value.set(Math.floor(cam.x / o.spacing) - G / 2, Math.floor(cam.z / o.spacing) - G / 2); },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// ---------- trees, rocks and the like: placed in tiles by the worker, drawn in two levels of detail ----------
// Three bands: full models that cast shadows (inside q.lod[0]), light models (to q.lod[1]), very light ones
// (to q.drawFar). Beyond that, nothing.
const TILE = 256;
export function windify(m, k, wind) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.time; sh.uniforms.uWind = wind.amount;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      float gust = 0.6 + 0.4*sin(uTime*0.35 + ip.x*0.01);
      float w = (sin(uTime*1.7 + ip.x*0.17 + ip.y*0.13) + 0.45*sin(uTime*3.1 + ip.x*0.5)) * gust;
      float hh = max(position.y, 0.0);
      transformed.x += w * uWind * hh * hh * ${k.toFixed(4)}; transformed.z += w * uWind * hh * hh * ${(k * 0.6).toFixed(4)};`);
  };
  m.customProgramCacheKey = () => 'wind' + k;
  return m;
}
// defs[di] = { variants: [{ lods: [[{geo, mat, tint}], [...], [...]] }], cap, shadow }; q = { tiles, lod: [near, mid], drawFar, shadows }
export function createScatter(scene, defs, pool, q) {
  const tiles = new Map(), pending = new Set(); let centre = null, queue = [], dirty = false, disposed = false;
  const lastFocus = new THREE.Vector3(1e9, 0, 0);
  const mk = (p, cap, shadow) => { const m = new THREE.InstancedMesh(p.geo, p.mat, cap); m.count = 0; m.castShadow = shadow && q.shadows; m.userData.shadow = shadow; m.receiveShadow = true; m.frustumCulled = false; m.userData.tint = p.tint !== false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };
  const bands = [0, 1, 2].map((b) => defs.map((d) => d.variants.map((v) => v.lods[Math.min(b, v.lods.length - 1)].map((p) => mk(p, d.cap, b === 0 && !!d.shadow)))));
  for (const set of bands) for (const vs of set) for (const parts of vs) for (const im of parts) { im.setColorAt(0, new THREE.Color(1, 1, 1)); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
  const near = bands[0];
  const tk = (i, j) => (i + 2048) * 4096 + (j + 2048);

  function rebuild(f) {
    const cnts = bands.map((set) => set.map((vs) => vs.map(() => 0)));
    const n2 = q.lod[0] * q.lod[0], m2 = q.lod[1] * q.lod[1], f2 = q.drawFar * q.drawFar;
    for (const t of tiles.values()) for (let o = 0; o < t.length; o += ITEM) {
      const dx = t[o + 21] - f.x, dz = t[o + 22] - f.z, d2 = dx * dx + dz * dz; if (d2 > f2) continue;
      const di = t[o], v = t[o + 1], b = d2 < n2 ? 0 : d2 < m2 ? 1 : 2, set = bands[b], cnt = cnts[b];
      const k = cnt[di][v]; if (k >= defs[di].cap) continue;
      for (const im of set[di][v]) {
        im.instanceMatrix.array.set(t.subarray(o + 2, o + 18), k * 16);
        const c = im.instanceColor.array; if (im.userData.tint) { c[k * 3] = t[o + 18]; c[k * 3 + 1] = t[o + 19]; c[k * 3 + 2] = t[o + 20]; } else { c[k * 3] = c[k * 3 + 1] = c[k * 3 + 2] = 1; }
      }
      cnt[di][v] = k + 1;
    }
    const flush = (set, cnt) => set.forEach((vs, di) => vs.forEach((parts, v) => parts.forEach((im) => {
      im.count = cnt[di][v];
      im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, Math.max(1, im.count) * 16); im.instanceMatrix.needsUpdate = true;
      im.instanceColor.clearUpdateRanges(); im.instanceColor.addUpdateRange(0, Math.max(1, im.count) * 3); im.instanceColor.needsUpdate = true;
    })));
    bands.forEach((set, b) => flush(set, cnts[b])); lastFocus.copy(f);
  }
  function update(focus) {
    const fi = Math.floor(focus.x / TILE), fj = Math.floor(focus.z / TILE), TR = q.tiles;
    if (!centre || centre.fi !== fi || centre.fj !== fj) {
      centre = { fi, fj }; queue = [];
      for (const k of [...tiles.keys()]) { const i = Math.floor(k / 4096) - 2048, j = (k % 4096) - 2048; if (Math.abs(i - fi) > TR + 1 || Math.abs(j - fj) > TR + 1) { tiles.delete(k); dirty = true; } }
      for (let i = fi - TR; i <= fi + TR; i++) for (let j = fj - TR; j <= fj + TR; j++) if (!tiles.has(tk(i, j))) queue.push([i, j, Math.hypot(i - fi, j - fj)]);
      queue.sort((a, b) => a[2] - b[2]);
    }
    while (queue.length && pending.size < 3) {
      const [i, j] = queue.shift(); const k = tk(i, j); if (tiles.has(k) || pending.has(k)) continue;
      pending.add(k);
      pool.run({ type: 'tile', ti: i, tj: j, size: TILE }).then((r) => { pending.delete(k); if (disposed) return; if (Math.abs(i - centre.fi) <= TR + 1 && Math.abs(j - centre.fj) <= TR + 1) { tiles.set(k, r.items); dirty = true; } });
    }
    // re-sort into near and far as you move (cheap: a pass over typed arrays)
    const moved = (focus.x - lastFocus.x) ** 2 + (focus.z - lastFocus.z) ** 2 > 18 * 18;
    if (dirty || moved) { rebuild(focus); dirty = false; }
  }
  // push a body out of anything solid nearby (trunks, boulders)
  function collide(p, rad, y) {
    const fi = Math.floor(p.x / TILE), fj = Math.floor(p.z / TILE);
    for (let i = fi - 1; i <= fi + 1; i++) for (let j = fj - 1; j <= fj + 1; j++) {
      const t = tiles.get(tk(i, j)); if (!t) continue;
      for (let o = 0; o < t.length; o += ITEM) {
        const r = t[o + 23]; if (!r || (y !== undefined && y > t[o + 24])) continue;
        const dx = p.x - t[o + 21], dz = p.z - t[o + 22], m = r + rad; if (Math.abs(dx) > m || Math.abs(dz) > m) continue;
        const d = Math.hypot(dx, dz); if (d < m) { const s = m / Math.max(d, 1e-3); p.x = t[o + 21] + dx * s; p.z = t[o + 22] + dz * s; }
      }
    }
  }
  function setQuality(nq) { q = nq; for (const vs of near) for (const parts of vs) for (const im of parts) im.castShadow = !!im.userData.shadow && q.shadows; dirty = true; }
  return { update, collide, setQuality, get busy() { return queue.length + pending.size; }, dispose() { disposed = true; bands.flat(3).forEach((m) => { scene.remove(m); m.dispose(); }); } };
}

// ---------- models for the scatter ----------
// ---------- models for the scatter ----------
function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  const R = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, r = R() ** 0.6 * 100, px = 128 + Math.cos(a) * r, py = 128 + Math.sin(a) * r;
    const v = 150 + R() * 105; x.fillStyle = `rgb(${v},${v},${v})`;
    x.save(); x.translate(px, py); x.rotate(R() * Math.PI); x.beginPath(); x.ellipse(0, 0, 7 + R() * 9, 3 + R() * 4, 0, 0, Math.PI * 2); x.fill(); x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let _leaf = null;
const leaf = () => _leaf || (_leaf = leafTexture());
function jsn3(x, y, z, s) { return (vnoise(x + z * 0.71, y + 3.1, s) + vnoise(z - y * 0.53, x + 1.7, s + 9)) * 0.5; }
function blob(r, detail, seed, rough = 0.35) {
  const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = v.clone().normalize();
    const k = 1 + (jsn3(n.x * 2.2, n.y * 2.2, n.z * 2.2, seed) - 0.5) * rough * 2 + (jsn3(n.x * 6, n.y * 6, n.z * 6, seed + 3) - 0.5) * rough * 0.6;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const m = mergeVertices(g); m.computeVertexNormals(); return m;
}
// merge parts into one indexed geometry (indexed keeps the vertex count down: each vertex is shaded once)
function finish(geos) {
  const parts = geos.map((g0) => {
    const g = g0.index ? g0 : (() => { const n = g0.attributes.position.count; g0.setIndex(Array.from({ length: n }, (_, i) => i)); return g0; })();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  return mergeGeometries(parts, false);
}
// a broadleaf tree: bent trunk, a few limbs, a dense core and leaf cards round it; plus a light far version
export function treeModels(kind, nVar = 3) {
  const out = [];
  for (let v = 0; v < nVar; v++) {
    const R = (() => { let s = 31 + v * 977 + (kind === 'parasol' ? 5000 : 0); return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const H = kind === 'parasol' ? 7.5 + R() * 2 : 6 + R() * 2.5;
    const bend = (R() - 0.5) * 0.9;
    const trunkG = (radial, rows) => { const t = new THREE.CylinderGeometry(0.16, 0.34, H, radial, rows, true); t.translate(0, H / 2, 0); const tp = t.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), k = y / H; tp.setX(i, tp.getX(i) + bend * k * k); } t.computeVertexNormals(); return t; };
    const wood = [trunkG(8, 6)];
    const crownY = H * (kind === 'parasol' ? 1.0 : 0.92), CR = kind === 'parasol' ? 3.6 : 2.9, flat = kind === 'parasol' ? 0.45 : 0.85;
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * Math.PI * 2 + R(), y0 = H * (0.5 + R() * 0.25), len = CR * (0.7 + R() * 0.4);
      const g = new THREE.CylinderGeometry(0.05, 0.12, len, 5); g.translate(0, len / 2, 0); g.rotateZ(-(0.7 + R() * 0.4)); g.rotateY(a); g.translate(bend * (y0 / H) ** 2, y0, 0); wood.push(g);
    }
    const crown = [], cards = [], farCrown = [], farthest = [];
    const centres = [];
    for (let k = 0; k < 7; k++) {
      const a = R() * Math.PI * 2, rr = R() * CR * 0.6;
      centres.push(new THREE.Vector3(Math.cos(a) * rr + bend, crownY + (R() - 0.4) * CR * flat * 0.8, Math.sin(a) * rr));
    }
    for (const c of centres) {
      const r = CR * (0.45 + R() * 0.2), seed = Math.floor(R() * 100);
      const g = blob(r, 2, seed, 0.3); g.scale(1, flat, 1); g.translate(c.x, c.y, c.z); crown.push(g);
      const f = blob(r * 1.06, 1, seed, 0.3); f.scale(1, flat, 1); f.translate(c.x, c.y, c.z); farCrown.push(f);
    }
    // the farthest: four big lumps
    centres.slice(0, 4).forEach((c, i) => { const g = blob(CR * 0.72, 0, 50 + i, 0.25); g.scale(1, flat, 1); g.translate(c.x * 0.8 + bend * 0.2, c.y, c.z * 0.8); farthest.push(g); });
    // leaf cards on the outside of the crown, facing out
    const cardG = new THREE.PlaneGeometry(1.5, 1.5);
    for (let k = 0; k < 34; k++) {
      const c = centres[k % centres.length]; const dir = new THREE.Vector3(R() - 0.5, (R() - 0.3) * flat, R() - 0.5).normalize();
      const pos = c.clone().addScaledVector(dir, CR * (0.45 + R() * 0.25));
      const g = cardG.clone(); g.rotateZ(R() * Math.PI); g.lookAt(dir); g.translate(pos.x, pos.y, pos.z);
      const n = g.attributes.normal; const mid = new THREE.Vector3(bend, crownY, 0);
      for (let i = 0; i < n.count; i++) { const pp = new THREE.Vector3().fromBufferAttribute(g.attributes.position, i).sub(mid).normalize(); n.setXYZ(i, pp.x, pp.y, pp.z); }
      cards.push(g);
    }
    // ambient occlusion in the vertex colours: darker low and inside
    const shade = (geos, lo, hi) => geos.forEach((g) => { const p = g.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const t = THREE.MathUtils.clamp((p.getY(i) - lo) / (hi - lo), 0, 1); const r2 = Math.hypot(p.getX(i) - bend, p.getZ(i)) / CR; const k = 0.42 + 0.58 * t * (0.6 + 0.4 * Math.min(1, r2)); col.set([k, k, k], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); });
    shade(crown, crownY - CR * flat, crownY + CR * flat); shade(cards, crownY - CR * flat, crownY + CR * flat); shade(farCrown, crownY - CR * flat, crownY + CR * flat); shade(farthest, crownY - CR * flat, crownY + CR * flat);
    for (const g of [...crown, ...farCrown, ...farthest]) g.computeVertexNormals();
    out.push({ wood: finish(wood), crown: finish(crown), cards: finish(cards), farWood: finish([trunkG(5, 2)]), farCrown: finish(farCrown), farthestWood: finish([trunkG(4, 1)]), farthestCrown: finish(farthest), H });
  }
  return out;
}
export function leafMaterial(wind, k) {
  return windify(new THREE.MeshStandardMaterial({ map: leaf(), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.8 }), k, wind);
}
export function rockModels(n, { detail = 3, rough = 0.5, flatten = 0.6, seed = 1 } = {}) {
  const out = [];
  for (let v = 0; v < n; v++) {
    const g = blob(1, detail, seed + v * 13, rough); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i); if (y < 0) y *= 0.3; p.setY(i, y * flatten); }
    g.computeVertexNormals();
    const col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = 0.65 + 0.35 * THREE.MathUtils.clamp(p.getY(i) / flatten + 0.3, 0, 1) * (0.8 + 0.4 * jsn3(p.getX(i) * 3, p.getY(i) * 3, p.getZ(i) * 3, 5)); col.set([k, k, k], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.push(g);
  }
  return out;
}
export function shardModels(n) { // clusters of ice crystals (faceted: kept unindexed so the faces stay sharp)
  const out = [];
  for (let v = 0; v < n; v++) {
    const R = (() => { let s = 77 + v * 31; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const geos = [];
    for (let k = 0; k < 5 + v; k++) {
      const h = 1 + R() * 2.5, r = 0.18 + R() * 0.25; const g = new THREE.ConeGeometry(r, h, 5, 1); g.translate(0, h / 2, 0);
      g.rotateZ((R() - 0.5) * 0.9); g.rotateX((R() - 0.5) * 0.9); g.translate((R() - 0.5) * 1.2, 0, (R() - 0.5) * 1.2);
      const ng = g.toNonIndexed(); ng.deleteAttribute('uv'); ng.deleteAttribute('normal'); geos.push(ng);
    }
    const f = mergeGeometries(geos, false); f.computeVertexNormals();
    f.setAttribute('color', new THREE.BufferAttribute(new Float32Array(f.attributes.position.count * 3).fill(1), 3));
    out.push(f);
  }
  return out;
}
