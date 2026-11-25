// Touch controls for phones and tablets. They change with what you are doing: flying the vessel, in orbit, docked,
// flying the lander, on foot, driving, inside Mission Control. The game describes the current mode through
// api.context(); this module draws a stick, hold buttons, a throttle and one-tap actions for it.
//   context() -> { stick: 'Steer' | null, throttle: { get(), set(v) } | null, holds: [{ label, code }], actions: [{ label, code | run }], more: [...] }
// The stick is analog: api.axes.x / api.axes.y in -1..1 (right / down positive).
export function createTouch(api) {
  const want = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
  if (!want) return null;
  document.body.classList.add('touch');
  const root = document.createElement('div'); root.id = 'touch';
  root.innerHTML = `
    <div class="t-stick" aria-label="Movement stick"><div class="t-knob"></div><span class="t-lab"></span></div>
    <div class="t-thr" aria-label="Throttle"><div class="t-fill"></div><div class="t-grip"></div><span class="t-lab">Throttle</span></div>
    <div class="t-holds"></div>
    <div class="t-acts"></div>
    <div class="t-more" hidden></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const stick = $('.t-stick'), knob = $('.t-knob'), thr = $('.t-thr'), fill = $('.t-fill'), grip = $('.t-grip'), holds = $('.t-holds'), acts = $('.t-acts'), more = $('.t-more');
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* not supported */ } };

  // ---- the stick ----
  let sid = null, cx = 0, cy = 0; const R = 54;
  const setStick = (x, y) => { api.axes.x = x; api.axes.y = y; knob.style.transform = `translate(${(x * R).toFixed(1)}px, ${(y * R).toFixed(1)}px)`; };
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(sid); moveStick(e); e.preventDefault(); });
  const moveStick = (e) => { if (e.pointerId !== sid) return; let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88); setStick(dz(x), dz(y)); };
  stick.addEventListener('pointermove', moveStick);
  const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; setStick(0, 0); };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

  // ---- the throttle: drag up and down; it stays where you leave it ----
  let tid = null, ctx = null;
  const setThr = (e) => { const r = thr.getBoundingClientRect(); const v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)); ctx && ctx.throttle && ctx.throttle.set(v); };
  thr.addEventListener('pointerdown', (e) => { tid = e.pointerId; thr.setPointerCapture(tid); setThr(e); e.preventDefault(); });
  thr.addEventListener('pointermove', (e) => { if (e.pointerId === tid) setThr(e); });
  const endThr = (e) => { if (e.pointerId === tid) tid = null; };
  thr.addEventListener('pointerup', endThr); thr.addEventListener('pointercancel', endThr);

  // ---- buttons ----
  const press = (a) => { buzz(); if (a.run) a.run(); else { api.tap(a.code); } };
  function holdButton(h) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = h.label;
    b.addEventListener('pointerdown', (e) => { api.keys.add(h.code); b.classList.add('on'); b.setPointerCapture(e.pointerId); buzz(); e.preventDefault(); });
    const up = () => { api.keys.delete(h.code); b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    return b;
  }
  function actButton(a) { const b = document.createElement('button'); b.type = 'button'; b.textContent = a.label; if (a.primary) b.classList.add('primary-t'); b.addEventListener('click', () => { press(a); b.blur(); }); return b; }

  let sig = '';
  function render() {
    ctx = api.context();
    const s = JSON.stringify([ctx.stick, !!ctx.throttle, ctx.holds.map((h) => h.label + h.code), ctx.actions.map((a) => a.label), (ctx.more || []).map((a) => a.label)]);
    if (s !== sig) {
      sig = s;
      stick.hidden = !ctx.stick; $('.t-stick .t-lab').textContent = ctx.stick || '';
      thr.hidden = !ctx.throttle;
      for (const b of holds.querySelectorAll('button')) b.dispatchEvent(new Event('pointercancel'));
      holds.replaceChildren(...ctx.holds.map(holdButton));
      const list = ctx.actions.map(actButton);
      if (ctx.more && ctx.more.length) { const m = document.createElement('button'); m.type = 'button'; m.textContent = '···'; m.setAttribute('aria-label', 'More'); m.addEventListener('click', () => { more.hidden = !more.hidden; buzz(); }); list.push(m); }
      acts.replaceChildren(...list);
      more.replaceChildren(...(ctx.more || []).map((a) => { const b = actButton(a); b.addEventListener('click', () => { more.hidden = true; }); return b; }));
      if (!ctx.more || !ctx.more.length) more.hidden = true;
      if (!ctx.stick) setStick(0, 0);
    }
    if (ctx.throttle) { const v = ctx.throttle.get(); fill.style.height = (v * 100).toFixed(1) + '%'; grip.style.bottom = `calc(${(v * 100).toFixed(1)}% - 3px)`; }
  }
  render(); setInterval(render, 200);
  return root;
}
