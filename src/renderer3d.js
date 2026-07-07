// 3D renderer (Three.js): semi-deformed doll-like crowd in a night station
// plaza, per the key visual. Implements the same interface as the 2D
// Renderer so game.js / online.js don't care which one is active:
//   updateCamera(focus, dt, viewW, viewH) · render(scene) · s2w(sx, sy)
//   addShake(a) · punchZoom(x, y, amt, time) · ctx/vw/vh/dpr for the HUD.
// Sim coordinates stay 2D: sim (x, y) -> 3D (x, 0, y), +y is "up".
import * as THREE from '../vendor/three.module.js';
import { PALETTE } from './config.js';
import { Renderer as Renderer2D } from './renderer.js';

const H = {                     // character proportions (sim px units)
  legH: 15, bodyH: 15, headH: 13,
};

export function createRenderer(canvas, overlay, world) {
  try {
    const r = new Renderer3D(canvas, overlay, world);
    return r;
  } catch (e) {
    console.warn('WebGL unavailable, falling back to 2D renderer:', e && e.message);
    if (overlay) {
      const c = overlay.getContext('2d');
      c && c.clearRect(0, 0, overlay.width, overlay.height);
    }
    return new Renderer2D(canvas, world);
  }
}

export class Renderer3D {
  constructor(canvas, overlay, world) {
    this.world = world;
    this.canvas = canvas;
    this.overlay = overlay;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.r = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.r.setClearColor(0x0d1520);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x121a24, 1900, 4600);

    this.camera = new THREE.PerspectiveCamera(50, 1, 10, 4200);
    this.camPos = new THREE.Vector3(world.w / 2, 700, world.h / 2 + 500);
    this.camAim = new THREE.Vector3(world.w / 2, 0, world.h / 2);

    // lights
    this.hemi = new THREE.HemisphereLight(0xbfc9d4, 0x2e3540, 1.05);
    this.sun = new THREE.DirectionalLight(0xfff2df, 1.15);
    this.sun.position.set(400, 900, 500);
    this.scene.add(this.hemi, this.sun);

    this._geoCache = new Map();
    this._matCache = new Map();
    this._charMeshes = new Map(); // id -> rig
    this._signalLamps = [];

    this._buildWorld();

