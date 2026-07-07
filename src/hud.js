// In-match HUD drawn in screen space, styled after docs UI board:
// light banner, timer, watcher marks, survival/objective, disguise bar,
// NPC Sync cooldown, penalty warning.
import { PALETTE, I18N } from './config.js';

export class Hud {
  draw(ctx, vw, vh, s) {
    const t = I18N[s.lang] || I18N.en;
    const scale = s.hudScale || 1;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    this._banner(ctx, vw, s, t, scale);
    this._marks(ctx, s, t, scale);

    if (s.role === 'watcher') {
      this._fakersLeft(ctx, vw, s, t, scale);
      this._watchHint(ctx, vw, vh, s, t, scale);
    } else {
      this._status(ctx, vw, s, t, scale);
      this._actionBar(ctx, vw, vh, s, t, scale);
      this._sync(ctx, vh, s, t, scale);
      this._penalty(ctx, vw, vh, s, t, scale);
      if (s.missions) this._missions(ctx, vw, s, t, scale);
    }

    ctx.restore();
  }

  _fakersLeft(ctx, vw, s, t, scale) {
    const w = 200 * scale, h = 58 * scale, x = vw - w - 16 * scale, y = 16 * scale;
    this._panel(ctx, x, y, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.gray; ctx.font = `700 ${11 * scale}px system-ui`;
    ctx.fillText(t.fakersLeft.toUpperCase(), x + 14 * scale, y + 22 * scale);
    ctx.fillStyle = PALETTE.red; ctx.font = `800 ${24 * scale}px system-ui`;
    ctx.fillText(`${s.fakersAlive}`, x + 14 * scale, y + 46 * scale);
    ctx.fillStyle = PALETTE.gray; ctx.font = `700 ${14 * scale}px system-ui`;
    ctx.fillText(`/ ${s.fakersTotal}`, x + 44 * scale, y + 46 * scale);
    // little person icons
    for (let i = 0; i < s.fakersTotal; i++) {
      const dx = x + w - 16 * scale - i * 18 * scale;
      ctx.fillStyle = i < s.fakersAlive ? PALETTE.red : 'rgba(154,163,173,0.35)';
      ctx.beginPath(); ctx.arc(dx, y + 24 * scale, 3.5 * scale, 0, 7); ctx.fill();
      ctx.fillRect(dx - 3 * scale, y + 28 * scale, 6 * scale, 10 * scale);
    }
  }

  _watchHint(ctx, vw, vh, s, t, scale) {
    const red = s.light.phase === 'red';
    const w = 460 * scale, h = 40 * scale, x = vw / 2 - w / 2, y = vh - h - 18 * scale;
    ctx.fillStyle = red ? 'rgba(46,12,12,0.9)' : 'rgba(14,22,33,0.85)';
    rrect(ctx, x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = red ? PALETTE.red : 'rgba(154,163,173,0.28)'; ctx.lineWidth = 1.4;
    rrect(ctx, x, y, w, h, 10); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = red ? PALETTE.red : PALETTE.offwhite; ctx.font = `800 ${13 * scale}px system-ui`;
    ctx.fillText(s.hint, vw / 2, y + 18 * scale);
    ctx.fillStyle = PALETTE.gray; ctx.font = `600 ${11 * scale}px system-ui`;
    ctx.fillText(`${s.pinHint}   ·   ${t.pinned}: ${s.pinsCount}`, vw / 2, y + 33 * scale);
  }

  _missions(ctx, vw, s, t, scale) {
    const rows = s.missions;
    const w = 230 * scale, rowH = 20 * scale, h = 30 * scale + rows.length * rowH;
    const x = 16 * scale, y = 84 * scale;
    this._panel(ctx, x, y, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.amber; ctx.font = `800 ${11 * scale}px system-ui`;
    ctx.fillText(s.missionsTitle.toUpperCase(), x + 14 * scale, y + 20 * scale);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], ry = y + 34 * scale + i * rowH;
      // checkbox
      ctx.strokeStyle = r.done ? PALETTE.green : 'rgba(154,163,173,0.6)'; ctx.lineWidth = 1.5;
      rrect(ctx, x + 14 * scale, ry - 9 * scale, 11 * scale, 11 * scale, 2); ctx.stroke();
      if (r.done) { ctx.strokeStyle = PALETTE.green; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 16 * scale, ry - 3.5 * scale); ctx.lineTo(x + 19 * scale, ry - 0.5 * scale); ctx.lineTo(x + 24 * scale, ry - 7 * scale); ctx.stroke(); }
      ctx.fillStyle = r.done ? PALETTE.green : PALETTE.offwhite;
      ctx.font = `${r.done ? 600 : 500} ${11 * scale}px system-ui`;
      ctx.fillText(clip(ctx, r.label, w - 44 * scale), x + 32 * scale, ry);
    }
  }

