// The sound of each surface, synthesised with Web Audio (no recordings, nothing to download). Each world has a
// handful of continuous layers (wind, water, crowds, machines) whose loudness follows where you are, and occasional
// events (calls, clanks, cheers, ice singing) scheduled at random. Audio runs off the main thread; the game only
// sets a few levels ten times a second, so this costs next to nothing per frame. Throwaway sketch code.
//
//   Technova  thin air: a faint high hiss, the thrum of the Foundry, the buzz of the mast, metal ticking and clanking
//   Ekatva    leaves and grass in the wind, the river, strange birds by day, insects and croaks by night,
//             the bell of the Fort and a drone from the Amphitheatre
//   The Arena warm wind through grass, crowds from the grounds, cheers and the crack of a bat, drums, larks,
//             crickets and floodlight hum at night
//   Cosmos    almost silent: your breathing in the suit, the low rumble of the ground, ice that sings and cracks,
//             crystal ticking, the servos of the Observatory

const NOISE = new WeakMap();
function noiseBuffers(ctx) {
  if (NOISE.has(ctx)) return NOISE.get(ctx);
  const n = ctx.sampleRate * 4, white = ctx.createBuffer(1, n, ctx.sampleRate), brown = ctx.createBuffer(1, n, ctx.sampleRate);
  const w = white.getChannelData(0), b = brown.getChannelData(0); let last = 0;
  for (let i = 0; i < n; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }
  // the loop seam: fade the last few ms into the first so it does not click
  for (let i = 0; i < 2048; i++) { const k = i / 2048; w[n - 2048 + i] = w[n - 2048 + i] * (1 - k) + w[i] * k; b[n - 2048 + i] = b[n - 2048 + i] * (1 - k) + b[i] * k; }
  const out = { white, brown }; NOISE.set(ctx, out); return out;
}
function impulse(ctx, secs, decay, bright) {
  const n = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const r = Math.random() * 2 - 1; lp += (r - lp) * bright; d[i] = lp * Math.pow(1 - i / n, decay); } }
  return buf;
}
const rnd = (a, b) => a + Math.random() * (b - a);
const near = (d, r) => 1 / (1 + (d / r) * (d / r)); // 1 beside it, falling off with distance

