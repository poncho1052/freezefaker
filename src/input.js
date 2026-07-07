// Keyboard + pointer input. Exposes a small polling surface plus event hooks.
export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.pressed = new Set();   // edge: became-down this frame
    this.handlers = { press: [] };
    this.pointer = { x: 0, y: 0, down: false };
    this.clicked = false;        // left-button edge this frame (tap on touch)
    this.rightClicked = false;   // right-button edge (long-press on touch)
    this.hasTouch = false;       // becomes true on the first touch input
    // Virtual joystick (left side of the screen on touch devices).
    this.joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this._taps = new Map();      // pointerId -> {x, y, t, moved}
    this._target = target;

    this._onKeyDown = (e) => {
      const k = normalize(e);
      if (k === null) return;
      // Prevent page scroll on gameplay keys.
      if (GAMEPLAY_KEYS.has(k)) e.preventDefault();
      if (!this.keys.has(k)) {
        this.pressed.add(k);
        for (const h of this.handlers.press) h(k, e);
      }
      this.keys.add(k);
    };
    this._onKeyUp = (e) => {
      const k = normalize(e);
      if (k === null) return;
      this.keys.delete(k);
    };
    this._onBlur = () => this.keys.clear();
    this._onMove = (e) => {
      if (e.pointerType === 'touch') {
        if (this.joy.active && e.pointerId === this.joy.id) {
          this.joy.x = e.clientX; this.joy.y = e.clientY;
          return;
        }
        const tap = this._taps.get(e.pointerId);
        if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 14) tap.moved = true;
        this.pointer.x = e.clientX; this.pointer.y = e.clientY;
        return;
      }
      const p = pointFrom(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
    };
    this._onDown = (e) => {
      if (e.pointerType === 'touch') {
        this.hasTouch = true;
        // Left 45% of the screen = movement stick; the rest = tap/hold input.
        // HUD buttons win over the stick zone (set via input.hitTest).
        const onHud = this.hitTest && this.hitTest(e.clientX, e.clientY);
        if (!this.joy.active && !onHud && e.clientX < window.innerWidth * 0.45) {
          this.joy = { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        } else {
          this._taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
          this.pointer.x = e.clientX; this.pointer.y = e.clientY; this.pointer.down = true;
        }
        return;
      }
      this.pointer.down = true; this._onMove(e);
      if (e.button === 2) this.rightClicked = true; else this.clicked = true;
    };
    this._onUp = (e) => {
      if (e.pointerType === 'touch') {
        if (this.joy.active && e.pointerId === this.joy.id) { this.joy.active = false; return; }
        const tap = this._taps.get(e.pointerId);
        this._taps.delete(e.pointerId);
        this.pointer.down = this._taps.size > 0;
        if (tap && !tap.moved) {
          const held = performance.now() - tap.t;
          this.pointer.x = tap.x; this.pointer.y = tap.y;
          if (held < 350) this.clicked = true;
          else if (held >= 450) this.rightClicked = true;
        }
        return;
      }
      this.pointer.down = false;
    };
    this._onCancel = (e) => {
      if (this.joy.active && e.pointerId === this.joy.id) this.joy.active = false;
      this._taps.delete(e.pointerId);
    };
    this._onCtx = (e) => e.preventDefault(); // allow right-click as a game button

    target.addEventListener('keydown', this._onKeyDown, { passive: false });
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('blur', this._onBlur);
    target.addEventListener('pointermove', this._onMove);
    target.addEventListener('pointerdown', this._onDown);
    target.addEventListener('pointerup', this._onUp);
    target.addEventListener('pointercancel', this._onCancel);
    target.addEventListener('contextmenu', this._onCtx);
  }

  onPress(fn) { this.handlers.press.push(fn); }
  down(k) { return this.keys.has(k); }
  anyDown(list) { return list.some((k) => this.keys.has(k)); }

  // Movement vector from WASD / arrows or the virtual stick, normalized.
  axis() {
    if (this.joy.active) {
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy;
      const m = Math.hypot(dx, dy);
      if (m < 10) return { x: 0, y: 0, mag: 0 };
      const cap = 58;
      return { x: dx / m, y: dy / m, mag: Math.min(1, m / cap) };
    }
    let x = 0, y = 0;
    if (this.anyDown(['a', 'arrowleft'])) x -= 1;
    if (this.anyDown(['d', 'arrowright'])) x += 1;
    if (this.anyDown(['w', 'arrowup'])) y -= 1;
    if (this.anyDown(['s', 'arrowdown'])) y += 1;
    const m = Math.hypot(x, y);
    return m > 0 ? { x: x / m, y: y / m, mag: 1 } : { x: 0, y: 0, mag: 0 };
  }

  // Jog: hold Shift, or saturate the stick.
  jogging() { return this.down('shift') || (this.joy.active && this.axis().mag > 0.96); }

  endFrame() { this.pressed.clear(); this.clicked = false; this.rightClicked = false; }
}

const GAMEPLAY_KEYS = new Set([
  'w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  ' ', 'e', 'q', 'shift', '1', '2', '3', '4', '5', '6',
]);

function normalize(e) {
  let k = e.key;
  if (k === undefined) return null;
  k = k.toLowerCase();
  if (k === 'spacebar') k = ' ';
  return k;
}

function pointFrom(e) {
  return { x: e.clientX, y: e.clientY };
}
