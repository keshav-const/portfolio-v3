// Water for the surfaces: one plane, shaded per pixel. Ripples flow with the river, colour deepens with depth
// (read from the terrain's height map), the sky and sun reflect at grazing angles, shores fade out with foam, and
// the rover leaves a wake. Cheap: a single draw with a handful of noise lookups. Throwaway sketch code.
import * as THREE from 'three';
import { CELL } from './terrain.js';

const VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
varying vec3 vW;
void main(){
  vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz;
  vec4 mvPosition = viewMatrix*wp; gl_Position = projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;
const FRAG = (flow) => /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform float uTime, uLevel, uSunI, uDay, uWin;
uniform vec3 uSun, uSunCol, uSkyZ, uSkyH, uShallow, uDeep;
uniform vec4 uWake;
uniform sampler2D uHM; uniform float uNT;
varying vec3 vW;
float h2(vec2 p){ uvec2 q = uvec2(ivec2(floor(p))) * uvec2(1597334673U, 3812015801U); uint n = (q.x ^ q.y) * 1597334673U; return float(n) * 2.3283064e-10; }
float vn(vec2 p){ vec2 i = floor(p), f = p - i; vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1.0,0.0)), u.x), mix(h2(i+vec2(0.0,1.0)), h2(i+vec2(1.0,1.0)), u.x), u.y); }
${flow}
float ground(vec2 xz){ // terrain height from the streamed map (bilinear); unknown outside the loaded window
  vec2 g = xz / ${CELL.toFixed(3)}; vec2 i = floor(g), f = g - i;
  ivec2 a = ivec2(mod(i, uNT)), b = ivec2(mod(i + 1.0, uNT));
  float h00 = texelFetch(uHM, a, 0).x, h10 = texelFetch(uHM, ivec2(b.x, a.y), 0).x, h01 = texelFetch(uHM, ivec2(a.x, b.y), 0).x, h11 = texelFetch(uHM, b, 0).x;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}
// ripple height: fine layers carried by the flow and stretched along it (streaks on a river), plus a wind chop
float waves(vec2 p, vec2 fl){
  float t = uTime, sp = length(fl);
  vec2 d = sp > 0.01 ? fl / sp : vec2(0.0, 1.0); vec2 q = vec2(dot(p, d), dot(p, vec2(-d.y, d.x)));
  vec2 s1 = vec2(q.x*0.35, q.y*1.6) - vec2(t*sp*0.7, 0.0), s2 = vec2(q.x*0.9, q.y*2.6) - vec2(t*sp*1.3, 0.0);
  float river = vn(s1)*0.5 + vn(s2)*0.3;
  float chop = vn(p*1.7 + vec2(t*0.35, -t*0.27))*0.35 + vn(p*4.1 - vec2(t*0.6, t*0.45))*0.15;
  float k = smoothstep(0.1, 0.8, sp);
  return mix(chop, river + chop*0.35, k);
}
void main(){
  vec2 xz = vW.xz; float dist = length(cameraPosition - vW);
  vec2 fl = flowAt(xz);
  // depth: inside the loaded window from the map, beyond it assumed deep
  vec2 dc = abs(xz - cameraPosition.xz);
  float depth = max(dc.x, dc.y) < uWin ? uLevel - ground(xz) : 6.0;
  if (depth < -0.05) discard;
  // the wake: rings and a trailing ruffle behind the rover
  vec2 wr = xz - uWake.xy; float wd = length(wr);
  float wake = uWake.w * exp(-wd*0.35) * smoothstep(0.0, 1.5, uWake.z);
  // normal from the ripples; flattened with distance so it does not sparkle
  float k = 1.0 - smoothstep(40.0, 400.0, dist), e = 0.12;
  float w0 = waves(xz, fl), wx = waves(xz + vec2(e, 0.0), fl), wz = waves(xz + vec2(0.0, e), fl);
  vec3 N = normalize(vec3(-(wx - w0)/e*0.16*k, 1.0, -(wz - w0)/e*0.16*k));
  N.xz += normalize(wr + 1e-4) * sin(wd*2.4 - uTime*7.0) * wake * 0.35;
  N = normalize(N);
  vec3 V = normalize(cameraPosition - vW), L = normalize(uSun), R = reflect(-V, N);
  // reflection of the sky (and the sun), stronger at grazing angles
  float fres = 0.02 + 0.98*pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 sky = mix(uSkyH, uSkyZ, pow(clamp(R.y, 0.0, 1.0), 0.5));
  float sd = max(dot(R, L), 0.0);
  vec3 spec = uSunCol * uSunI * (pow(sd, 500.0)*6.0 + pow(sd, 40.0)*0.12) * smoothstep(-0.02, 0.06, L.y);
  // the body of the water: silty and warm in the shallows, dark in the deep
  float lit = max(L.y, 0.0)*0.8*uDay + 0.25;
  vec3 body = mix(uShallow, uDeep, 1.0 - exp(-max(depth, 0.0)*0.55)) * (uSkyH*0.6 + uSunCol*lit*0.8);
  vec3 col = mix(body, sky, fres) + spec;
  // foam along the shore and in the wake
  float fn = vn(xz*1.6 + fl*uTime*1.2) * vn(xz*0.6 - uTime*0.1);
  float foam = (1.0 - smoothstep(0.05, 0.5, depth)) * smoothstep(0.25, 0.55, fn) + wake * smoothstep(0.35, 0.6, fn) * smoothstep(1.2*uWake.z + 3.0, 1.0, wd);
  col = mix(col, vec3(0.92, 0.9, 0.84)*(0.35 + 0.65*lit), clamp(foam, 0.0, 0.85));
  gl_FragColor = vec4(col, smoothstep(0.0, 0.55, depth));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// spec: { level, shallow: [r,g,b], deep: [r,g,b], flow: glsl defining vec2 flowAt(vec2 xz) (m/s), current(x, z, out) }
export function createWater(scene, terrain, spec) {
  const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uLevel: { value: spec.level }, uSunI: { value: 1 }, uDay: { value: 1 }, uWin: { value: (terrain.NT / 2 - 64) * CELL },
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSkyZ: { value: new THREE.Color() }, uSkyH: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color(...spec.shallow) }, uDeep: { value: new THREE.Color(...spec.deep) }, uWake: { value: new THREE.Vector4() },
    uHM: { value: null }, uNT: { value: terrain.NT },
  }]);
  U.uHM.value = terrain.hmTex;
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG(spec.flow), uniforms: U, transparent: true, fog: true, depthWrite: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = spec.level; mesh.renderOrder = 1; mesh.receiveShadow = false; scene.add(mesh);
  return {
    mesh, level: spec.level, current: spec.current,
    update(t, sun, sunCol, sunI, day, skyZ, skyH, wake) {
      U.uTime.value = t; U.uSun.value.copy(sun); U.uSunCol.value.copy(sunCol); U.uSunI.value = sunI; U.uDay.value = day;
      U.uSkyZ.value.copy(skyZ); U.uSkyH.value.copy(skyH);
      if (wake) U.uWake.value.set(wake.x, wake.z, wake.speed, wake.on ? 1 : 0); else U.uWake.value.w = 0;
    },
    dispose() { scene.remove(mesh); mesh.geometry.dispose(); mat.dispose(); },
  };
}