  // Board style: dark navy card, thin stroke, corner tick brackets, optional glow.
  _panel(ctx, x, y, w, h, r = 10, accent = null) {
    ctx.fillStyle = 'rgba(13,20,30,0.86)';
    rrect(ctx, x, y, w, h, r); ctx.fill();
    if (accent) { ctx.save(); ctx.shadowColor = accent; ctx.shadowBlur = 14; }
    ctx.strokeStyle = accent || 'rgba(154,163,173,0.3)'; ctx.lineWidth = accent ? 1.6 : 1;
    rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke();
    if (accent) ctx.restore();
    // corner ticks
    const tk = Math.min(9, h / 4), pad = 5;
    ctx.strokeStyle = accent || 'rgba(154,163,173,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + pad, y + pad + tk); ctx.lineTo(x + pad, y + pad); ctx.lineTo(x + pad + tk, y + pad);
    ctx.moveTo(x + w - pad - tk, y + pad); ctx.lineTo(x + w - pad, y + pad); ctx.lineTo(x + w - pad, y + pad + tk);
    ctx.moveTo(x + w - pad, y + h - pad - tk); ctx.lineTo(x + w - pad, y + h - pad); ctx.lineTo(x + w - pad - tk, y + h - pad);
    ctx.moveTo(x + pad + tk, y + h - pad); ctx.lineTo(x + pad, y + h - pad); ctx.lineTo(x + pad, y + h - pad - tk);
    ctx.stroke();
  }

  _banner(ctx, vw, s, t, scale) {
    const ph = s.light.phase;
    const isRed = ph === 'red', isWarn = ph === 'warning';
    const color = isRed ? PALETTE.red : isWarn ? PALETTE.amber : PALETTE.green;
    const title = isRed ? t.red : isWarn ? t.warn : t.green;
    const sub = isRed ? t.redSub : isWarn ? t.warnSub : t.greenSub;

    const w = 420 * scale, h = 76 * scale;
    const x = vw / 2 - w / 2, y = 16 * scale;
    this._panel(ctx, x, y, w, h, 12, isRed ? PALETTE.red : isWarn ? 'rgba(255,193,7,0.7)' : null);

    // signal icon (pedestrian figure in a lamp)
    const iconX = x + 34 * scale, iconY = y + h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrect(ctx, iconX - 16 * scale, y + 12 * scale, 32 * scale, h - 24 * scale, 6); ctx.fill();
    drawPedestrian(ctx, iconX, iconY, 11 * scale, color, isRed);

    // Colorblind assist: a distinct shape per state (circle/triangle/square).
    if (s.colorblind) {
      ctx.fillStyle = color;
      const sx = x + w - 90 * scale, sy = y + 20 * scale, r = 7 * scale;
      ctx.beginPath();
      if (ph === 'green') { ctx.arc(sx, sy, r, 0, 7); }
      else if (ph === 'warning') { ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r, sy + r); ctx.lineTo(sx - r, sy + r); ctx.closePath(); }
      else { ctx.rect(sx - r, sy - r, r * 2, r * 2); }
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.font = `900 ${30 * scale}px "Arial Black", Arial, sans-serif`;
    ctx.fillText(title, x + 66 * scale, y + 40 * scale);
    ctx.fillStyle = PALETTE.offwhite;
    ctx.font = `600 ${12 * scale}px system-ui, sans-serif`;
    ctx.fillText(sub, x + 66 * scale, y + 58 * scale);

    // boxed phase countdown below the banner (board style)
    const cw = 104 * scale, chh = 36 * scale, cy = y + h + 8 * scale;
    this._panel(ctx, vw / 2 - cw / 2, cy, cw, chh, 8, isRed ? PALETTE.red : null);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = `900 ${22 * scale}px "Arial Black", Arial, sans-serif`;
    ctx.fillText(fmtCount(s.light.timeLeft), vw / 2, cy + 26 * scale);

    // round timer chip to the right of the countdown
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(242,241,236,0.75)';
    ctx.font = `700 ${12 * scale}px system-ui, sans-serif`;
    ctx.fillText('⏱ ' + fmtTime(s.roundLeft), vw / 2 + cw / 2 + 12 * scale, cy + 23 * scale);
  }

