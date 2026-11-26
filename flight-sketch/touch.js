// Touch controls for phones and tablets, laid out like a game: a floating joystick on the left (put your thumb down
// anywhere in the lower left), drag anywhere else to look, round buttons under the right thumb, and the one thing you
// can do right now (Get in, Get out, Step out, Undock…) as a large button above them. Small chips at the top hold
// the rest. The game describes the current mode through api.context():
//   context() -> { stick: label | null, throttle: { get(), set(v) } | null,
//                  holds: [{ label, code, toggle? }], actions: [{ label, code | run, primary? }], more: [...] }
// The first hold is the big button (Jump, Brake, Up). A hold with toggle: true latches (Sprint).
// The stick is analog: api.axes.x / api.axes.y in -1..1 (right / down positive).
//
// They switch on by themselves on a touch screen, including when a desktop browser switches to device emulation
// after the page has loaded, and hide again if a mouse takes over. ?touch forces them on, ?notouch off.
export function createTouch(api) {
  const Qs = new URLSearchParams(location.search);
  if (Qs.has('notouch')) return null;
  let root = null, on = false;

  function build() {
    root = document.createElement('div'); root.id = 'touch';
    root.innerHTML = `
      <div class="t-zone" aria-label="Movement: touch and drag"></div>
      <div class="t-stick" aria-hidden="true"><div class="t-knob"></div><span class="t-lab"></span></div>
      <div class="t-thr" aria-label="Throttle"><div class="t-fill"></div><div class="t-grip"></div><span class="t-lab">Throttle</span></div>
      <div class="t-pad"></div>
      <button type="button" class="t-use" hidden></button>
      <div class="t-acts"></div>
      <div class="t-more" hidden></div>`;
    document.body.appendChild(root);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    const $ = (s) => root.querySelector(s);
    const zone = $('.t-zone'), stick = $('.t-stick'), knob = $('.t-knob'), thr = $('.t-thr'), fill = $('.t-fill'), grip = $('.t-grip');
    const pad = $('.t-pad'), use = $('.t-use'), acts = $('.t-acts'), more = $('.t-more');
    const buzz = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not supported */ } };

    // ---- the floating stick: it appears under your thumb and follows it if you drag past the rim ----
    let sid = null, cx = 0, cy = 0; const R = 56;
    const home = () => { const r = zone.getBoundingClientRect(); return [r.left + 96, r.bottom - 110]; };
    const placeStick = (x, y) => { stick.style.left = `${x - 70}px`; stick.style.top = `${y - 70}px`; };
    const setStick = (x, y) => { api.axes.x = x; api.axes.y = y; knob.style.transform = `translate(${(x * R).toFixed(1)}px, ${(y * R).toFixed(1)}px)`; };
    const rest = () => { const [x, y] = home(); placeStick(x, y); stick.classList.remove('live'); setStick(0, 0); };
    zone.addEventListener('pointerdown', (e) => { if (sid !== null) return; sid = e.pointerId; try { zone.setPointerCapture(sid); } catch (err) { /* capture is a nicety */ } cx = e.clientX; cy = e.clientY; placeStick(cx, cy); stick.classList.add('live'); moveStick(e); e.preventDefault(); });
    const moveStick = (e) => {
      if (e.pointerId !== sid) return;
      let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R; const l = Math.hypot(x, y);
      if (l > 1.25) { cx += (x / l) * (l - 1.25) * R; cy += (y / l) * (l - 1.25) * R; placeStick(cx, cy); } // drag the base along
      if (l > 1) { x /= l; y /= l; }
      const dz = (v) => (Math.abs(v) < 0.1 ? 0 : (v - Math.sign(v) * 0.1) / 0.9);
      setStick(dz(x), dz(y));
    };
    zone.addEventListener('pointermove', moveStick);
    const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; rest(); };
    zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);
    addEventListener('resize', () => { if (sid === null) rest(); });

    // ---- the throttle (flight): drag up and down, it stays where you leave it ----
    let tid = null, ctx = null;
    const setThr = (e) => { const r = thr.getBoundingClientRect(); const v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)); ctx && ctx.throttle && ctx.throttle.set(v); };
    thr.addEventListener('pointerdown', (e) => { tid = e.pointerId; try { thr.setPointerCapture(tid); } catch (err) { /* fine */ } setThr(e); e.preventDefault(); });
    thr.addEventListener('pointermove', (e) => { if (e.pointerId === tid) setThr(e); });
    const endThr = (e) => { if (e.pointerId === tid) tid = null; };
    thr.addEventListener('pointerup', endThr); thr.addEventListener('pointercancel', endThr);

    // ---- buttons ----
    const press = (a) => { buzz(); if (a.run) a.run(); else api.tap(a.code); };
    const latched = new Set(); // toggles that are on (Sprint), kept across re-renders
    function holdButton(h, i) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = h.label; b.className = i === 0 ? 't-big' : 't-small'; b.dataset.i = i;
      if (h.toggle) {
        if (latched.has(h.code)) { b.classList.add('on'); api.keys.add(h.code); }
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); buzz(); if (latched.has(h.code)) { latched.delete(h.code); api.keys.delete(h.code); b.classList.remove('on'); } else { latched.add(h.code); api.keys.add(h.code); b.classList.add('on'); } });
        return b;
      }
      b.addEventListener('pointerdown', (e) => { api.keys.add(h.code); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } buzz(); e.preventDefault(); });
      const up = () => { api.keys.delete(h.code); b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b._up = up; return b;
    }
    function chip(a) { const b = document.createElement('button'); b.type = 'button'; b.textContent = a.label; b.addEventListener('click', () => { press(a); b.blur(); }); return b; }
    use.addEventListener('click', () => { if (use._a) { press(use._a); buzz(14); } });

    let sigH = '', sigA = '';
    function render() {
      if (!on) return;
      ctx = api.context();
      const sh = JSON.stringify([ctx.stick, !!ctx.throttle, ctx.holds.map((h) => h.label + h.code + !!h.toggle)]);
      if (sh !== sigH) { // the movement controls: re-made only when the mode changes, so a held button is not cut off
        sigH = sh;
        stick.hidden = zone.hidden = !ctx.stick; stick.querySelector('.t-lab').textContent = ctx.stick || '';
        thr.hidden = !ctx.throttle; root.classList.toggle('has-thr', !!ctx.throttle);
        for (const b of pad.querySelectorAll('button')) if (b._up) b._up();
        for (const code of [...latched]) if (!ctx.holds.some((h) => h.code === code && h.toggle)) { latched.delete(code); api.keys.delete(code); }
        pad.replaceChildren(...ctx.holds.map(holdButton)); pad.dataset.n = ctx.holds.length;
        if (!ctx.stick && sid !== null) { sid = null; } if (!ctx.stick) setStick(0, 0); else if (sid === null) rest();
      }
      const sa = JSON.stringify([ctx.actions.map((a) => a.label + !!a.primary), (ctx.more || []).map((a) => a.label)]);
      if (sa !== sigA) {
        const first = !use._a;
        sigA = sa;
        const prim = ctx.actions.find((a) => a.primary);
        use.hidden = !prim; use._a = prim || null; if (prim) { use.textContent = prim.label; if (!first) { use.classList.remove('pop'); void use.offsetWidth; use.classList.add('pop'); buzz(5); } }
        const list = ctx.actions.filter((a) => !a.primary).map(chip);
        if (ctx.more && ctx.more.length) { const m = document.createElement('button'); m.type = 'button'; m.textContent = '···'; m.setAttribute('aria-label', 'More'); m.addEventListener('click', () => { more.hidden = !more.hidden; buzz(); }); list.push(m); }
        acts.replaceChildren(...list);
        more.replaceChildren(...(ctx.more || []).map((a) => { const b = chip(a); b.addEventListener('click', () => { more.hidden = true; }); return b; }));
        if (!ctx.more || !ctx.more.length) more.hidden = true;
      }
      if (ctx.throttle) { const v = ctx.throttle.get(); fill.style.height = (v * 100).toFixed(1) + '%'; grip.style.bottom = `calc(${(v * 100).toFixed(1)}% - 3px)`; }
    }
    rest(); setInterval(render, 150);
    root._render = render;
  }

  function enable() { if (on) return; on = true; if (!root) build(); root.hidden = false; document.body.classList.add('touch'); root._render(); }
  function disable() { if (!on || Qs.has('touch')) return; on = false; root.hidden = true; document.body.classList.remove('touch'); api.axes.x = api.axes.y = 0; }

  const coarse = matchMedia('(pointer: coarse)');
  if (coarse.matches || Qs.has('touch')) enable();
  coarse.addEventListener?.('change', (e) => (e.matches ? enable() : disable()));
  // the first real touch switches them on; a real mouse (not a touch turned into a mouse event) switches them off
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') enable(); }, { capture: true, passive: true });
  addEventListener('touchstart', () => enable(), { capture: true, passive: true });
  let mouseMoves = 0;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && on && !coarse.matches && e.movementX | e.movementY) { mouseMoves++; if (mouseMoves > 30) { mouseMoves = 0; disable(); } } }, { passive: true });
  return { enable, disable, get on() { return on; } };
}
