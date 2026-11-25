// Graphics levels. "Auto" picks one from the device and steps down if frames run long; the resolution also
// adapts continuously inside each level's range. Throwaway sketch code.
export const TIERS = {
  low: {
    name: 'Low', prMax: 1, prMin: 0.6, samples: 0, bloom: false, bloomScale: 0.5, shadows: false, shadowMap: 1024, softShadows: false,
    planetCube: 512, cloudCube: 256, planetSeg: [96, 64], detail: false,
    grass: { r: 24, sp: 0.6 }, flowers: false, crad: 2, farSeg: 200, relief: 0, tiles: 2, lod: [50, 170], drawFar: 480, motes: 400, inflight: 2, workers: 1,
  },
  medium: {
    name: 'Medium', prMax: 1.5, prMin: 0.75, samples: 4, bloom: true, bloomScale: 0.5, shadows: true, shadowMap: 1024, softShadows: false,
    planetCube: 768, cloudCube: 384, planetSeg: [160, 110], detail: true,
    grass: { r: 34, sp: 0.5 }, flowers: true, crad: 3, farSeg: 300, relief: 170, tiles: 3, lod: [90, 300], drawFar: 800, motes: 900, inflight: 3, workers: 2,
  },
  high: {
    name: 'High', prMax: 2, prMin: 1, samples: 4, bloom: true, bloomScale: 1, shadows: true, shadowMap: 2048, softShadows: true,
    planetCube: 1024, cloudCube: 512, planetSeg: [192, 128], detail: true,
    grass: { r: 46, sp: 0.42 }, flowers: true, crad: 3, farSeg: 400, relief: 260, tiles: 4, lod: [140, 450], drawFar: 1150, motes: 1500, inflight: 4, workers: 2,
  },
};
const ORDER = ['low', 'medium', 'high'];

// a first guess from the device: phones and integrated graphics start low, Apple silicon medium, discrete GPUs high
function guess() {
  const touch = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
  if (touch || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return 'low';
  let gpu = '';
  try { const gl = document.createElement('canvas').getContext('webgl2'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) { /* unknown */ }
  if (/Intel|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(gpu)) return 'low';
  if (/RTX|Radeon RX|GeForce GTX 1[0-9]{3}|M[1-9] (Pro|Max|Ultra)/i.test(gpu)) return 'high';
  return 'medium';
}

export function createQuality(params) {
  let mode = params.get('q') || (() => { try { return localStorage.getItem('gfx') || 'auto'; } catch (e) { return 'auto'; } })();
  if (!['auto', ...ORDER].includes(mode)) mode = 'auto';
  let key = mode === 'auto' ? guess() : mode;
  const listeners = [];
  const Q = {
    get mode() { return mode; },
    get key() { return key; },
    get t() { return TIERS[key]; },
    label() { return mode === 'auto' ? `Auto · ${TIERS[key].name}` : TIERS[key].name; },
    onChange(fn) { listeners.push(fn); },
    set(m) { // 'auto' | 'low' | 'medium' | 'high'
      mode = m; try { localStorage.setItem('gfx', m); } catch (e) { /* private mode */ }
      const k = m === 'auto' ? guess() : m; const changed = k !== key; key = k; listeners.forEach((f) => f(TIERS[key], changed));
    },
    cycle() { const all = ['auto', ...ORDER]; Q.set(all[(all.indexOf(mode) + 1) % all.length]); },
    // in auto mode, drop a level when frames stay long even at the lowest resolution of this level
    stepDown() { if (mode !== 'auto') return false; const i = ORDER.indexOf(key); if (i <= 0) return false; key = ORDER[i - 1]; listeners.forEach((f) => f(TIERS[key], true)); return true; },
  };
  return Q;
}
