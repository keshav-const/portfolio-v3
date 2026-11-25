// Touch controls for phones and tablets: a stick on the left (the W A S D keys) and buttons on the right.
// They press the same keys the keyboard does, so every mode (flight, lander, on foot) works unchanged.
export function createTouch(keys, { action }) {
  const want = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
  if (!want) return null;
  document.body.classList.add('touch');
  const root = document.createElement('div'); root.id = 'touch'; root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="stick"><div class="knob"></div></div>
    <div class="pad">
      <button type="button" data-hold="Space">Up</button>
      <button type="button" data-hold="ShiftLeft">Down</button>
      <button type="button" data-hold="KeyR">Boost</button>
    </div>`;
  document.body.appendChild(root);
  const stick = root.querySelector('.stick'), knob = root.querySelector('.knob');
  let id = null, cx = 0, cy = 0;
  const R = 52, set = (code, on) => (on ? keys.add(code) : keys.delete(code));
  const apply = (x, y) => { // dead zone, then each axis presses its key
    set('KeyW', y < -0.35); set('KeyS', y > 0.35); set('KeyA', x < -0.35); set('KeyD', x > 0.35);
    knob.style.transform = `translate(${(x * R).toFixed(1)}px, ${(y * R).toFixed(1)}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { id = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(id); move(e); e.preventDefault(); });
  const move = (e) => { if (e.pointerId !== id) return; let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } apply(x, y); };
  stick.addEventListener('pointermove', move);
  const end = (e) => { if (e.pointerId !== id) return; id = null; apply(0, 0); };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  root.querySelectorAll('[data-hold]').forEach((b) => {
    const code = b.dataset.hold;
    b.addEventListener('pointerdown', (e) => { keys.add(code); b.setPointerCapture(e.pointerId); e.preventDefault(); });
    const up = () => keys.delete(code); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  });
  return root;
}