  _marks(ctx, s, t, scale) {
    const w = 176 * scale, h = 58 * scale, x = 16 * scale, y = 16 * scale;
    this._panel(ctx, x, y, w, h);
    ctx.textAlign = 'left';
    drawEye(ctx, x + 22 * scale, y + 22 * scale, 8 * scale, PALETTE.offwhite);
    ctx.fillStyle = PALETTE.gray; ctx.font = `700 ${11 * scale}px system-ui`;
    ctx.fillText(t.marks.toUpperCase(), x + 38 * scale, y + 25 * scale);
    // dots
    const dotY = y + 42 * scale;
    for (let i = 0; i < s.maxMarks; i++) {
      const dx = x + 20 * scale + i * 26 * scale;
      ctx.beginPath(); ctx.arc(dx, dotY, 7 * scale, 0, 7);
      ctx.fillStyle = i < s.marks ? PALETTE.red : 'rgba(154,163,173,0.35)';
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.gray; ctx.font = `700 ${12 * scale}px system-ui`;
    ctx.fillText('/ ' + s.maxMarks, x + 20 * scale + s.maxMarks * 26 * scale, dotY + 4 * scale);
  }

  _status(ctx, vw, s, t, scale) {
    const w = 200 * scale, h = 58 * scale, x = vw - w - 16 * scale, y = 16 * scale;
    this._panel(ctx, x, y, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.gray; ctx.font = `700 ${11 * scale}px system-ui`;
    ctx.fillText(t.survival.toUpperCase(), x + 14 * scale, y + 22 * scale);
    ctx.fillStyle = PALETTE.green; ctx.font = `800 ${20 * scale}px system-ui`;
    ctx.fillText(fmtTime(s.survival), x + 14 * scale, y + 44 * scale);

    // objective progress bar (to gate)
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.gray; ctx.font = `700 ${10 * scale}px system-ui`;
    ctx.fillText(t.objective.toUpperCase(), x + w - 14 * scale, y + 22 * scale);
    const bw = 96 * scale, bx = x + w - 14 * scale - bw, by = y + 32 * scale;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrect(ctx, bx, by, bw, 10 * scale, 5); ctx.fill();
    ctx.fillStyle = PALETTE.green; rrect(ctx, bx, by, bw * clamp01(s.progress), 10 * scale, 5); ctx.fill();
  }

  _actionBar(ctx, vw, vh, s, t, scale) {
    const n = s.actions.length;
    const cell = 62 * scale, gap = 8 * scale;
    const w = n * cell + (n - 1) * gap + 24 * scale;
    const h = 78 * scale;
    const x = vw / 2 - w / 2, y = vh - h - 16 * scale;
    this._panel(ctx, x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gray; ctx.font = `700 ${10 * scale}px system-ui`;
    ctx.fillText('DISGUISE / MIMIC', vw / 2, y + 15 * scale);

    for (let i = 0; i < n; i++) {
      const a = s.actions[i];
      const cx = x + 12 * scale + i * (cell + gap);
      const cy = y + 22 * scale;
      const active = s.activeActionId === a.id;
      const valid = a.valid;
      ctx.fillStyle = active ? 'rgba(229,57,53,0.35)' : valid ? 'rgba(46,204,113,0.16)' : 'rgba(0,0,0,0.3)';
      rrect(ctx, cx, cy, cell, cell - 4 * scale, 8); ctx.fill();
      ctx.strokeStyle = active ? PALETTE.red : valid ? PALETTE.green : 'rgba(154,163,173,0.3)';
      ctx.lineWidth = active ? 2 : 1;
      rrect(ctx, cx, cy, cell, cell - 4 * scale, 8); ctx.stroke();

      drawActionIcon(ctx, a.icon, cx + cell / 2, cy + 22 * scale, 12 * scale, valid ? PALETTE.offwhite : PALETTE.gray);
      // label
      ctx.fillStyle = valid ? PALETTE.offwhite : PALETTE.gray;
      ctx.font = `600 ${9.5 * scale}px system-ui`;
      ctx.fillText(s.lang === 'ja' ? a.labelJA : a.labelEN, cx + cell / 2, cy + cell - 8 * scale);
      // key badge
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, cx + cell - 16 * scale, cy + 3 * scale, 13 * scale, 13 * scale, 3); ctx.fill();
      ctx.fillStyle = PALETTE.offwhite; ctx.font = `700 ${9 * scale}px system-ui`;
      ctx.fillText(a.key, cx + cell - 9.5 * scale, cy + 13 * scale);

      // active pose progress
      if (active && s.actionProgress != null) {
        ctx.fillStyle = PALETTE.red; ctx.fillRect(cx, cy + cell - 8 * scale, cell * (1 - s.actionProgress), 3 * scale);
      }
    }
  }

  _sync(ctx, vh, s, t, scale) {
    const w = 132 * scale, h = 78 * scale, x = 16 * scale, y = vh - h - 16 * scale;
    this._panel(ctx, x, y, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.gray; ctx.font = `700 ${11 * scale}px system-ui`;
    ctx.fillText(t.sync.toUpperCase(), x + 14 * scale, y + 18 * scale);

    // ring
    const rx = x + 34 * scale, ry = y + 48 * scale, rr = 20 * scale;
    ctx.lineWidth = 5 * scale;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 7); ctx.stroke();
    ctx.strokeStyle = s.syncReady ? PALETTE.green : PALETTE.amber;
    ctx.beginPath(); ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + s.syncCooldownFrac * Math.PI * 2); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = s.syncReady ? PALETTE.green : PALETTE.amber;
    ctx.font = `800 ${13 * scale}px system-ui`;
    ctx.fillText(s.syncReady ? 'E' : Math.ceil(s.syncSecondsLeft) + 's', rx, ry + 5 * scale);

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.offwhite; ctx.font = `600 ${10 * scale}px system-ui`;
    ctx.fillText(s.syncReady ? t.ready : t.cooling, x + 62 * scale, y + 44 * scale);
    ctx.fillStyle = PALETTE.gray; ctx.font = `500 ${9 * scale}px system-ui`;
    ctx.fillText('near NPC', x + 62 * scale, y + 58 * scale);
  }

  _penalty(ctx, vw, vh, s, t, scale) {
    if (!s.penalty) return;
    const w = 150 * scale, h = 54 * scale, x = vw - w - 16 * scale, y = vh - h - 16 * scale;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(s.time * 10);
    ctx.fillStyle = 'rgba(40,26,8,0.9)'; rrect(ctx, x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = PALETTE.amber; ctx.lineWidth = 2; rrect(ctx, x, y, w, h, 10); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.amber; ctx.textAlign = 'left';
    ctx.font = `800 ${13 * scale}px system-ui`;
    ctx.fillText('⚠ ' + t.penaltyT, x + 12 * scale, y + 24 * scale);
    ctx.fillStyle = PALETTE.offwhite; ctx.font = `600 ${10 * scale}px system-ui`;
    ctx.fillText(t.penaltySub, x + 12 * scale, y + 40 * scale);
  }
}

// ---------- icon helpers ----------
function drawPedestrian(ctx, cx, cy, r, color, standing) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.9, r * 0.45, 0, 7); ctx.fill(); // head
  ctx.lineWidth = r * 0.45; ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.4); ctx.lineTo(cx, cy + r * 0.3);           // torso
  if (standing) {
    ctx.moveTo(cx, cy + r * 0.3); ctx.lineTo(cx - r * 0.4, cy + r);
    ctx.moveTo(cx, cy + r * 0.3); ctx.lineTo(cx + r * 0.4, cy + r);
    ctx.moveTo(cx - r * 0.5, cy - r * 0.2); ctx.lineTo(cx + r * 0.5, cy - r * 0.2);
  } else { // walking pose
    ctx.moveTo(cx, cy + r * 0.3); ctx.lineTo(cx - r * 0.55, cy + r);
    ctx.moveTo(cx, cy + r * 0.3); ctx.lineTo(cx + r * 0.3, cy + r);
    ctx.moveTo(cx - r * 0.5, cy - r * 0.1); ctx.lineTo(cx + r * 0.55, cy - r * 0.35);
  }
  ctx.stroke();
}

