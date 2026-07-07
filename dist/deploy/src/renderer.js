// Canvas renderer: camera, bright station-front plaza, semi-deformed crowd,
// pose-driven character drawing, and the Watcher's focus reticle.
import { PALETTE } from './config.js';

const GROUND = '#b7b3a8';
const GROUND2 = '#aca79b';
const TACTILE = '#e6b93f';

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.cam = { x: world.w / 2, y: world.h / 2, zoom: 1 };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.shake = 0; this.shakeX = 0; this.shakeY = 0;
    this.punchT = 0; this.punchDur = 0.0001; this.punchAmt = 0; this.punchFocus = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  addShake(a) { this.shake = Math.max(this.shake, a); }
  punchZoom(x, y, amt, time) { this.punchT = time; this.punchDur = time; this.punchAmt = amt; this.punchFocus = { x, y }; }

  resize() {
    const c = this.canvas;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.floor(w * this.dpr);
    c.height = Math.floor(h * this.dpr);
    this.vw = w; this.vh = h;
  }

  // Fit a target world-area into view; follow a focus point.
  updateCamera(focus, dt = 0.016, viewW = 1240, viewH = 820) {
    let zoom = Math.min(this.vw / viewW, this.vh / viewH) * 1.0;
    let fx = focus.x, fy = focus.y;
    // Punch-zoom toward a dramatic point (accusation), easing back out.
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - dt);
      const e = this.punchT / this.punchDur; // 1 -> 0
      const ease = e * e;
      zoom *= 1 + this.punchAmt * ease;
      if (this.punchFocus) { fx += (this.punchFocus.x - fx) * ease; fy += (this.punchFocus.y - fy) * ease; }
    }
    this.cam.zoom = zoom;
    const halfW = this.vw / zoom / 2, halfH = this.vh / zoom / 2;
    const tx = clamp(fx, halfW, this.world.w - halfW);
    const ty = clamp(fy, halfH, this.world.h - halfH);
    // Smooth follow (snappier during a punch).
    const k = 1 - Math.pow(this.punchT > 0 ? 0.000001 : 0.001, dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    // Screen shake, decaying.
    this.shake = Math.max(0, this.shake - dt * 34);
    const s = this.shake;
    this.shakeX = s ? (Math.random() * 2 - 1) * s : 0;
    this.shakeY = s ? (Math.random() * 2 - 1) * s : 0;
  }

  w2s(x, y) {
    return {
      x: (x - this.cam.x) * this.cam.zoom + this.vw / 2,
      y: (y - this.cam.y) * this.cam.zoom + this.vh / 2,
    };
  }

  s2w(sx, sy) {
    return {
      x: (sx - this.vw / 2) / this.cam.zoom + this.cam.x,
      y: (sy - this.vh / 2) / this.cam.zoom + this.cam.y,
    };
  }

  render(scene) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.vw, this.vh);

    // World transform
    ctx.save();
    ctx.translate(this.vw / 2 + this.shakeX, this.vh / 2 + this.shakeY);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    this._drawGround();
    // Props behind characters.
    for (const p of this.world.props) this._drawProp(ctx, p, scene);

    // Goal glow
    this._drawGoal(scene);

    // Watcher-mode pins (drawn under characters).
    if (scene.role === 'watcher' && scene.watch) {
      for (const c of scene.chars) if (scene.watch.pins.has(c.id) && !c.eliminated) this._drawPin(c);
    }

    // Characters, depth-sorted by y.
    const chars = scene.chars.slice().sort((a, b) => a.y - b.y);
    for (const c of chars) this._drawCharacter(ctx, c, scene);

    // End-of-round identity reveal: mark every Faker.
    if (scene.reveal) for (const c of chars) if (c.kind === 'faker' || c.kind === 'player') this._drawReveal(c, scene);

    if (scene.role === 'watcher' && scene.watch) {
      if (scene.watch.hover && !scene.watch.hover.eliminated) this._drawHover(scene.watch.hover, scene);
      this._drawCursor(scene.watch, scene);
    } else if (scene.reticle && scene.reticle.visible) {
      // AI Watcher focus reticle (Faker modes).
      this._drawReticle(scene.reticle);
    }

    ctx.restore();

    // Full-screen light tint (subtle, keeps crowd readable).
    this._drawLightTint(scene);

    // Threat vignette — you are being locked on.
    if (scene.threat > 0.02) this._drawThreat(scene.threat, scene.time);

    // Freeze-snap flash.
    if (scene.flash > 0.001) {
      ctx.fillStyle = `rgba(242,241,236,${scene.flash * 0.45})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    // Dramatic colored flash (accusation / catch).
    if (scene.fxFlash && scene.fxFlash.a > 0.001) {
      const c = scene.fxFlash;
      ctx.fillStyle = `rgba(${c.col[0]},${c.col[1]},${c.col[2]},${c.a})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    // Center banner (SPOTTED / CLOSE / CAUGHT / ...).
    if (scene.banner && scene.banner.alpha > 0.01) this._drawBanner(scene.banner);

    ctx.restore();
  }

  _drawThreat(level, t) {
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(t * (6 + level * 8));
    const a = Math.min(0.62, level * (0.34 + 0.28 * pulse));
    const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * 0.28, this.vw / 2, this.vh / 2, this.vh * 0.72);
    g.addColorStop(0, 'rgba(229,57,53,0)');
    g.addColorStop(1, `rgba(229,57,53,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);
  }

  _drawBanner(b) {
    const ctx = this.ctx;
    const alpha = Math.min(1, b.alpha * 1.6);
    const scale = 1 + (1 - b.alpha) * 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.vw / 2, this.vh * 0.34);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 62px system-ui, sans-serif';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(14,22,33,0.85)';
    ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
    ctx.restore();
  }

  _drawGround() {
    const ctx = this.ctx, W = this.world.w, H = this.world.h;
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);
    // Tile grid
    ctx.strokeStyle = 'rgba(90,88,82,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 80) { ctx.moveTo(x, 220); ctx.lineTo(x, H); }
    for (let y = 220; y <= H; y += 80) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // Subtle checker accents
    ctx.fillStyle = 'rgba(120,116,108,0.16)';
    for (let x = 0; x < W; x += 160) for (let y = 300; y < H; y += 160) ctx.fillRect(x, y, 80, 80);
    // Tactile paving guide lines toward the gate.
    ctx.fillStyle = TACTILE;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(W / 2 - 8, 210, 16, H - 240);
    ctx.globalAlpha = 1;
  }

  _drawGoal(scene) {
    const ctx = this.ctx, g = this.world.goal;
    const pulse = 0.5 + 0.5 * Math.sin(scene.time * 3);
    const grad = ctx.createRadialGradient(g.x, g.y + 20, 8, g.x, g.y + 20, g.r + 30);
    grad.addColorStop(0, `rgba(46,204,113,${0.32 + pulse * 0.16})`);
    grad.addColorStop(1, 'rgba(46,204,113,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y + 20, g.r + 30, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawProp(ctx, p, scene) {
    switch (p.type) {
      case 'skyline': {
        const grad = ctx.createLinearGradient(0, 0, 0, p.h);
        grad.addColorStop(0, '#20304a');
        grad.addColorStop(1, '#33465f');
        ctx.fillStyle = grad; ctx.fillRect(p.x, p.y, p.w, p.h);
        // building blocks
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let x = 0; x < p.w; x += 90) ctx.fillRect(x + 10, 20 + (x % 3) * 10, 60, p.h - 40);
        // lit windows
        ctx.fillStyle = 'rgba(255,220,150,0.5)';
        for (let x = 20; x < p.w; x += 40) for (let y = 30; y < p.h - 40; y += 26)
          if ((x * y) % 7 < 3) ctx.fillRect(x, y, 8, 10);
        break;
      }
      case 'station': this._facade(ctx, p, '#4a5a6e', '中央駅 CHUO STATION'); break;
      case 'cafe': this._facade(ctx, p, '#3c5148', p.label); break;
      case 'store': this._facade(ctx, p, '#2f6b4a', p.label); break;
      case 'gate': {
        ctx.fillStyle = '#1c2733'; roundRect(ctx, p.x, p.y, p.w, p.h, 6); ctx.fill();
        ctx.fillStyle = '#2ECC71'; ctx.globalAlpha = 0.85;
        ctx.fillRect(p.x + 8, p.y + p.h - 8, p.w - 16, 4); ctx.globalAlpha = 1;
        ctx.fillStyle = PALETTE.offwhite; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center';
        ctx.fillText('▲ GATE', p.x + p.w / 2, p.y + 24);
        break;
      }
      case 'signal': this._signal(ctx, p, scene); break;
      case 'crosswalk': {
        ctx.fillStyle = '#e9e6de';
        for (let x = p.x; x < p.x + p.w; x += 46) ctx.fillRect(x, p.y, 24, p.h);
        break;
      }
      case 'vending': {
        ctx.fillStyle = shade(p.hue, -10); roundRect(ctx, p.x, p.y, p.w, p.h, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(p.x + 6, p.y + 8, p.w - 12, p.h * 0.42);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x + 6, p.y + p.h - 16, p.w - 12, 8);
        // bottles
        ctx.fillStyle = p.hue;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(p.x + 16 + i * 18, p.y + 16 + j * 12, 3, 0, 7); ctx.fill(); }
        break;
      }
      case 'shopwin': {
        ctx.fillStyle = '#2b3843'; roundRect(ctx, p.x, p.y, p.w, p.h, 6); ctx.fill();
        const gg = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
        gg.addColorStop(0, 'rgba(180,220,255,0.5)'); gg.addColorStop(1, 'rgba(120,160,200,0.25)');
        ctx.fillStyle = gg; ctx.fillRect(p.x + 6, p.y + 8, p.w - 12, p.h - 16);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(p.x + 6, p.y + 8, p.w - 12, p.h - 16);
        break;
      }
      case 'bench': {
        ctx.fillStyle = '#6e5844'; roundRect(ctx, p.x, p.y, p.w, p.h, 5); ctx.fill();
        ctx.fillStyle = '#5a4636';
        for (let x = p.x + 6; x < p.x + p.w - 6; x += 16) ctx.fillRect(x, p.y + 4, 8, p.h - 8);
        ctx.fillStyle = '#4a4f57'; ctx.fillRect(p.x + 6, p.y + p.h, 8, 10); ctx.fillRect(p.x + p.w - 14, p.y + p.h, 8, 10);
        break;
      }
      case 'signboard': {
        ctx.fillStyle = '#8a8f95'; ctx.fillRect(p.x + 60, p.y + 46, 16, 44); // pole
        ctx.fillStyle = PALETTE.navy; roundRect(ctx, p.x, p.y, p.w, p.h, 8); ctx.fill();
        ctx.strokeStyle = PALETTE.red; ctx.lineWidth = 2; roundRect(ctx, p.x + 3, p.y + 3, p.w - 6, p.h - 6, 6); ctx.stroke();
        ctx.fillStyle = PALETTE.offwhite; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x + p.w / 2, p.y + 30);
        break;
      }
      case 'planter': {
        ctx.fillStyle = '#7a6a52'; roundRect(ctx, p.x, p.y, p.w, p.h, 6); ctx.fill();
        ctx.fillStyle = '#4d7a3f';
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(p.x + 12 + i * 12, p.y + 8, 9, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#e58fa8'; ctx.beginPath(); ctx.arc(p.x + 30, p.y + 6, 4, 0, 7); ctx.fill();
        break;
      }
      case 'bin': {
        ctx.fillStyle = '#8a8f95'; roundRect(ctx, p.x, p.y, p.w, p.h, 4); ctx.fill();
        ctx.fillStyle = '#6b7076'; ctx.fillRect(p.x + 3, p.y + 4, p.w - 6, 5);
        break;
      }
    }
  }

  _facade(ctx, p, color, label) {
    ctx.fillStyle = color; roundRect(ctx, p.x, p.y, p.w, p.h, 8); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x, p.y + p.h - 30, p.w, 30);
    // windows
    ctx.fillStyle = 'rgba(200,225,255,0.35)';
    for (let x = p.x + 14; x < p.x + p.w - 14; x += 42) ctx.fillRect(x, p.y + 14, 28, p.h - 58);
    // sign band
    ctx.fillStyle = PALETTE.navy; ctx.fillRect(p.x + 10, p.y + p.h - 26, p.w - 20, 20);
    ctx.fillStyle = PALETTE.offwhite; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    ctx.fillText(label || '', p.x + p.w / 2, p.y + p.h - 11);
  }

  _signal(ctx, p, scene) {
    ctx.fillStyle = '#3a3f47'; ctx.fillRect(p.x + 10, p.y, 6, 70);           // pole
    ctx.fillStyle = '#1c2733'; roundRect(ctx, p.x, p.y - 46, 26, 52, 5); ctx.fill(); // housing
    const on = scene.light.phase === 'green' ? 'green' : 'red';
    const dim = 'rgba(255,255,255,0.12)';
    // red lamp (top), green lamp (bottom) — pedestrian style
    ctx.fillStyle = on === 'red' ? PALETTE.red : dim;
    ctx.beginPath(); ctx.arc(p.x + 13, p.y - 34, 8, 0, 7); ctx.fill();
    ctx.fillStyle = on === 'green' ? PALETTE.green : dim;
    ctx.beginPath(); ctx.arc(p.x + 13, p.y - 12, 8, 0, 7); ctx.fill();
    if (scene.light.phase === 'warning') {
      ctx.fillStyle = (Math.floor(scene.time * 8) % 2) ? PALETTE.amber : dim;
      ctx.beginPath(); ctx.arc(p.x + 13, p.y - 23, 6, 0, 7); ctx.fill();
    }
  }

  // ---------------- character ----------------
  _drawCharacter(ctx, c, scene) {
    const a = c.appearance;
    const s = a.scale * (1 + (c.freezePop || 0) * 0.16); // freeze-snap pop
    const px = c.x, py = c.y;
    const sit = c.pose === 'sit';
    const bodyH = (sit ? 15 : 22) * s;
    const bodyW = 17 * s;
    const headR = 6.4 * s;
    const topY = py - bodyH - headR * 1.4 + (sit ? 8 : 0);

    // shadow
    ctx.fillStyle = 'rgba(20,25,32,0.28)';
    ctx.beginPath(); ctx.ellipse(px, py + 3, bodyW * 0.62, 5.5 * s, 0, 0, 7); ctx.fill();

    // legs (walking swing via bob)
    const swing = c.pose === 'walk' ? Math.sin(c.bob) * 4 * s : 0;
    ctx.strokeStyle = a.pants; ctx.lineWidth = 4.4 * s; ctx.lineCap = 'round';
    if (!sit) {
      ctx.beginPath();
      ctx.moveTo(px - 3.5 * s, py - 8 * s); ctx.lineTo(px - 3.5 * s + swing, py + 1);
      ctx.moveTo(px + 3.5 * s, py - 8 * s); ctx.lineTo(px + 3.5 * s - swing, py + 1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(px - 3.5 * s, topY + bodyH); ctx.lineTo(px - 5 * s, py + 2);
      ctx.moveTo(px + 3.5 * s, topY + bodyH); ctx.lineTo(px + 5 * s, py + 2);
      ctx.stroke();
    }

    // body / coat
    ctx.fillStyle = a.clothing;
    roundRect(ctx, px - bodyW / 2, topY, bodyW, bodyH, 5 * s); ctx.fill();
    // subtle shading
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    roundRect(ctx, px - bodyW / 2, topY + bodyH * 0.55, bodyW, bodyH * 0.45, 4 * s); ctx.fill();

    // bag strap / bag
    if (a.bag) {
      ctx.strokeStyle = shade(a.bag, -20); ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(px - bodyW / 2 + 2, topY + 3); ctx.lineTo(px + bodyW / 2 - 2, topY + bodyH - 4); ctx.stroke();
      ctx.fillStyle = a.bag; roundRect(ctx, px + bodyW / 2 - 4, topY + bodyH - 8, 8 * s, 10 * s, 2); ctx.fill();
    }

    // arms depend on pose
    this._drawArms(ctx, c, px, topY, bodyW, bodyH, s);

    // head
    const hx = px, hy = topY - headR * 0.5;
    ctx.fillStyle = a.skin;
    ctx.beginPath(); ctx.arc(hx, hy, headR, 0, 7); ctx.fill();
    // hair
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.arc(hx, hy, headR, Math.PI * (a.hairStyle === 2 ? 0.85 : 1.05), Math.PI * 2.0, false);
    ctx.lineTo(hx, hy - headR); ctx.fill();
    if (a.hairStyle === 1) { ctx.fillRect(hx - headR, hy - 1, headR * 2, 2); } // bob line
    // hat
    if (a.hat) {
      ctx.fillStyle = a.hat;
      roundRect(ctx, hx - headR - 1, hy - headR - 3, (headR + 1) * 2, 4 * s, 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy - headR + 1, headR * 0.85, Math.PI, 0); ctx.fill();
    }
    // gaze indicator (facing) — a nose wedge so "which way are they looking"
    // reads at a glance (critical for the conformity read).
    const fc = Math.cos(c.facing), fs = Math.sin(c.facing);
    const gx = hx + fc * headR * 0.75, gy = hy + fs * headR * 0.6;
    const px1 = hx - fs * headR * 0.42, py1 = hy + fc * headR * 0.42;
    const px2 = hx + fs * headR * 0.42, py2 = hy - fc * headR * 0.42;
    ctx.fillStyle = shade(a.skin, 18);
    ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2);
    ctx.lineTo(hx + fc * headR * 1.15, hy + fs * headR * 1.0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(20,24,30,0.85)';
    ctx.beginPath(); ctx.arc(gx, gy, 1.7 * s, 0, 7); ctx.fill();
    if (a.glasses) {
      ctx.strokeStyle = 'rgba(20,24,30,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(gx - 1.5, gy, 1.6, 0, 7); ctx.arc(gx + 1.5, gy, 1.6, 0, 7); ctx.stroke();
    }

    // pose props
    this._drawPoseProps(ctx, c, px, topY, hx, hy, headR, bodyW, s);

    // ---- gameplay overlays ----
    // Player marker: a ring at the feet + bobbing chevron so you can always
    // find yourself in the crowd (kept tasteful so it still reads as "blend in").
    if (c.kind === 'player') {
      const t = scene.time;
      ctx.strokeStyle = 'rgba(242,241,236,0.55)'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 12;
      ctx.beginPath(); ctx.ellipse(px, py + 3, bodyW * 0.85, 7 * s, 0, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      const cyc = topY - headR * 1.9 - 8 - Math.abs(Math.sin(t * 3)) * 4;
      ctx.fillStyle = '#F2F1EC';
      ctx.beginPath();
      ctx.moveTo(px - 7, cyc - 7); ctx.lineTo(px + 7, cyc - 7); ctx.lineTo(px, cyc + 2); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(14,22,33,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      // tension ring
      if (c.suspicion > 30) {
        const a2 = (c.suspicion - 30) / 70;
        ctx.strokeStyle = `rgba(${c.suspicion > 66 ? '229,57,53' : '255,193,7'},${0.3 + 0.4 * a2})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py + 2, bodyW * 0.75 + Math.sin(t * 6) * 1.5, 0, 7); ctx.stroke();
      }

      // During Red Light: show where the crowd is looking, and your own tell.
      if (scene.light.phase === 'red') {
        if (c.baseFacing != null) {
          const off = c.tellTag === 'facing';
          ctx.strokeStyle = off ? 'rgba(229,57,53,0.9)' : 'rgba(46,204,113,0.8)';
          ctx.lineWidth = 2.4;
          const r0 = bodyW * 0.95, r1 = bodyW * 1.7;
          const bx = Math.cos(c.baseFacing), by = Math.sin(c.baseFacing);
          ctx.beginPath();
          ctx.moveTo(px + bx * r0, py + 2 + by * r0);
          ctx.lineTo(px + bx * r1, py + 2 + by * r1);
          ctx.stroke();
          // arrow head
          const ah = c.baseFacing;
          ctx.beginPath();
          ctx.moveTo(px + bx * r1, py + 2 + by * r1);
          ctx.lineTo(px + Math.cos(ah + 2.5) * (r1 - 6), py + 2 + Math.sin(ah + 2.5) * (r1 - 6));
          ctx.lineTo(px + Math.cos(ah - 2.5) * (r1 - 6), py + 2 + Math.sin(ah - 2.5) * (r1 - 6));
          ctx.closePath(); ctx.fill();
        }
        if (c.humanness > 0.30 && scene.tells) {
          const tag = c.tellTag;
          const col = tag === 'move' ? PALETTE.red : PALETTE.amber;
          const label = scene.tells[tag] || '';
          const ty = topY - headR * 3.4 - Math.sin(t * 6) * 1.5;
          ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center';
          const wlab = ctx.measureText(label).width + 16;
          ctx.fillStyle = 'rgba(14,22,33,0.9)';
          roundRect(ctx, px - wlab / 2, ty - 13, wlab, 18, 6); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 1.4; roundRect(ctx, px - wlab / 2, ty - 13, wlab, 18, 6); ctx.stroke();
          ctx.fillStyle = col; ctx.fillText('⚠ ' + label, px, ty);
        }
      }
    }

    // Accusation reveal
    if (c.accused > 0) {
      ctx.strokeStyle = PALETTE.red; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px, topY, bodyW, 0, 7); ctx.stroke();
      ctx.fillStyle = PALETTE.red; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
      ctx.fillText('!', px, topY - headR * 2.4);
      // corner brackets
      bracket(ctx, px, topY - 2, bodyW + 6, PALETTE.red);
    }
    if (c.eliminated) {
      ctx.strokeStyle = 'rgba(229,57,53,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px - 8, topY - 8); ctx.lineTo(px + 8, topY + 8);
      ctx.moveTo(px + 8, topY - 8); ctx.lineTo(px - 8, topY + 8); ctx.stroke();
    }
  }

  _drawArms(ctx, c, px, topY, bodyW, bodyH, s) {
    ctx.strokeStyle = c.appearance.clothing; ctx.lineWidth = 3.6 * s; ctx.lineCap = 'round';
    const y0 = topY + bodyH * 0.32;
    const swing = c.pose === 'walk' ? Math.sin(c.bob) * 3 * s : 0;
    if (c.pose === 'phone') {
      ctx.beginPath();
      ctx.moveTo(px - bodyW * 0.4, y0); ctx.lineTo(px - 2, topY - 1);
      ctx.moveTo(px + bodyW * 0.4, y0); ctx.lineTo(px + 2, topY - 1);
      ctx.stroke();
    } else if (c.pose === 'vending' || c.pose === 'shop') {
      ctx.beginPath();
      ctx.moveTo(px - bodyW * 0.42, y0); ctx.lineTo(px - bodyW * 0.2, topY + 2);
      ctx.moveTo(px + bodyW * 0.42, y0); ctx.lineTo(px + bodyW * 0.2, topY + 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(px - bodyW * 0.42, y0); ctx.lineTo(px - bodyW * 0.5, y0 + bodyH * 0.5 + swing);
      ctx.moveTo(px + bodyW * 0.42, y0); ctx.lineTo(px + bodyW * 0.5, y0 + bodyH * 0.5 - swing);
      ctx.stroke();
    }
  }

  _drawPoseProps(ctx, c, px, topY, hx, hy, headR, bodyW, s) {
    if (c.pose === 'phone') {
      ctx.fillStyle = '#0b0f14'; roundRect(ctx, px - 3, topY - 5, 6 * s, 9 * s, 1.5); ctx.fill();
      ctx.fillStyle = 'rgba(160,210,255,0.9)'; ctx.fillRect(px - 2, topY - 4, 4 * s, 6 * s);
    }
  }

  _drawReveal(c, scene) {
    const ctx = this.ctx;
    const yy = c.y - 46;
    const col = c.eliminated ? PALETTE.gray : PALETTE.red;
    ctx.fillStyle = col;
    // pin-drop marker
    ctx.beginPath();
    ctx.arc(c.x, yy, 9, Math.PI, 0); ctx.lineTo(c.x, yy + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0E1621'; ctx.beginPath(); ctx.arc(c.x, yy, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y + 2, 18 + Math.sin(scene.time * 4) * 2, 0, 7); ctx.stroke();
  }

  _drawPin(c) {
    const ctx = this.ctx;
    ctx.strokeStyle = PALETTE.amber; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y + 2, 20, 0, 7); ctx.stroke();
    const yy = c.y - 44;
    ctx.fillStyle = PALETTE.amber;
    ctx.beginPath(); ctx.arc(c.x, yy, 7, Math.PI, 0); ctx.lineTo(c.x, yy + 11); ctx.closePath(); ctx.fill();
  }

  _drawHover(c, scene) {
    const ctx = this.ctx;
    ctx.strokeStyle = PALETTE.offwhite; ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]); ctx.lineDashOffset = -scene.time * 14;
    ctx.beginPath(); ctx.arc(c.x, c.y + 2, 22, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawCursor(watch, scene) {
    const ctx = this.ctx;
    const red = scene.light.phase === 'red';
    const r = { x: watch.reticle.x, y: watch.reticle.y, size: 22, pulse: scene.time, lock: 0 };
    // Reuse the bracket reticle; red when you can accuse, amber when observing.
    const color = red ? PALETTE.red : PALETTE.amber;
    ctx.strokeStyle = color; ctx.lineWidth = 2.2;
    bracket(ctx, r.x, r.y, r.size + Math.sin(scene.time * 6) * 1.5, color);
    ctx.beginPath(); ctx.arc(r.x, r.y, 2.4, 0, 7); ctx.fillStyle = color; ctx.fill();
  }

  _drawReticle(r) {
    const ctx = this.ctx;
    const size = r.size || 26;
    ctx.strokeStyle = PALETTE.red;
    ctx.lineWidth = 2.2;
    const t = r.pulse || 0;
    const g = size + Math.sin(t * 8) * 2;
    // corner brackets
    bracket(ctx, r.x, r.y, g, PALETTE.red);
    // center dot + crosshair
    ctx.beginPath(); ctx.arc(r.x, r.y, 2.4, 0, 7); ctx.fillStyle = PALETTE.red; ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(r.x - g, r.y); ctx.lineTo(r.x - g + 8, r.y);
    ctx.moveTo(r.x + g, r.y); ctx.lineTo(r.x + g - 8, r.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // lock progress arc
    if (r.lock > 0) {
      ctx.strokeStyle = PALETTE.amber; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, g + 6, -Math.PI / 2, -Math.PI / 2 + r.lock * Math.PI * 2); ctx.stroke();
    }
  }

  _drawLightTint(scene) {
    const ctx = this.ctx;
    const ph = scene.light.phase;
    let color = null, alpha = 0;
    if (ph === 'red') { color = '229,57,53'; alpha = 0.10; }
    else if (ph === 'warning') { color = '255,193,7'; alpha = 0.06 + 0.05 * (Math.floor(scene.time * 8) % 2); }
    else if (ph === 'green') { color = '46,204,113'; alpha = 0.04; }
    if (!color) return;
    const grad = ctx.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * 0.3, this.vw / 2, this.vh / 2, this.vh * 0.75);
    grad.addColorStop(0, `rgba(${color},0)`);
    grad.addColorStop(1, `rgba(${color},${alpha + 0.06})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, this.vw, this.vh);
  }
}

// ---------- helpers ----------
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function bracket(ctx, x, y, s, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 2.2;
  const L = s * 0.5;
  ctx.beginPath();
  // TL
  ctx.moveTo(x - s, y - s + L); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s + L, y - s);
  // TR
  ctx.moveTo(x + s - L, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - s + L);
  // BR
  ctx.moveTo(x + s, y + s - L); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - L, y + s);
  // BL
  ctx.moveTo(x - s + L, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + s - L);
  ctx.stroke();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return `rgb(${r},${g},${b})`;
}
