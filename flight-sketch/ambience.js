// The sound of each surface, synthesised with Web Audio (no recordings, nothing to download). Each world has a
// handful of continuous layers (wind, water, crowds, machines) whose loudness follows where you are, and occasional
// events (calls, clanks, cheers, ice singing) scheduled at random. Audio runs off the main thread; the game only
// sets a few levels ten times a second, so this costs next to nothing per frame. Throwaway sketch code.
//
//   Technova  thin air over bare basalt: a dry, high wind in gusts with its low weight under it, grit skating over
//             the rock, gravel slipping on slopes; near the installations the rumble of plant and its venting
//   Ekatva    leaves and grass in the wind, the river (and spray at the fords), birds by day, insects and croaks
//             by night
//   The Arena wind through grass, crowds from the grounds, cheers and the crack of a bat, the stands clapping
//             in time, larks by day, crickets and floodlight hum at night
//   Cosmos    next to no air, so mostly your suit: its fan, your breathing; a wisp of thin wind, frost fizzing in
//             the sun, ice settling in long low swells, grains sliding, the Observatory's servos
// Nothing here is a struck or pitched sound except the birds: the worlds are made of air, grit and water.

const NOISE = new WeakMap();
function noiseBuffers(ctx) {
  if (NOISE.has(ctx)) return NOISE.get(ctx);
  const n = ctx.sampleRate * 4, white = ctx.createBuffer(1, n, ctx.sampleRate), brown = ctx.createBuffer(1, n, ctx.sampleRate);
  const w = white.getChannelData(0), b = brown.getChannelData(0); let last = 0;
  for (let i = 0; i < n; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }
  // the loop seam: fade the last few ms into the first so it does not click
  for (let i = 0; i < 2048; i++) { const k = i / 2048; w[n - 2048 + i] = w[n - 2048 + i] * (1 - k) + w[i] * k; b[n - 2048 + i] = b[n - 2048 + i] * (1 - k) + b[i] * k; }
  // crackle: sparse grains, for grit and sand blown against rock and the suit
  const crackle = ctx.createBuffer(1, n, ctx.sampleRate), c = crackle.getChannelData(0);
  for (let k = 0; k < n / 110; k++) { const i = Math.floor(Math.random() * (n - 8)), a = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? -1 : 1); for (let j = 0; j < 4; j++) c[i + j] += a * (1 - j / 4); }
  const out = { white, brown, crackle }; NOISE.set(ctx, out); return out;
}
function impulse(ctx, secs, decay, bright) {
  const n = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const r = Math.random() * 2 - 1; lp += (r - lp) * bright; d[i] = lp * Math.pow(1 - i / n, decay); } }
  return buf;
}
const rnd = (a, b) => a + Math.random() * (b - a);
const near = (d, r) => 1 / (1 + (d / r) * (d / r)); // 1 beside it, falling off with distance