export function createAmbience(ctx, out, key) {
  const { white, brown } = noiseBuffers(ctx);
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(out);
  const REV = { technova: [1.6, 3, 0.5], ekatva: [2.2, 4, 0.25], arena: [2.6, 3, 0.3], cosmos: [4.5, 2.5, 0.6] }[key] || [2, 3, 0.3];
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, REV[0], REV[1], REV[2]);
  const wet = ctx.createGain(); wet.gain.value = key === 'cosmos' ? 0.9 : 0.6; verb.connect(wet).connect(bus);
  const sources = [];
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration); sources.push(s); return s; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); sources.push(o); return o; };
  const filt = (type, f, Q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const pan = () => (ctx.createStereoPanner ? ctx.createStereoPanner() : null);
  // a continuous layer: source(s) -> filters -> level (-> panner) -> bus (+ a little reverb)
  function layer(nodes, send = 0.15) {
    const g = gain(0), p = pan(); chain(...nodes, g); const end = p ? (g.connect(p), p) : g; end.connect(bus);
    if (send) { const s = gain(send); end.connect(s); s.connect(verb); }
    return { g, p, set(v, tc = 0.4) { g.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, tc); }, pan(v) { if (p) p.pan.setTargetAtTime(Math.max(-1, Math.min(1, v)), ctx.currentTime, 0.3); } };
  }
  // amplitude wobble: an LFO added to a gain's value
  function wobble(param, rate, depth, type = 'sine') { const l = osc(type, rate), d = gain(depth); l.connect(d).connect(param); return l; }
  // ---- one-shot helpers ----
  function voice(dest, panV, send) {
    const g = gain(0), p = pan(); g.connect(p || bus); if (p) { p.pan.value = panV; p.connect(bus); }
    if (send) { const s = gain(send); (p || g).connect(s); s.connect(verb); }
    return g;
  }
  function tone({ type = 'sine', f, to, t = ctx.currentTime, dur = 0.3, peak = 0.05, attack = 0.01, panV = 0, send = 0.3, fm = 0, fmRate = 0, filter }) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    if (fm) { const m = ctx.createOscillator(); m.frequency.value = fmRate; const mg = gain(fm); m.connect(mg).connect(o.frequency); m.start(t); m.stop(t + dur + 0.05); }
    const v = voice(bus, panV, send); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(peak, t + attack); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filter) chain(o, filter, v); else o.connect(v);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function burst({ t = ctx.currentTime, dur = 0.05, peak = 0.1, decay = 0.3, filters = [], panV = 0, send = 0.3, buf = white, attack = 0.002 }) {
    const s = ctx.createBufferSource(); s.buffer = buf; const v = voice(bus, panV, send);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(peak, t + attack); v.gain.setTargetAtTime(0, t + attack + dur, decay / 4);
    if (filters.length <= 1) { chain(s, ...(filters.length ? filters : []), v); } else { const sum = gain(1); for (const f of filters) { s.connect(f); f.connect(sum); } sum.connect(v); }
    s.start(t, Math.random() * 3); s.stop(t + attack + dur + decay * 1.5 + 0.1);
  }
  // ---- the events of a world: each fires when its time comes, then picks its next time ----
  const events = [];
  const every = (lo, hi, fn) => events.push({ lo, hi, fn, next: ctx.currentTime + rnd(lo * 0.3, hi) });
  // ---- the rover (all worlds): motor whine, ground crunch, water ----
  const motorO1 = osc('sawtooth', 100), motorO2 = osc('triangle', 200), motorF = filt('lowpass', 900, 0.7), motorMix = gain(1);
  motorO1.connect(motorMix); motorO2.connect(motorMix);
  const motor = layer([motorMix, motorF], 0.05);
  const crunch = layer([loop(brown), filt('bandpass', 380, 0.8)], 0.05);
  const slosh = layer([loop(white), filt('lowpass', 1300, 0.6)], 0.2);
  const air = key === 'cosmos' ? 0.35 : key === 'technova' ? 0.6 : 1; // thin air carries less

  // ---- per world ----
  const W = {};
  if (key === 'technova') {
    W.hiss = layer([loop(white), filt('highpass', 2400, 0.7), filt('bandpass', 4200, 0.6)], 0.1);
    const d1 = osc('sawtooth', 36), d2 = osc('sawtooth', 36.6), dm = gain(1); d1.connect(dm); d2.connect(dm);
    W.thrum = layer([dm, filt('lowpass', 95, 1)], 0.2);
    const b = osc('square', 120); W.buzz = layer([b, filt('bandpass', 360, 6)], 0.05);
    every(3, 11, (i) => { // metal ticking and clanking: resonant noise bursts, louder near the installations
      const p = Math.max(near(i.near['The Foundry'] ?? 1e9, 220), near(i.near['The Workshop'] ?? 1e9, 120), 0.12);
      const f = rnd(420, 900), fs = [1, 1.63, 2.54, 3.9].map((k) => filt('bandpass', f * k, 40));
      burst({ dur: 0.02, peak: 1.4 * p, decay: rnd(0.8, 1.8), filters: fs, panV: rnd(-0.8, 0.8), send: 0.5 });
      if (Math.random() < 0.4) burst({ t: ctx.currentTime + rnd(0.15, 0.4), dur: 0.015, peak: 0.8 * p, decay: 0.6, filters: [1, 2.2].map((k) => filt('bandpass', f * 1.4 * k, 35)), panV: rnd(-0.8, 0.8), send: 0.5 });
    });
    every(2.5, 4, (i) => { // the mast's telemetry blips
      const p = near(i.near['Antenna mast'] ?? 1e9, 60); if (p < 0.02) return;
      for (let k = 0; k < 3; k++) tone({ f: 1760, t: ctx.currentTime + k * 0.11, dur: 0.07, peak: 0.03 * p, send: 0.4 });
    });
    every(8, 20, (i) => burst({ dur: 0.01, peak: 0.25, decay: 0.15, filters: [filt('highpass', 3000, 0.7)], panV: rnd(-1, 1), send: 0.2 })); // rock ticking as it cools
  } else if (key === 'ekatva') {
    W.leaves = layer([loop(white), filt('bandpass', 1700, 0.5)], 0.1);
    W.grass = layer([loop(white), filt('bandpass', 4200, 1.0)], 0.05);
    const rr = loop(brown), rb = loop(white), rbF = filt('bandpass', 1300, 1.3), rbG = gain(0.5), rm = gain(1);
    chain(rr, filt('lowpass', 520, 0.7), rm); chain(rb, rbF, rbG, rm); wobble(rbG.gain, 3.3, 0.35); wobble(rbF.frequency, 0.37, 300);
    W.river = layer([rm], 0.2);
    const ins = osc('sine', 4300), am = gain(0), am2 = gain(0); wobble(am.gain, 27, 0.5, 'square'); am.gain.value = 0.5; wobble(am2.gain, 0.8, 0.5, 'square'); am2.gain.value = 0.5;
    chain(ins, am, am2); W.insects = layer([am2], 0.2);
    const a1 = osc('sawtooth', 130.8), a2 = osc('sawtooth', 196), a3 = osc('sawtooth', 261.6), amix = gain(1); for (const o of [a1, a2, a3]) o.connect(amix);
    a2.detune.value = 4; a3.detune.value = -5;
    W.drone = layer([amix, filt('lowpass', 800, 0.8)], 0.5);
    every(1.5, 6, (i) => { // birds by day: quick falling notes with a warble, in phrases
      if (i.day < 0.2) return; const n = 2 + Math.floor(Math.random() * 4), f = rnd(1800, 3400), pv = rnd(-0.9, 0.9);
      for (let k = 0; k < n; k++) { const t = ctx.currentTime + k * rnd(0.11, 0.2); tone({ f: f * (k % 2 ? 1.25 : 1.4), to: f * 0.72, t, dur: rnd(0.08, 0.16), peak: 0.035 * i.day, fm: f * 0.04, fmRate: rnd(35, 70), panV: pv, send: 0.35 }); }
    });
    every(2, 6, (i) => { // croaks from the banks at night
      if (i.night < 0.4 || i.river > 160) return; const p = near(i.river, 60) * i.night, f = rnd(100, 160), pv = rnd(-0.7, 0.7);
      for (let k = 0; k < 3; k++) tone({ type: 'sawtooth', f, to: f * 0.85, t: ctx.currentTime + k * 0.09, dur: 0.07, peak: 0.07 * p, filter: filt('bandpass', 620, 4), panV: pv, send: 0.3 });
    });
    every(24, 45, (i) => { // the bell of the Fort
      const p = near(i.near['The Fort'] ?? 1e9, 250); if (p < 0.03) return;
      [1, 2, 2.4, 3, 4.2, 5.4].forEach((k, j) => tone({ f: 196 * k, dur: 5 - j * 0.6, peak: (0.06 / (1 + j * 0.7)) * p, attack: 0.004, send: 0.6, panV: 0 }));
    });
  } else if (key === 'arena') {
    W.grass = layer([loop(white), filt('bandpass', 2600, 0.6)], 0.05);
    W.gust = layer([loop(brown), filt('lowpass', 320, 0.7)], 0.05);
    const cr = loop(white), cmix = gain(1);
    for (const [f, q, v] of [[450, 3, 1], [1000, 3, 0.8], [2300, 2, 0.4]]) { const fl = filt('bandpass', f, q), g = gain(v); chain(cr, fl, g, cmix); wobble(g.gain, rnd(0.3, 0.9), v * 0.4); }
    W.crowd = layer([cmix], 0.4);
    const hum = osc('sawtooth', 100); W.hum = layer([hum, filt('bandpass', 200, 5)], 0.1);
    const cri = osc('sine', 4900), cam = gain(0.5), cam2 = gain(0.5); wobble(cam.gain, 42, 0.5, 'square'); wobble(cam2.gain, 2.6, 0.5, 'square');
    chain(cri, cam, cam2); W.crickets = layer([cam2], 0.15);
    const prox = (i) => Math.max(near(i.near['The Grand Arena'] ?? 1e9, 350), near(i.near['The Ground'] ?? 1e9, 200));
    const toward = (i) => { const a = (i.near['The Grand Arena'] ?? 1e9) < (i.near['The Ground'] ?? 1e9) ? 'The Grand Arena' : 'The Ground'; return i.pois.find((o) => o.name === a); };
    every(7, 18, (i) => { // a cheer, sometimes after the crack of a bat
      const p = Math.max(prox(i), 0.08), t0 = ctx.currentTime + 0.9, o = toward(i), pv = o ? panOf(i, o.x, o.z) : 0;
      if (near(i.near['The Ground'] ?? 1e9, 200) > 0.1 && Math.random() < 0.6) { tone({ f: 1400, to: 900, dur: 0.05, peak: 0.12 * p, attack: 0.001, panV: pv, send: 0.6 }); burst({ dur: 0.01, peak: 0.2 * p, decay: 0.05, filters: [filt('bandpass', 2200, 3)], panV: pv, send: 0.6 }); }
      const s = ctx.createBufferSource(); s.buffer = white; const f = filt('bandpass', 700, 1.2), v = voice(bus, pv, 0.6);
      f.frequency.setValueAtTime(700, t0); f.frequency.linearRampToValueAtTime(1500, t0 + 0.6); f.frequency.linearRampToValueAtTime(900, t0 + 3.5);
      v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(0.22 * p, t0 + 0.5); v.gain.setTargetAtTime(0, t0 + 1.2, 0.9);
      chain(s, f, v); s.start(t0, Math.random() * 3); s.stop(t0 + 6);
    });
    every(20, 40, (i) => { // drums from the stands
      const p = prox(i); if (p < 0.05) return; const o = toward(i), pv = o ? panOf(i, o.x, o.z) : 0, n = 8 + 4 * Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) { const t = ctx.currentTime + k * 0.27, acc = k % 4 === 0 ? 1 : k % 2 ? 0.55 : 0.75; tone({ f: 82, to: 44, t, dur: 0.22, peak: 0.25 * p * acc, attack: 0.003, panV: pv, send: 0.5 }); if (k % 4 === 2) burst({ t: t + 0.135, dur: 0.02, peak: 0.12 * p, decay: 0.12, filters: [filt('bandpass', 1500, 1.5)], panV: pv, send: 0.5 }); }
    });
    every(3, 9, (i) => { // larks over the grass by day
      if (i.day < 0.3) return; const f = rnd(4800, 6400), pv = rnd(-0.9, 0.9);
      tone({ f, to: f * 1.1, dur: rnd(0.5, 1.0), peak: 0.02 * i.day, fm: 600, fmRate: rnd(18, 30), panV: pv, send: 0.3 });
    });
  } else if (key === 'cosmos') {
    W.rumble = layer([loop(brown), filt('lowpass', 70, 0.7)], 0.2);
    const sv = osc('sawtooth', 150); W.servo = layer([sv, filt('bandpass', 600, 3)], 0.3); wobble(sv.frequency, 0.15, 40);
    every(4, 12, (i) => { // ice singing: a falling whistle and its echo off the ice
      const f = rnd(2500, 5200), to = rnd(180, 420), d = rnd(0.5, 1.3), pv = rnd(-0.9, 0.9);
      tone({ f, to, dur: d, peak: 0.05, attack: 0.003, panV: pv, send: 0.7 });
      tone({ f: f * 0.97, to: to * 0.97, t: ctx.currentTime + rnd(0.12, 0.25), dur: d, peak: 0.02, attack: 0.003, panV: -pv * 0.6, send: 0.8 });
    });
    every(14, 40, () => burst({ dur: 0.06, peak: 0.7, decay: rnd(1.2, 2.4), filters: [filt('lowpass', 260, 0.8)], buf: brown, panV: rnd(-0.6, 0.6), send: 0.6 })); // a deep crack in the ice
    every(6, 14, () => { // crystals ticking
      const n = 3 + Math.floor(Math.random() * 5), pv = rnd(-0.8, 0.8);
      for (let k = 0; k < n; k++) tone({ f: rnd(2600, 5200), t: ctx.currentTime + k * rnd(0.06, 0.2), dur: 0.35, peak: 0.018, attack: 0.002, panV: pv + rnd(-0.2, 0.2), send: 0.6 });
    });
    every(4.2, 4.6, (i) => { // breathing in the suit, only on foot
      if (i.phase !== 'walk') return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = white;
      const f = filt('bandpass', 750, 0.8), v = voice(bus, 0, 0);
      v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(0.03, t + 1.2); v.gain.linearRampToValueAtTime(0.0, t + 1.6);
      f.frequency.setValueAtTime(900, t); f.frequency.setValueAtTime(520, t + 1.9);
      v.gain.linearRampToValueAtTime(0.04, t + 2.4); v.gain.linearRampToValueAtTime(0, t + 3.6);
      chain(s, f, v); s.start(t, Math.random() * 3); s.stop(t + 3.8);
    });
  }

  let camYaw = 0;
  function panOf(i, x, z) { const dx = x - i.x, dz = z - i.z, l = Math.hypot(dx, dz) || 1; return Math.max(-1, Math.min(1, (dx * Math.cos(camYaw) - dz * Math.sin(camYaw)) / l)); }
  let acc = 0, level = 1, alive = true;
  return {
    key,
    setLevel(v) { level = v; },
    update(i, dt) {
      if (!alive) return;
      acc += dt; if (acc < 0.1) return; acc = 0;
      camYaw = i.camYaw;
      const t = ctx.currentTime, gust = 0.55 + 0.45 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1.3);
      bus.gain.setTargetAtTime(level, t, 0.8);
      // the rover
      const drv = i.phase === 'drive';
      motorO1.frequency.setTargetAtTime(70 + i.speed * 8, t, 0.2); motorO2.frequency.setTargetAtTime(140 + i.speed * 16, t, 0.2);
      motor.set(drv ? (0.012 + 0.035 * Math.min(1, i.speed / 12)) : 0, 0.3);
      crunch.set(drv && !i.float ? 0.12 * air * Math.min(1, i.speed / 10) : 0, 0.2);
      slosh.set(drv ? Math.min(0.15, i.splash * 0.05 + (i.float ? 0.04 : 0)) : i.wet > 0.2 && i.walking ? 0.05 : 0, 0.2);
      const wk = i.windK * gust;
      if (key === 'technova') {
        W.hiss.set(0.025 + 0.06 * wk);
        W.thrum.set(0.006 + 0.05 * near(i.near['The Foundry'] ?? 1e9, 300) + 0.025 * near(i.near['The Workshop'] ?? 1e9, 150));
        W.buzz.set(0.03 * near(i.near['Antenna mast'] ?? 1e9, 40) + 0.02 * near(i.near['The Workshop'] ?? 1e9, 60));
      } else if (key === 'ekatva') {
        W.leaves.set(0.09 * wk * (0.5 + 0.5 * i.day) + 0.012); W.grass.set(0.03 * wk);
        W.river.set(0.03 + 0.28 * near(i.river, 45)); W.river.pan(panOf(i, i.riverX, i.z));
        W.insects.set(0.022 * i.night);
        const am = i.pois.find((o) => o.name === 'The Amphitheatre'); W.drone.set(0.04 * near(i.near['The Amphitheatre'] ?? 1e9, 160)); if (am) W.drone.pan(panOf(i, am.x, am.z));
      } else if (key === 'arena') {
        W.grass.set(0.05 * wk); W.gust.set(0.08 * wk * wk);
        const ga = i.near['The Grand Arena'] ?? 1e9, gr = i.near['The Ground'] ?? 1e9;
        W.crowd.set(0.025 + 0.16 * near(ga, 300) + 0.1 * near(gr, 180));
        const o = i.pois.find((p) => p.name === (ga < gr ? 'The Grand Arena' : 'The Ground')); if (o) W.crowd.pan(panOf(i, o.x, o.z) * 0.7);
        W.hum.set((0.004 + 0.012 * i.night) * Math.max(near(gr, 80), near(ga, 120)));
        W.crickets.set(0.02 * i.night);
      } else if (key === 'cosmos') {
        W.rumble.set(0.06 + (drv ? 0.05 : 0));
        W.servo.set(0.025 * Math.max(near(i.near['The Observatory'] ?? 1e9, 80), near(i.near['The Great Telescope'] ?? 1e9, 160), near(i.near['The Array'] ?? 1e9, 80)));
      }
      for (const e of events) if (t >= e.next) { e.next = t + rnd(e.lo, e.hi); if (level > 0.01) try { e.fn(i); } catch (err) { /* a skipped sound is harmless */ } }
    },
    dispose() {
      alive = false; const t = ctx.currentTime; bus.gain.setTargetAtTime(0, t, 0.3);
      setTimeout(() => { for (const s of sources) { try { s.stop(); } catch (e) { /* already stopped */ } } bus.disconnect(); }, 1500);
    },
  };
}
