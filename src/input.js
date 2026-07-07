// Keyboard + pointer input. Exposes a small polling surface plus event hooks.
export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.pressed = new Set();   // edge: became-down this frame
    this.handlers = { press: [] };
    this.pointer = { x: 0, y: 0, down: false };
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
      const p = pointFrom(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
    };
    this._onDown = (e) => { this.pointer.down = true; this._onMove(e); };
    this._onUp = () => { this.pointer.down = false; };

    target.addEventListener('keydown', this._onKeyDown, { passive: false });
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('blur', this._onBlur);
    target.addEventListener('pointermove', this._onMove);
    target.addEventListener('pointerdown', this._onDown);
    target.addEventListener('pointerup', this._onUp);
  }

  onPress(fn) { this.handlers.press.push(fn); }
  down(k) { return this.keys.has(k); }
  anyDown(list) { return list.some((k) => this.keys.has(k)); }

  // Movement vector from WASD / arrows, normalized.
  axis() {
    let x = 0, y = 0;
    if (this.anyDown(['a', 'arrowleft'])) x -= 1;
    if (this.anyDown(['d', 'arrowright'])) x += 1;
    if (this.anyDown(['w', 'arrowup'])) y -= 1;
    if (this.anyDown(['s', 'arrowdown'])) y += 1;
    const m = Math.hypot(x, y);
    return m > 0 ? { x: x / m, y: y / m, mag: 1 } : { x: 0, y: 0, mag: 0 };
  }

  endFrame() { this.pressed.clear(); }
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