export function createAmbience(ctx, out, key) {
  const { white, brown, crackle } = noiseBuffers(ctx);
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
  // wind that rises and falls in gusts: a noise band whose loudness and pitch follow the gust,
  // and a faint narrow whistle where it catches on rock edges
  function wind(centre, q, whistleAt) {
    const f = filt('bandpass', centre, q), body = layer([loop(white), f], 0.12);
    const wf = filt('bandpass', whistleAt, 5), whistle = layer([loop(white), wf], 0.2);
    return { set(level, g, t) { body.set(level * (0.25 + 0.75 * g), 0.6); f.frequency.setTargetAtTime(centre * (0.75 + 0.5 * g), t, 0.8); whistle.set(level * 0.3 * g * g, 0.8); wf.frequency.setTargetAtTime(whistleAt * (0.85 + 0.35 * g), t, 1.2); } };
  }
  const W = {};
  // a slide of gravel or a trickle of sand somewhere near: a soft rush of grains that swells and fades, never a hit
  function trickle(peak, len, fc) {
    const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = Math.random() < 0.5 ? crackle : white;
    const f = filt('bandpass', fc, 0.8), lp = filt('lowpass', fc * 2, 0.5), v = voice(bus, rnd(-0.9, 0.9), 0.35);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(peak, t + len * 0.3); v.gain.linearRampToValueAtTime(peak * 0.4, t + len * 0.6); v.gain.linearRampToValueAtTime(0, t + len);
    chain(src, f, lp, v); src.start(t, Math.random() * 3); src.stop(t + len + 0.1);
  }
  if (key === 'technova') {
    // thin air over bare basalt: a dry, high wind in gusts, grit skating over the rock, gravel slipping on the
    // slopes; near the installations the low rumble of plant and the breath of its vents (all noise, no tones)
    W.wind = wind(2400, 0.7, 900);
    W.low = layer([loop(brown), filt('bandpass', 260, 0.6)], 0.15); // the wind's weight, felt more than heard
    W.grit = layer([loop(crackle), filt('highpass', 2500, 0.7)], 0.1);
    W.machines = layer([loop(brown), filt('lowpass', 140, 0.7)], 0.3);
    every(7, 18, () => trickle(rnd(0.02, 0.05), rnd(1.2, 2.8), rnd(1800, 3500)));
    every(9, 22, (i) => { // a long breath of venting from the plant, when you are near it
      const p = Math.max(near(i.near['The Foundry'] ?? 1e9, 200), near(i.near['The Workshop'] ?? 1e9, 100)); if (p < 0.05) return;
      const t = ctx.currentTime, s2 = ctx.createBufferSource(); s2.buffer = white; const f = filt('bandpass', 1800, 0.7), v = voice(bus, rnd(-0.5, 0.5), 0.4);
      v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(0.05 * p, t + 0.8); v.gain.linearRampToValueAtTime(0.0, t + 3.5);
      f.frequency.setValueAtTime(2400, t); f.frequency.linearRampToValueAtTime(1200, t + 3.5); chain(s2, f, v); s2.start(t, Math.random() * 3); s2.stop(t + 3.6);
    });
  } else if (key === 'ekatva') {
    W.leaves = layer([loop(white), filt('bandpass', 1700, 0.5)], 0.1);
    W.grass = layer([loop(white), filt('bandpass', 4200, 1.0)], 0.05);
    const rr = loop(brown), rb = loop(white), rbF = filt('bandpass', 1300, 1.3), rbG = gain(0.5), rm = gain(1);
    chain(rr, filt('lowpass', 520, 0.7), rm); chain(rb, rbF, rbG, rm); wobble(rbG.gain, 3.3, 0.35); wobble(rbF.frequency, 0.37, 300);
    W.river = layer([rm], 0.2);
    const ins = osc('sine', 4300), am = gain(0), am2 = gain(0); wobble(am.gain, 27, 0.5, 'square'); am.gain.value = 0.5; wobble(am2.gain, 0.8, 0.5, 'square'); am2.gain.value = 0.5;
    chain(ins, am, am2); W.insects = layer([am2], 0.2);
    every(1.5, 6, (i) => { // birds by day: quick falling notes with a warble, in phrases
      if (i.day < 0.2) return; const n = 2 + Math.floor(Math.random() * 4), f = rnd(1800, 3400), pv = rnd(-0.9, 0.9);
      for (let k = 0; k < n; k++) { const t = ctx.currentTime + k * rnd(0.11, 0.2); tone({ f: f * (k % 2 ? 1.25 : 1.4), to: f * 0.72, t, dur: rnd(0.08, 0.16), peak: 0.035 * i.day, fm: f * 0.04, fmRate: rnd(35, 70), panV: pv, send: 0.35 }); }
    });
    every(2, 6, (i) => { // croaks from the banks at night: rough bursts of breath, not notes
      if (i.night < 0.4 || i.river > 160) return; const p = near(i.river, 60) * i.night, pv = rnd(-0.7, 0.7), fc = rnd(380, 600);
      for (let k = 0; k < 3; k++) burst({ t: ctx.currentTime + k * 0.11, dur: 0.05, peak: 0.12 * p, decay: 0.06, attack: 0.012, filters: [filt('bandpass', fc, 3)], buf: crackle, panV: pv, send: 0.3 });
    });
    W.water2 = layer([loop(white), filt('highpass', 2500, 0.7), filt('lowpass', 6000, 0.7)], 0.2); // fine spray where the river runs over the fords
  } else if (key === 'arena') {
    W.wind = wind(1600, 0.6, 700);
    W.grass = layer([loop(white), filt('bandpass', 3800, 0.9)], 0.05);
    const cr = loop(white), cmix = gain(1);
    for (const [f, q, v] of [[450, 3, 1], [1000, 3, 0.8], [2300, 2, 0.4]]) { const fl = filt('bandpass', f, q), g = gain(v); chain(cr, fl, g, cmix); wobble(g.gain, rnd(0.3, 0.9), v * 0.4); }
    W.crowd = layer([cmix], 0.4);
    const hum = osc('sawtooth', 100); W.hum = layer([hum, filt('bandpass', 200, 5)], 0.1);
    const cri = osc('sine', 4900), cam = gain(0.5), cam2 = gain(0.5); wobble(cam.gain, 42, 0.5, 'square'); wobble(cam2.gain, 2.6, 0.5, 'square');
    chain(cri, cam, cam2); W.crickets = layer([cam2], 0.15);
    const prox = (i) => Math.max(near(i.near['The Grand Arena'] ?? 1e9, 350), near(i.near['The Ground'] ?? 1e9, 200));
    const toward = (i) => { const a = (i.near['The Grand Arena'] ?? 1e9) < (i.near['The Ground'] ?? 1e9) ? 'The Grand Arena' : 'The Ground'; return i.pois.find((o) => o.name === a); };
    // one clap from a crowd: many hands, a few milliseconds apart
    const clap = (t, peak, pv) => { for (let k = 0; k < 6; k++) burst({ t: t + rnd(0, 0.03), dur: 0.006, peak: peak * rnd(0.5, 1), decay: 0.05, filters: [filt('bandpass', rnd(1000, 2200), 1.4)], panV: pv + rnd(-0.15, 0.15), send: 0.6 }); };
    every(7, 18, (i) => { // a cheer, sometimes after the crack of a bat
      const p = Math.max(prox(i), 0.08), t0 = ctx.currentTime + 0.9, o = toward(i), pv = o ? panOf(i, o.x, o.z) : 0;
      if (near(i.near['The Ground'] ?? 1e9, 200) > 0.1 && Math.random() < 0.6) burst({ dur: 0.004, peak: 0.3 * p, decay: 0.08, filters: [filt('highpass', 1800, 0.7)], panV: pv, send: 0.7 });
      const s2 = ctx.createBufferSource(); s2.buffer = white; const f = filt('bandpass', 700, 1.2), v = voice(bus, pv, 0.6);
      f.frequency.setValueAtTime(700, t0); f.frequency.linearRampToValueAtTime(1500, t0 + 0.6); f.frequency.linearRampToValueAtTime(900, t0 + 3.5);
      v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(0.22 * p, t0 + 0.5); v.gain.setTargetAtTime(0, t0 + 1.2, 0.9);
      chain(s2, f, v); s2.start(t0, Math.random() * 3); s2.stop(t0 + 6);
    });
    every(22, 45, (i) => { // the stands clapping together in time
      const p = prox(i); if (p < 0.05) return; const o = toward(i), pv = o ? panOf(i, o.x, o.z) : 0, n = 6 + Math.floor(Math.random() * 8);
      for (let k = 0; k < n; k++) clap(ctx.currentTime + k * 0.5, 0.12 * p, pv);
    });
    every(3, 9, (i) => { // larks over the grass by day
      if (i.day < 0.3) return; const f = rnd(4800, 6400), pv = rnd(-0.9, 0.9);
      tone({ f, to: f * 1.1, dur: rnd(0.5, 1.0), peak: 0.02 * i.day, fm: 600, fmRate: rnd(18, 30), panV: pv, send: 0.3 });
    });
  } else if (key === 'cosmos') {
    // next to no air, so the world reaches you through your suit and your boots: the suit's fan and your breath,
    // a wisp of thin wind, frost fizzing as the sun touches it, and the ice settling in long low groans
    W.fan = layer([loop(brown), filt('lowpass', 700, 0.5)], 0);
    W.fanHi = layer([loop(white), filt('bandpass', 2200, 0.5)], 0);
    W.wisp = layer([loop(white), filt('highpass', 4000, 0.7)], 0.3);
    W.frost = layer([loop(crackle), filt('highpass', 5000, 0.7)], 0.2);
    W.ground = layer([loop(brown), filt('lowpass', 60, 0.7)], 0.1);
    const sv = loop(white), svF = filt('bandpass', 700, 2); W.servo = layer([sv, svF], 0.3); wobble(svF.frequency, 0.2, 200);
    every(12, 30, () => { // the ice settling: a slow, deep swell under your feet
      const t = ctx.currentTime, len = rnd(2.5, 5), src = ctx.createBufferSource(); src.buffer = brown;
      const f = filt('lowpass', rnd(90, 160), 1.2), v = voice(bus, rnd(-0.4, 0.4), 0.5);
      f.frequency.setValueAtTime(rnd(120, 180), t); f.frequency.linearRampToValueAtTime(rnd(60, 90), t + len);
      v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(0.12, t + len * 0.4); v.gain.linearRampToValueAtTime(0, t + len);
      chain(src, f, v); src.start(t, Math.random() * 3); src.stop(t + len + 0.1);
    });
    every(10, 24, () => trickle(0.012, rnd(1.5, 3), rnd(3500, 6000))); // ice grains sliding
    every(4.4, 4.8, (i) => { // breathing in the helmet: in through the nose (brighter), out (lower, longer)
      if (i.phase !== 'walk') return; const t = ctx.currentTime;
      for (const [t0, len, fc, pk] of [[0, 1.3, 1400, 0.018], [1.6, 1.9, 650, 0.024]]) {
        const s2 = ctx.createBufferSource(); s2.buffer = white; const f = filt('bandpass', fc, 0.9), lp = filt('lowpass', 3000, 0.5), v = voice(bus, 0, 0);
        v.gain.setValueAtTime(0, t + t0); v.gain.linearRampToValueAtTime(pk, t + t0 + len * 0.4); v.gain.linearRampToValueAtTime(0, t + t0 + len);
        chain(s2, f, lp, v); s2.start(t + t0, Math.random() * 3); s2.stop(t + t0 + len + 0.05);
      }
    });
  }

  let camYaw = 0;
  function panOf(i, x, z) { const dx = x - i.x, dz = z - i.z, l = Math.hypot(dx, dz) || 1; return Math.max(-1, Math.min(1, (dx * Math.cos(camYaw) - dz * Math.sin(camYaw)) / l)); }
  let acc = 0, level = 1, alive = true, gustV = 0.5, gustTo = 0.5, gustNext = 0;
  return {
    key,
    setLevel(v) { level = v; },
    update(i, dt) {
      if (!alive) return;
      acc += dt; if (acc < 0.1) return; acc = 0;
      camYaw = i.camYaw;
      const t = ctx.currentTime;
      // gusts: a slow random walk toward a new strength every few seconds
      if (t > gustNext) { gustTo = rnd(0.15, 1); gustNext = t + rnd(2, 7); }
      gustV += (gustTo - gustV) * 0.06; const gust = gustV; // about a second and a half to swell or ease
      bus.gain.setTargetAtTime(level, t, 0.8);
      // the rover
      const drv = i.phase === 'drive';
      motorO1.frequency.setTargetAtTime(70 + i.speed * 8, t, 0.2); motorO2.frequency.setTargetAtTime(140 + i.speed * 16, t, 0.2);
      motor.set(drv ? (0.012 + 0.035 * Math.min(1, i.speed / 12)) : 0, 0.3);
      crunch.set(drv && !i.float ? 0.12 * air * Math.min(1, i.speed / 10) : 0, 0.2);
      slosh.set(drv ? Math.min(0.15, i.splash * 0.05 + (i.float ? 0.04 : 0)) : i.wet > 0.2 && i.walking ? 0.05 : 0, 0.2);
      const wk = i.windK * gust;
      if (key === 'technova') {
        const fo = near(i.near['The Foundry'] ?? 1e9, 300), wo = near(i.near['The Workshop'] ?? 1e9, 150);
        W.wind.set(0.05, gust, t); W.low.set(0.04 * gust); W.grit.set(0.04 * gust * gust);
        W.machines.set(0.015 + 0.12 * fo + 0.06 * wo);
      } else if (key === 'ekatva') {
        W.leaves.set(0.09 * wk * (0.5 + 0.5 * i.day) + 0.012); W.grass.set(0.03 * wk);
        W.river.set(0.03 + 0.28 * near(i.river, 45)); W.river.pan(panOf(i, i.riverX, i.z));
        W.insects.set(0.022 * i.night);
        const ford = Math.min(...['The ford', 'The upper ford', 'The lower ford'].map((n) => i.near[n] ?? 1e9)); W.water2.set(0.05 * near(ford, 40) * near(i.river, 40)); W.water2.pan(panOf(i, i.riverX, i.z));
      } else if (key === 'arena') {
        W.wind.set(0.08 * i.windK, gust, t); W.grass.set(0.04 * wk);
        const ga = i.near['The Grand Arena'] ?? 1e9, gr = i.near['The Ground'] ?? 1e9;
        W.crowd.set(0.025 + 0.16 * near(ga, 300) + 0.1 * near(gr, 180));
        const o = i.pois.find((p) => p.name === (ga < gr ? 'The Grand Arena' : 'The Ground')); if (o) W.crowd.pan(panOf(i, o.x, o.z) * 0.7);
        W.hum.set((0.004 + 0.012 * i.night) * Math.max(near(gr, 80), near(ga, 120)));
        W.crickets.set(0.02 * i.night);
      } else if (key === 'cosmos') {
        const suit = i.phase === 'walk' ? 1 : 0.35; // in the lander or the rover the cabin covers the suit
        W.fan.set(0.03 * suit); W.fanHi.set(0.005 * suit); W.wisp.set(0.006); W.frost.set(0.006 * i.day);
        W.ground.set(drv ? 0.05 : 0.012);
        W.servo.set(0.03 * Math.max(near(i.near['The Observatory'] ?? 1e9, 80), near(i.near['The Great Telescope'] ?? 1e9, 160), near(i.near['The Array'] ?? 1e9, 80)));
      }
      for (const e of events) if (t >= e.next) { e.next = t + rnd(e.lo, e.hi); if (level > 0.01) try { e.fn(i); } catch (err) { /* a skipped sound is harmless */ } }
    },
    dispose() {
      alive = false; const t = ctx.currentTime; bus.gain.setTargetAtTime(0, t, 0.3);
      setTimeout(() => { for (const s of sources) { try { s.stop(); } catch (e) { /* already stopped */ } } bus.disconnect(); }, 1500);
    },
  };
}