function drawEye(ctx, cx, cy, r, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.quadraticCurveTo(cx, cy - r * 0.9, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy + r * 0.9, cx - r, cy); ctx.stroke();
  ctx.fillStyle = PALETTE.red; ctx.beginPath(); ctx.arc(cx, cy, r * 0.34, 0, 7); ctx.fill();
}

function drawActionIcon(ctx, kind, cx, cy, r, color) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8;
  switch (kind) {
    case 'phone':
      rrect(ctx, cx - r * 0.45, cy - r, r * 0.9, r * 2, 3); ctx.stroke();
      ctx.fillRect(cx - r * 0.28, cy - r * 0.7, r * 0.56, r * 1.2); break;
    case 'shop':
      ctx.strokeRect(cx - r, cy - r * 0.8, r * 2, r * 1.6);
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.8); ctx.lineTo(cx, cy + r * 0.8); ctx.stroke(); break;
    case 'vending':
      rrect(ctx, cx - r * 0.7, cy - r, r * 1.4, r * 2, 3); ctx.stroke();
      ctx.fillRect(cx - r * 0.4, cy - r * 0.7, r * 0.8, r * 0.5);
      ctx.fillRect(cx + r * 0.1, cy + r * 0.2, r * 0.4, r * 0.5); break;
    case 'bench':
      ctx.fillRect(cx - r, cy - r * 0.1, r * 2, r * 0.5);
      ctx.fillRect(cx - r, cy + r * 0.4, r * 0.3, r * 0.6);
      ctx.fillRect(cx + r * 0.7, cy + r * 0.4, r * 0.3, r * 0.6); break;
    case 'sign':
      ctx.fillRect(cx - r * 0.12, cy - r, r * 0.24, r * 2);
      rrect(ctx, cx - r * 0.8, cy - r, r * 1.6, r * 0.8, 2); ctx.fill(); break;
    case 'look':
      drawEye(ctx, cx, cy, r, color); break;
  }
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fmtTime(sec) {
  sec = Math.max(0, sec | 0);
  const m = (sec / 60) | 0, s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
// Phase countdown in the board's boxed style: 00:07
function fmtCount(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return '00:' + String(s).padStart(2, '0');
}
function clip(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