    // camera feel
    this.shake = 0;
    this.punchT = 0; this.punchDur = 0.0001; this.punchAmt = 0; this.punchFocus = null;
    this._lastT = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------------- shared plumbing ----------------
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.vw = w; this.vh = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.r.setPixelRatio(Math.min(this.dpr, 1.5));
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.overlay) {
      this.overlay.width = Math.floor(w * this.dpr);
      this.overlay.height = Math.floor(h * this.dpr);
      this.ctx = this.overlay.getContext('2d');
    }
  }

  addShake(a) { this.shake = Math.max(this.shake, a); }

  // Snap the camera to a world point instantly (round-intro flyover start).
  jumpTo(x, y) {
    this.camPos.set(x, 360, y + 285);
    this.camAim.set(x, 22, y - 75);
  }
  punchZoom(x, y, amt, time) { this.punchT = time; this.punchDur = time; this.punchAmt = amt; this.punchFocus = { x, y }; }

  updateCamera(focus, dt = 0.016, viewW = 1240) {
    const watcher = viewW >= 1500;
    let tx = focus.x, tz = focus.y;
    let off, aim;
    if (watcher) {
      off = new THREE.Vector3(0, 930, 620);
      aim = new THREE.Vector3(this.world.w / 2, 0, this.world.h / 2 - 60);
      tx = this.world.w / 2; tz = this.world.h / 2 + 40;
    } else {
      off = new THREE.Vector3(0, 360, 285);
      aim = new THREE.Vector3(tx, 22, tz - 75);
    }
    let fov = watcher ? 46 : 50;
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - dt);
      const e = (this.punchT / this.punchDur) ** 2;
      fov *= 1 - 0.32 * this.punchAmt * e;
      if (this.punchFocus) {
        tx += (this.punchFocus.x - tx) * e; tz += (this.punchFocus.y - tz) * e;
        aim.x += (this.punchFocus.x - aim.x) * e; aim.z += (this.punchFocus.y - aim.z) * e;
        off.multiplyScalar(1 - 0.35 * e);
      }
    }
    const want = new THREE.Vector3(tx + off.x, off.y, tz + off.z);
    const k = 1 - Math.pow(this.punchT > 0 ? 0.000001 : 0.002, dt);
    this.camPos.lerp(want, Math.min(1, k));
    this.camAim.lerp(aim, Math.min(1, k * 1.15));

    this.shake = Math.max(0, this.shake - dt * 34);
    const s = this.shake * 0.8;
    this.camera.position.set(
      this.camPos.x + (Math.random() * 2 - 1) * s,
      this.camPos.y + (Math.random() * 2 - 1) * s * 0.5,
      this.camPos.z + (Math.random() * 2 - 1) * s,
    );
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.camAim);
  }

  s2w(sx, sy) {
    const ndc = new THREE.Vector2((sx / this.vw) * 2 - 1, -(sy / this.vh) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    if (!isFinite(t) || t < 0) return { x: this.world.w / 2, y: this.world.h / 2 };
    const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
    return { x: p.x, y: p.z };
  }

  _project(x, h, z) {
    const v = new THREE.Vector3(x, h, z).project(this.camera);
    return { x: (v.x + 1) / 2 * this.vw, y: (1 - v.y) / 2 * this.vh, ok: v.z < 1 };
  }

  // ---------------- world construction ----------------
  _geo(kind, ...dims) {
    const key = kind + dims.join(',');
    if (!this._geoCache.has(key)) {
      let g;
      if (kind === 'box') g = new THREE.BoxGeometry(...dims);
      else if (kind === 'cyl') g = new THREE.CylinderGeometry(...dims);
      else if (kind === 'circle') g = new THREE.CircleGeometry(...dims);
      this._geoCache.set(key, g);
    }
    return this._geoCache.get(key);
  }

  _mat(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (!this._matCache.has(key)) {
      const m = new THREE.MeshLambertMaterial({ color, ...opts });
      this._matCache.set(key, m);
    }
    return this._matCache.get(key);
  }

  _box(w, h, d, color, opts) {
    return new THREE.Mesh(this._geo('box', w, h, d), this._mat(color, opts));
  }

  _buildWorld() {
    const W = this.world;

    // ---- ground with painted texture (tiles, tactile strip, crosswalk) ----
    const gc = document.createElement('canvas');
    gc.width = 1680; gc.height = 1040;
    const g = gc.getContext('2d');
    g.fillStyle = '#b7b3a8'; g.fillRect(0, 0, gc.width, gc.height);
    g.strokeStyle = 'rgba(90,88,80,0.16)'; g.lineWidth = 2;
    for (let x = 0; x <= gc.width; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, gc.height); g.stroke(); }
    for (let y = 0; y <= gc.height; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(gc.width, y); g.stroke(); }
    g.fillStyle = 'rgba(172,167,155,0.5)';
    for (let i = 0; i < 260; i++) g.fillRect((i * 733) % gc.width, (i * 389) % gc.height, 80, 80);
    // tactile paving strip to the gate
    g.fillStyle = '#d9ae3c'; g.fillRect(gc.width / 2 - 10, 190, 20, gc.height - 190);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 195; y < gc.height; y += 20) g.fillRect(gc.width / 2 - 10, y, 20, 3);
    // crosswalk + curbs from props
    for (const p of W.props) {
      if (p.type === 'crosswalk') {
        g.fillStyle = 'rgba(240,238,230,0.92)';
        for (let x = p.x; x < p.x + p.w; x += 46) g.fillRect(x, p.y, 26, p.h);
      }
    }
    const groundTex = new THREE.CanvasTexture(gc);
    groundTex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(W.w, W.h),
      new THREE.MeshLambertMaterial({ map: groundTex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(W.w / 2, 0, W.h / 2);
    this.scene.add(ground);

    // dark asphalt beyond the plaza
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(W.w * 4, W.h * 4), this._mat('#3a4048'));
    apron.rotation.x = -Math.PI / 2; apron.position.set(W.w / 2, -0.5, W.h / 2);
    this.scene.add(apron);

    // ---- distant skyline (night city backdrop) with neon signs ----
    const NEON = [
      { t: 'カラオケ 747', bg: '#7c1f3f', fg: '#ffd7e0' }, { t: 'BOOKS', bg: '#1c4a43', fg: '#a9f5d0' },
      { t: 'ホテル月光', bg: '#203a66', fg: '#bcd8ff' }, { t: '駅前通り', bg: '#6e4a17', fg: '#ffe9b8' },
      { t: 'ラーメン', bg: '#7a2222', fg: '#ffd2a8' }, { t: 'CAMERA', bg: '#274a63', fg: '#c4ecff' },
    ];
    for (let i = 0; i < 14; i++) {
      const bw = 130 + (i * 97) % 160, bh = 260 + (i * 173) % 420;
      const bx = -240 + i * (W.w + 480) / 14;
      const b = this._box(bw, bh, 90, '#141d2a');
      b.position.set(bx, bh / 2, -190);
      this.scene.add(b);
      const win = new THREE.Mesh(this._geo('box', bw * 0.92, bh * 0.9, 2), this._winMat(i));
      win.position.set(bx, bh / 2 + 8, -144);
      this.scene.add(win);
      if (i % 2 === 0) {
        const n = NEON[(i / 2) % NEON.length];
        const sw = Math.min(bw * 0.9, 150);
        const sign = new THREE.Mesh(this._geo('box', sw, 34, 3), this._label(n.t, sw, 34, { bg: n.bg, fg: n.fg, fs: 0.5 }));
        sign.position.set(bx, bh - 40 - (i * 53) % 120, -142);
        this.scene.add(sign);
      }
    }

    // ---- street trees flanking the plaza (visual only, off the walk area) ----
    for (const [tx, tz] of [[70, 330], [W.w - 70, 330], [70, 700], [W.w - 70, 700], [430, 236], [W.w - 430, 236]]) {
      this._tree(tx, tz);
    }

    // ---- props ----
    for (const p of W.props) this._buildProp(p);

    // ---- goal beacon: a soft green light pillar at the gate ----
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(30, 44, 240, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x2ECC71, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.set(W.goal.x, 120, W.goal.y + 12);
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 10, 250, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7ee2a1, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
    );
    core.position.copy(beam.position);
    this._beacon = beam; this._beaconCore = core;
    this.scene.add(beam, core);

    // ---- flowing chevrons along the tactile strip toward the gate ----
    this._chevrons = [];
    const chevGeo = new THREE.ConeGeometry(10, 18, 4);
    for (let i = 0; i < 8; i++) {
      const cone = new THREE.Mesh(chevGeo, new THREE.MeshBasicMaterial({ color: 0x2ECC71, transparent: true, opacity: 0.75 }));
      cone.rotation.x = -Math.PI / 2;      // point toward -z (the gate)
      cone.rotation.y = Math.PI / 4;
      cone.position.set(W.w / 2, 4, 0);
      this.scene.add(cone);
      this._chevrons.push(cone);
    }
  }

  _winMat(seed) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#101825'; x.fillRect(0, 0, 64, 128);
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 220; i++) {
      if (rnd() < 0.42) {
        x.fillStyle = rnd() < 0.8 ? 'rgba(255,224,150,0.85)' : 'rgba(150,210,255,0.8)';
        x.fillRect(4 + (i % 10) * 6, 4 + Math.floor(i / 10) * 5.4, 3.4, 3);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t });
  }

  _label(text, w, h, opts = {}) {
    const c = document.createElement('canvas');
    c.width = w * 4; c.height = h * 4;
    const x = c.getContext('2d');
    x.fillStyle = opts.bg || '#10161f'; x.fillRect(0, 0, c.width, c.height);
    if (opts.border) { x.strokeStyle = opts.border; x.lineWidth = 10; x.strokeRect(6, 6, c.width - 12, c.height - 12); }
    x.fillStyle = opts.fg || '#F2F1EC';
    x.font = `800 ${Math.floor(c.height * (opts.fs || 0.44))}px system-ui, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, c.width / 2, c.height / 2 + 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t });
  }

  _buildProp(p) {
    const S = this.scene;
    const cx = p.x + (p.w || 0) / 2, cz = p.y + (p.h || 0) / 2;
    if (p.type === 'station') {
      // white station facade with a dark title band, like the key visual
      const wingW = (p.w - 180) / 2, hgt = 190;
      const l = this._box(wingW, hgt, p.h, '#d6d3c9'); l.position.set(p.x + wingW / 2, hgt / 2, cz); S.add(l);
      const r = this._box(wingW, hgt, p.h, '#d6d3c9'); r.position.set(p.x + p.w - wingW / 2, hgt / 2, cz); S.add(r);
      const head = this._box(220, 70, p.h, '#c9c6bc'); head.position.set(cx, hgt - 35, cz); S.add(head);
      const band = new THREE.Mesh(this._geo('box', p.w, 44, 4), this._label('中央駅  CHUO STATION', p.w, 44, { bg: '#242B36', fg: '#F2F1EC', fs: 0.5 }));
      band.position.set(cx, 164, p.y + p.h + 3); S.add(band);
      // glowing gate mouth + green GATE sign
      const mouth = new THREE.Mesh(this._geo('box', 176, 112, 6), new THREE.MeshBasicMaterial({ color: 0x33455a }));
      mouth.position.set(cx, 56, p.y + p.h + 2); S.add(mouth);
      const sign = new THREE.Mesh(this._geo('box', 176, 32, 4), this._label('▲ GATE', 176, 32, { bg: '#0e1621', fg: '#7ee2a1', border: '#2ECC71', fs: 0.55 }));
      sign.position.set(cx, 126, p.y + p.h + 4); S.add(sign);
      const clock = new THREE.Mesh(this._geo('cyl', 12, 12, 4, 20), this._mat('#2b323d'));
      clock.rotation.x = Math.PI / 2; clock.position.set(cx, 208, p.y + p.h - 20); S.add(clock);
      this._pool(cx, p.y + p.h + 40, 120, '#9fd4b4', 0.16);
    } else if (p.type === 'cafe' || p.type === 'store') {
      const hgt = 150;
      const b = this._box(p.w, hgt, p.h, p.type === 'cafe' ? '#3d4653' : '#33425a');
      b.position.set(cx, hgt / 2, cz); S.add(b);
      // lit frontage + sign + awning
      const front = new THREE.Mesh(this._geo('box', p.w * 0.86, 62, 4), new THREE.MeshBasicMaterial({ color: p.type === 'cafe' ? 0x6b5a3c : 0x2f5d43 }));
      front.position.set(cx, 34, p.y + p.h + 2); S.add(front);
      const sign = new THREE.Mesh(
        this._geo('box', p.w * 0.8, 30, 4),
        this._label(p.label || '', p.w * 0.8, 30, { bg: p.type === 'cafe' ? '#241d12' : '#0f2b1d', fg: '#F2F1EC', fs: 0.52 })
      );
      sign.position.set(cx, 96, p.y + p.h + 3); S.add(sign);
      const awn = this._box(p.w * 0.9, 5, 26, p.type === 'cafe' ? '#3e7d7d' : '#2ECC71');
      awn.position.set(cx, 70, p.y + p.h + 12); S.add(awn);
      this._pool(cx, p.y + p.h + 42, 110, p.type === 'cafe' ? '#e8c78e' : '#a9dcb8', 0.18);
    } else if (p.type === 'signal') {
      const pole = new THREE.Mesh(this._geo('cyl', 3.4, 3.8, 120, 10), this._mat('#39404a'));
      pole.position.set(p.x, 60, p.y); S.add(pole);
      const head = this._box(20, 42, 12, '#1c222b'); head.position.set(p.x, 128, p.y); S.add(head);
      const mkLamp = (y, col) => {
        const lamp = new THREE.Mesh(this._geo('cyl', 6.4, 6.4, 3, 16), new THREE.MeshBasicMaterial({ color: col }));
        lamp.rotation.x = Math.PI / 2; lamp.position.set(p.x, y, p.y + 7); S.add(lamp);
        return lamp;
      };
      this._signalLamps.push({ red: mkLamp(138, 0x3a1512), green: mkLamp(118, 0x0f3320) });
    } else if (p.type === 'vending') {
      const b = this._box(p.w, 62, 26, p.hue || '#c33');
      b.position.set(cx, 31, p.y + 12); S.add(b);
      const face = new THREE.Mesh(this._geo('box', p.w * 0.8, 40, 3), this._vendingFace());
      face.position.set(cx, 36, p.y + 26); S.add(face);
      this._pool(cx, p.y + 52, 66, '#ffe2b8', 0.16);
    } else if (p.type === 'bench') {
      const seat = this._box(p.w, 5, 26, '#6e5844'); seat.position.set(cx, 16, cz); S.add(seat);
      const back = this._box(p.w, 22, 4, '#7a634c'); back.position.set(cx, 30, cz - 12); S.add(back);
      for (const dx of [-p.w / 2 + 10, p.w / 2 - 10]) {
        const leg = this._box(6, 16, 20, '#3a3f47'); leg.position.set(cx + dx, 8, cz); S.add(leg);
      }
    } else if (p.type === 'signboard') {
      const pole = new THREE.Mesh(this._geo('cyl', 3, 3, 60, 8), this._mat('#39404a'));
      pole.position.set(cx, 30, cz); S.add(pole);
      const panel = new THREE.Mesh(this._geo('box', p.w, 40, 5), this._label(p.text || 'SHOPPING ST.', p.w, 40, { bg: '#10161f', fg: '#F2F1EC', border: '#E53935', fs: 0.4 }));
      panel.position.set(cx, 74, cz); S.add(panel);
    } else if (p.type === 'shopwin') {
      const frame = this._box(p.w, 84, 14, '#2b323d'); frame.position.set(cx, 42, cz); S.add(frame);
      const glassSide = p.side === 'left' ? p.x + p.w + 1 : p.x - 1;
      const glass = new THREE.Mesh(this._geo('box', 2, 66, Math.max(60, p.h * 0.7)), new THREE.MeshBasicMaterial({ color: 0x88a7b4 }));
      glass.position.set(glassSide, 40, cz); S.add(glass);
    } else if (p.type === 'planter') {
      const base = this._box(p.w, 14, p.h, '#8d8a80'); base.position.set(cx, 7, cz); S.add(base);
      const hedge = this._box(p.w - 6, 16, p.h - 6, '#4b6b46'); hedge.position.set(cx, 24, cz); S.add(hedge);
      // flower dots
      const cols = ['#e57f8c', '#ffd166', '#f2f1ec'];
      for (let i = 0; i < 5; i++) {
        const f = this._box(4, 4, 4, cols[i % 3]);
        f.position.set(p.x + 8 + ((i * 37) % Math.max(8, p.w - 16)), 33, p.y + 6 + ((i * 23) % Math.max(6, p.h - 12)));
        S.add(f);
      }
    } else if (p.type === 'busstop') {
      const pole = new THREE.Mesh(this._geo('cyl', 3, 3, 74, 8), this._mat('#39404a'));
      pole.position.set(cx, 37, cz); S.add(pole);
      const disc = new THREE.Mesh(this._geo('cyl', 14, 14, 3, 16), this._mat('#5a7cae'));
      disc.position.set(cx, 82, cz); S.add(disc);
    }
    // skyline / crosswalk / gate handled elsewhere
  }

  // Warm light pool decal on the pavement (storefront glow).
  _pool(x, z, r, color, alpha) {
    const key = color + alpha;
    if (!this._poolMats) this._poolMats = new Map();
    if (!this._poolMats.has(key)) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const [cr, cg, cb] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
      const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this._poolMats.set(key, new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: alpha, depthWrite: false }));
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), this._poolMats.get(key));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.8, z);
    this.scene.add(m);
  }

  _tree(x, z) {
    const trunk = new THREE.Mesh(this._geo('cyl', 4.5, 6, 34, 8), this._mat('#5a4634'));
    trunk.position.set(x, 17, z); this.scene.add(trunk);
    const g1 = this._box(46, 34, 46, '#4e7247'); g1.position.set(x, 52, z); g1.rotation.y = 0.5; this.scene.add(g1);
    const g2 = this._box(32, 26, 32, '#5d8352'); g2.position.set(x + 6, 74, z - 4); g2.rotation.y = 1.1; this.scene.add(g2);
  }

  _vendingFace() {
    if (this._vendMat) return this._vendMat;
    const c = document.createElement('canvas'); c.width = 64; c.height = 40;
    const x = c.getContext('2d');
    x.fillStyle = '#182027'; x.fillRect(0, 0, 64, 40);
    const cols = ['#e66', '#6ae', '#fc5', '#7d8', '#eee'];
    for (let i = 0; i < 12; i++) {
      x.fillStyle = cols[i % 5];
      x.fillRect(6 + (i % 4) * 14, 6 + Math.floor(i / 4) * 10, 9, 7);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this._vendMat = new THREE.MeshBasicMaterial({ map: t });
    return this._vendMat;
  }

  // ---------------- characters ----------------
  _rigFor(c) {
    let rig = this._charMeshes.get(c.id);
    if (rig) return rig;
    const a = c.appearance;
    const s = a.scale;
    const root = new THREE.Group();

    // legs pivot at the hip via wrapper groups
    const legL = this._box(6, H.legH, 7, a.pants);
    const legR = this._box(6, H.legH, 7, a.pants);
    const hipL = new THREE.Group(); hipL.position.set(-4.4, H.legH, 0); hipL.add(legL); legL.position.set(0, -H.legH / 2, 0);
    const hipR = new THREE.Group(); hipR.position.set(4.4, H.legH, 0); hipR.add(legR); legR.position.set(0, -H.legH / 2, 0);

    const body = this._box(17, H.bodyH, 10, a.clothing);
    body.position.y = H.legH + H.bodyH / 2;

    const armL = new THREE.Group(); armL.position.set(-10.6, H.legH + H.bodyH - 2, 0);
    const armR = new THREE.Group(); armR.position.set(10.6, H.legH + H.bodyH - 2, 0);
    const armMeshL = this._box(4.6, 15, 5.4, a.clothing); armMeshL.position.y = -7;
    const armMeshR = this._box(4.6, 15, 5.4, a.clothing); armMeshR.position.y = -7;
    armL.add(armMeshL); armR.add(armMeshR);

    const headG = new THREE.Group(); headG.position.y = H.legH + H.bodyH;
    const head = this._box(14.5, H.headH, 13, a.skin); head.position.y = H.headH / 2 + 1;
    headG.add(head);
    // hair: cap + back per style
    const hairTop = this._box(15.2, 4.5, 13.8, a.hair); hairTop.position.y = H.headH + 1.2; headG.add(hairTop);
    if (a.hairStyle >= 1) { const back = this._box(15.2, 9, 3.4, a.hair); back.position.set(0, H.headH - 4.5, -5.4); headG.add(back); }
    if (a.hairStyle === 3) { const bun = this._box(6, 5, 5, a.hair); bun.position.set(0, H.headH + 3.4, -4); headG.add(bun); }
    // face: two eyes
    for (const dx of [-3.2, 3.2]) {
      const eye = this._box(1.8, 2.2, 1, '#1c2027'); eye.position.set(dx, H.headH / 2 + 2, 6.8); headG.add(eye);
    }
    if (a.glasses) { const gl = this._box(11.4, 2.6, 1.2, '#20242b'); gl.position.set(0, H.headH / 2 + 2.2, 7.1); headG.add(gl); }
    if (a.hat) {
      const brim = new THREE.Mesh(this._geo('cyl', 9.4, 9.4, 1.4, 12), this._mat(a.hat)); brim.position.y = H.headH + 3.4; headG.add(brim);
      const top = new THREE.Mesh(this._geo('cyl', 6.6, 7.2, 5.4, 12), this._mat(a.hat)); top.position.y = H.headH + 6.2; headG.add(top);
    }
    if (a.bag) { const bag = this._box(4.5, 10, 8, a.bag); bag.position.set(-13.4, H.legH + 4, 0); root.add(bag); }

    // phone prop (visible only in phone pose)
    const phone = this._box(3.6, 6, 1.2, '#e8e6df'); phone.position.set(6.4, H.legH + H.bodyH + 3.5, 7.4);
    phone.visible = false;

    // blob shadow
    const blob = new THREE.Mesh(this._geo('circle', 11, 18), new THREE.MeshBasicMaterial({ color: 0x0a0e14, transparent: true, opacity: 0.28 }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.6;

    root.add(hipL, hipR, body, armL, armR, headG, phone, blob);
    root.scale.setScalar(s);
    this.scene.add(root);
    rig = { root, hipL, hipR, armL, armR, headG, body, phone, blob, bodyMat: body.material };
    this._charMeshes.set(c.id, rig);
    return rig;
  }

  _poseRig(rig, c, t) {
    const walking = c.speed > 6;
    const w = Math.sin(t * 9 + c.bob) * (walking ? 0.62 : 0);
    rig.hipL.rotation.x = w; rig.hipR.rotation.x = -w;
    rig.armL.rotation.x = -w * 0.75; rig.armR.rotation.x = w * 0.75;
    rig.armR.rotation.z = 0; rig.armL.rotation.z = 0;
    rig.headG.rotation.set(0, 0, 0);
    rig.root.position.y = walking ? Math.abs(Math.sin(t * 9 + c.bob)) * 1.6 : 0;
    rig.phone.visible = false;

    switch (c.pose) {
      case 'phone':
        rig.armR.rotation.x = -2.2; rig.armR.rotation.z = -0.5;
        rig.headG.rotation.x = 0.38;
        rig.phone.visible = true;
        break;
      case 'shop': rig.headG.rotation.x = -0.08; rig.armL.rotation.x = -0.5; break;
      case 'vending': rig.headG.rotation.x = 0.12; rig.armR.rotation.x = -0.9; break;
      case 'sign': rig.headG.rotation.x = -0.42; break;
      case 'look': rig.headG.rotation.y = Math.sin(t * 2.2 + c.bob) * 0.66; break;
      case 'sit':
        rig.root.position.y = -10.5;
        rig.hipL.rotation.x = -1.45; rig.hipR.rotation.x = -1.45;
        rig.headG.rotation.x = 0.05;
        break;
      default: break; // stand / walk handled above
    }
    // mistake twitch (a decoy breaking the freeze)
    if (c.mistake > 0) rig.headG.rotation.z = Math.sin(t * 40) * 0.12;

    // freeze-snap pop
    c.freezePop = Math.max(0, (c.freezePop || 0) - 0.05);
    const pop = 1 + c.freezePop * 0.1;
    rig.root.scale.setScalar(c.appearance.scale * pop);
  }

  // ---------------- frame ----------------
  render(scene) {
    const dt = Math.min(0.05, Math.max(0.001, scene.time - this._lastT));
    this._lastT = scene.time;

    // signal lamps + light mood per phase
    const ph = scene.light.phase;
    for (const l of this._signalLamps) {
      l.red.material.color.set(ph === 'red' ? 0xff4238 : ph === 'warning' ? 0xd8a52c : 0x3a1512);
      l.green.material.color.set(ph === 'green' ? 0x39e07c : 0x0f3320);
    }
    const mood = ph === 'red' ? 0xd7c3c3 : ph === 'warning' ? 0xd8cdb4 : 0xbfc9d4;
    this.hemi.color.setHex(mood);

    // goal beacon pulse + flowing path chevrons (faker objective readability)
    const showGoal = !!scene.goalMarker;
    const pulse = 0.5 + 0.5 * Math.sin(scene.time * 2.4);
    this._beacon.visible = this._beaconCore.visible = showGoal;
    if (showGoal) {
      this._beacon.material.opacity = 0.09 + pulse * 0.08;
      this._beaconCore.material.opacity = 0.3 + pulse * 0.18;
      this._beacon.rotation.y = scene.time * 0.4;
    }
    const path0 = this.world.h - 120, path1 = this.world.goal.y + 60, span = path0 - path1;
    for (let i = 0; i < this._chevrons.length; i++) {
      const cv = this._chevrons[i];
      cv.visible = showGoal;
      if (!showGoal) continue;
      const u = ((scene.time * 90 + i * (span / this._chevrons.length)) % span);
      cv.position.z = path0 - u;
      const edge = Math.min(u / 90, (span - u) / 90, 1);
      cv.material.opacity = 0.15 + 0.6 * Math.max(0, edge);
    }

    // characters
    const seen = new Set();
    for (const c of scene.chars) {
      seen.add(c.id);
      const rig = this._rigFor(c);
      if (c.eliminated) { rig.root.visible = false; continue; }
      rig.root.visible = true;
      const py = rig.root.position.y;
      rig.root.position.set(c.x, py, c.y);
      rig.root.rotation.y = Math.atan2(Math.cos(c.facing), Math.sin(c.facing));
      this._poseRig(rig, c, scene.time);
      // accusation flash on the body
      const flash = c.accused > 0 ? (Math.sin(scene.time * 20) > 0 ? 1 : 0) : 0;
      rig.bodyMat.emissive?.setHex(flash ? 0xE53935 : 0x000000);
    }
    for (const [id, rig] of this._charMeshes) {
      if (!seen.has(id)) { this.scene.remove(rig.root); this._charMeshes.delete(id); }
    }

    this.r.render(this.scene, this.camera);
    this._drawOverlay(scene);
  }

  // ---------------- 2D overlay: tells, markers, fx, banner ----------------
  _drawOverlay(scene) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.vw, this.vh);

    // world-anchored markers
    for (const c of scene.chars) {
      if (c.eliminated) {
        if (scene.reveal && (c.kind === 'faker' || c.kind === 'player' || c.revealFaker)) this._revealMark(ctx, c, scene, true);
        continue;
      }
      const head = this._project(c.x, 52 * c.appearance.scale, c.y);
      if (!head.ok) continue;

      if (c.kind === 'player') {
        // your own chevron
        ctx.fillStyle = 'rgba(242,241,236,0.9)';
        const yy = head.y - 18 - Math.sin(scene.time * 3) * 2;
        ctx.beginPath(); ctx.moveTo(head.x, yy + 8); ctx.lineTo(head.x - 7, yy); ctx.lineTo(head.x + 7, yy); ctx.closePath(); ctx.fill();
      }

      // red-light tells on your own head + expected facing arrow
      if ((c.kind === 'player') && scene.light.phase === 'red') {
        if (c.baseFacing != null) this._facingArrow(ctx, c);
        if (c.humanness > 0.30 && scene.tells) this._tellPill(ctx, c, head, scene);
      }

      if (scene.reveal && (c.kind === 'faker' || c.kind === 'player' || c.revealFaker)) this._revealMark(ctx, c, scene, false);
    }

    // GOAL marker pill: floats over the gate, clamps to the screen edge when
    // the gate is out of view so you always know which way to run.
    if (scene.goalMarker) {
      const gm = scene.goalMarker;
      const p = this._project(gm.x, 170, gm.y);
      let gx = p.x, gy = p.y, offscreen = !p.ok;
      if (!offscreen && (gx < 40 || gx > this.vw - 40 || gy < 30 || gy > this.vh - 120)) offscreen = true;
      gx = Math.min(Math.max(gx, 76), this.vw - 76);
      // keep clear of the light banner + countdown box at top-center
      const minY = (gx > this.vw / 2 - 260 && gx < this.vw / 2 + 260) ? 168 : 46;
      gy = Math.min(Math.max(gy, minY), this.vh - 130);
      ctx.font = '800 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const wlab = ctx.measureText(gm.label).width + 26;
      const pulse = 0.75 + 0.25 * Math.sin(scene.time * 3);
      ctx.globalAlpha = offscreen ? 0.95 : pulse;
      ctx.fillStyle = 'rgba(10,26,18,0.88)';
      rr(ctx, gx - wlab / 2, gy - 17, wlab, 24, 8); ctx.fill();
      ctx.strokeStyle = PALETTE.green; ctx.lineWidth = 1.6;
      rr(ctx, gx - wlab / 2, gy - 17, wlab, 24, 8); ctx.stroke();
      ctx.fillStyle = '#7ee2a1'; ctx.fillText(gm.label, gx, gy);
      ctx.globalAlpha = 1;
    }

    // watcher-mode UI
    if (scene.role === 'watcher' && scene.watch) {
      for (const c of scene.chars) {
        if (c.eliminated || !scene.watch.pins.has(c.id)) continue;
        const p = this._project(c.x, 58, c.y);
        if (!p.ok) continue;
        ctx.fillStyle = PALETTE.amber;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, Math.PI, 0); ctx.lineTo(p.x, p.y + 10); ctx.closePath(); ctx.fill();
      }
      const hov = scene.watch.hover;
      if (hov && !hov.eliminated) {
        const f = this._project(hov.x, 2, hov.y);
        const e = this._project(hov.x + 20, 2, hov.y);
        const r = Math.hypot(e.x - f.x, e.y - f.y);
        ctx.strokeStyle = 'rgba(242,241,236,0.9)'; ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]); ctx.lineDashOffset = -scene.time * 14;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * 0.5, 0, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
      }
      const rp = this._project(scene.watch.reticle.x, 2, scene.watch.reticle.y);
      const red = scene.light.phase === 'red';
      this._brackets(ctx, rp.x, rp.y, 20 + Math.sin(scene.time * 6) * 1.5, red ? PALETTE.red : PALETTE.amber);
    } else if (scene.reticle && scene.reticle.visible) {
      // AI watcher reticle
      const rp = this._project(scene.reticle.x, 2, scene.reticle.y);
      if (rp.ok) {
        this._brackets(ctx, rp.x, rp.y, 16 + 10 * (1 - Math.min(1, scene.reticle.lock || 0)), PALETTE.red);
        if (scene.reticle.lock > 0) {
          ctx.strokeStyle = PALETTE.red; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(rp.x, rp.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, scene.reticle.lock)); ctx.stroke();
        }
      }
    }

    // screen-space fx (light tint, threat, flash, banner)
    const ph = scene.light.phase;
    if (ph === 'red') { ctx.fillStyle = 'rgba(229,57,53,0.07)'; ctx.fillRect(0, 0, this.vw, this.vh); }
    else if (ph === 'warning') { ctx.fillStyle = 'rgba(255,193,7,0.05)'; ctx.fillRect(0, 0, this.vw, this.vh); }

    if (scene.threat > 0.02) {
      const pulse = 0.5 + 0.5 * Math.sin(scene.time * (6 + scene.threat * 8));
      const a = Math.min(0.62, scene.threat * (0.34 + 0.28 * pulse));
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * 0.28, this.vw / 2, this.vh / 2, this.vh * 0.72);
      g.addColorStop(0, 'rgba(229,57,53,0)'); g.addColorStop(1, `rgba(229,57,53,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);
    }
    if (scene.flash > 0.001) { ctx.fillStyle = `rgba(242,241,236,${scene.flash * 0.45})`; ctx.fillRect(0, 0, this.vw, this.vh); }
    if (scene.fxFlash && scene.fxFlash.a > 0.001) {
      const c2 = scene.fxFlash;
      ctx.fillStyle = `rgba(${c2.col[0]},${c2.col[1]},${c2.col[2]},${c2.a})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    if (scene.banner && scene.banner.alpha > 0.01) {
      const b = scene.banner;
      const alpha = Math.min(1, b.alpha * 1.6);
      const scale = 1 + (1 - b.alpha) * 0.35;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.vw / 2, this.vh * 0.34);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 62px system-ui, sans-serif';
      const bw = ctx.measureText(b.text).width;
      const fs = Math.min(62, 62 * (this.vw - 90) / Math.max(1, bw));
      ctx.font = `900 ${fs}px system-ui, sans-serif`;
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(14,22,33,0.85)';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  _facingArrow(ctx, c) {
    const off = c.tellTag === 'facing';
    const bx = Math.cos(c.baseFacing), by = Math.sin(c.baseFacing);
    const p0 = this._project(c.x + bx * 16, 2, c.y + by * 16);
    const p1 = this._project(c.x + bx * 34, 2, c.y + by * 34);
    if (!p0.ok || !p1.ok) return;
    ctx.strokeStyle = off ? 'rgba(229,57,53,0.95)' : 'rgba(46,204,113,0.9)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.beginPath();
    ctx.moveTo(p1.x + Math.cos(ang) * 7, p1.y + Math.sin(ang) * 7);
    ctx.lineTo(p1.x + Math.cos(ang + 2.5) * 6, p1.y + Math.sin(ang + 2.5) * 6);
    ctx.lineTo(p1.x + Math.cos(ang - 2.5) * 6, p1.y + Math.sin(ang - 2.5) * 6);
    ctx.closePath(); ctx.fill();
  }

  _tellPill(ctx, c, head, scene) {
    const tag = c.tellTag;
    const col = tag === 'move' ? PALETTE.red : PALETTE.amber;
    const label = scene.tells[tag] || '';
    if (!label || tag === 'ok') return;
    const ty = head.y - 16 - Math.sin(scene.time * 6) * 1.5;
    ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const wlab = ctx.measureText('⚠ ' + label).width + 16;
    ctx.fillStyle = 'rgba(14,22,33,0.9)';
    rr(ctx, head.x - wlab / 2, ty - 13, wlab, 18, 6); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.4; rr(ctx, head.x - wlab / 2, ty - 13, wlab, 18, 6); ctx.stroke();
    ctx.fillStyle = col; ctx.fillText('⚠ ' + label, head.x, ty);
  }

  _revealMark(ctx, c, scene, eliminated) {
    const p = this._project(c.x, 64, c.y);
    if (!p.ok) return;
    const col = eliminated ? PALETTE.gray : PALETTE.red;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, 8, Math.PI, 0); ctx.lineTo(p.x, p.y + 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0E1621'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, 7); ctx.fill();
  }

  _brackets(ctx, x, y, s, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.2;
    const g = s * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - s, y - g); ctx.lineTo(x - s, y - s); ctx.lineTo(x - g, y - s);
    ctx.moveTo(x + g, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - g);
    ctx.moveTo(x + s, y + g); ctx.lineTo(x + s, y + s); ctx.lineTo(x + g, y + s);
    ctx.moveTo(x - g, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + g);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill();
  }
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
