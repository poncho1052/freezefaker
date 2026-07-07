// Online match: renders from server snapshots, controls the local player's own
// Faker locally (smooth, low-latency) and relays its state. The Watcher aims a
// reticle and accuses. Reuses Renderer + Hud so the look matches offline play.
import { TUNING, ACTIONS, PALETTE, I18N } from './config.js';
import { createWorld } from './world.js';
import { createRenderer } from './renderer3d.js';
import { Hud } from './hud.js';
import { integrate } from './characters.js';
import { crowdBaseline, evaluateFreeze } from './conformity.js';
import { updatePlayerSuspicion } from './suspicion.js';

const ACTION_POSE = { phone: 'phone', shop: 'shop', vending: 'vending', sit: 'sit', sign: 'sign', look: 'look' };

export class OnlineMatch {
  constructor({ canvas, overlay, input, audio, ui, settings, net, role, youId, onEnd, renderer }) {
    this.canvas = canvas; this.input = input; this.audio = audio; this.ui = ui;
    this.settings = settings; this.net = net; this.role = role; this.youId = youId; this.onEnd = onEnd;
    this.hud = new Hud();
    this.world = createWorld();
    this.renderer = renderer || createRenderer(canvas, overlay, this.world);
    this.chars = new Map();
    this.you = null;
    this.time = 0; this.flash = 0;
    this.light = { phase: 'green', timeLeft: 3, phaseDuration: 3 };
    this.roundLeft = TUNING.round.seconds; this.marks = 6; this.alive = 0; this.total = 0;
    this.spawnY = this.world.h - 90;
    this.stats = { actions: 0, syncs: 0 };
    // fx
    this.slowmoT = 0; this.timeScale = 1; this.fxFlashA = 0; this.fxFlashCol = [229, 57, 53];
    this.bannerKey = null; this.bannerColor = '#fff'; this.bannerT = 0;
    // watcher
    this.watch = { reticle: { x: this.world.w / 2, y: this.world.h / 2 }, hover: null, pins: new Set() };
    this._sendAcc = 0;
    this.ended = null;
    // Message routing is done by main (one handler set per connection) so that
    // rematches don't accumulate stale listeners.
  }

  T() { return I18N[this.settings.lang] || I18N.en; }

  _init(m) {
    this.role = m.role; this.youId = m.you;
    this.goal = m.goal;
    this.chars.clear();
    for (const e of m.roster) {
      const mine = e.id === this.youId;
      const c = {
        id: e.id, kind: mine ? 'player' : 'npc', appearance: e.a,
        x: e.x, y: e.y, tx: e.x, ty: e.y, facing: e.f || 0, targetFacing: e.f || 0,
        pose: 'stand', state: 'idle', speed: 0, vx: 0, vy: 0, radius: TUNING.faker.radius,
        accused: 0, eliminated: false, suspicion: 0, humanness: 0, tellTag: 'ok', baseFacing: null,
        syncCooldown: 0, activeAction: null, mistake: 0, freezePop: 0, lastFacing: e.f || 0,
      };
      this.chars.set(e.id, c);
      if (mine) this.you = c;
    }
    if (this.role === 'faker') { this.bannerKey = 'bGoal'; this.bannerColor = PALETTE.green; this.bannerT = 3.2; }
  }

  _snap(m) {
    this.light.phase = m.ph; this.light.timeLeft = m.tl; this.light.phaseDuration = m.pd;
    this.roundLeft = m.rt; this.marks = m.marks; this.alive = m.alive; this.total = m.total;
    const prev = this._phase; this._phase = m.ph;
    if (prev && prev !== m.ph) this._onPhase(m.ph);
    for (const e of m.ents) {
      const [id, x, y, fa, po, st, el] = e;
      const c = this.chars.get(id);
      if (!c) continue;
      c.eliminated = !!el;
      if (id === this.youId) continue; // own char is locally simulated
      c.tx = x; c.ty = y; c.facing = fa; c.pose = po; c.state = st;
    }
  }

  _onPhase(ph) {
    if (ph === 'red') { this.audio.redStart(); this.audio.freezeSnap(); this.flash = 1; this.renderer.addShake(5); }
    else if (ph === 'warning') this.audio.redWarning();
    else if (ph === 'green') this.audio.greenStart();
    this.audio.setTension(ph === 'red' ? 1 : ph === 'warning' ? 0.6 : 0.15);
  }

  _event(m) {
    if (m.kind === 'accuse') {
      const c = this.chars.get(m.id); if (!c) return;
      const isYou = m.id === this.youId;
      this.slowmoT = isYou ? TUNING.fx.slowmoPlayer : TUNING.fx.slowmoDecoy;
      this.renderer.punchZoom(c.tx ?? c.x, c.ty ?? c.y, isYou ? 0.9 : 0.6, this.slowmoT + 0.1);
      this.renderer.addShake(isYou ? 15 : 9);
      this.fxFlashA = isYou ? 0.75 : 0.5;
      this.fxFlashCol = m.correct ? [229, 57, 53] : [255, 193, 7];
      this.audio.impact();
      this.watch.pins.delete(m.id);
      if (isYou) this._banner('bCaught', PALETTE.red);
      else if (m.correct) this._banner('bGotcha', PALETTE.amber);
      else this._banner('bMiss', PALETTE.amber);
    }
  }

  _end(m) {
    this.ended = m;
    // reveal fakers
    for (const id of m.fakerIds) { const c = this.chars.get(id); if (c) c.revealFaker = true; }
    const t = this.T();
    const iWon = (this.role === 'watcher' && m.winner === 'watcher') || (this.role === 'faker' && m.winner === 'fakers');
    let title, sub;
    if (this.role === 'watcher') {
      if (m.winner === 'watcher') [title, sub] = [t.watchWin, t.watchWinSub];
      else if (m.reason === 'goal') [title, sub] = [t.watchLose, t.watchLoseSub];
      else if (m.reason === 'nomarks') [title, sub] = [t.watchMarks, t.watchMarksSub];
      else [title, sub] = [t.watchTimeUp, t.watchTimeUpSub];
    } else {
      const meCaught = this.you && this.you.eliminated;
      if (m.winner === 'fakers') [title, sub] = [t.win, t.winSub];
      else [title, sub] = meCaught ? [t.lose, t.loseSub] : [t.timeUp, t.timeUpSub];
    }
    if (iWon) { this.audio.win(); } else { this.audio.lose(); }
    this._banner(iWon ? 'bSafe' : 'bCaught', iWon ? PALETTE.green : PALETTE.red);
    setTimeout(() => {
      this.ui.showResult({
        win: iWon, title, sub,
        stats: [
          { k: t.statCaught || 'Fakers', v: `${this.total - this.alive}/${this.total}` },
          { k: t.statTime, v: fmt(TUNING.round.seconds - this.roundLeft) },
          { k: t.statActions, v: String(this.stats.actions) },
          { k: t.statSync, v: String(this.stats.syncs) },
        ],
      });
      if (this.onEnd) this.onEnd(m);
    }, 1700);
  }

  _banner(key, color) { this.bannerKey = key; this.bannerColor = color; this.bannerT = 1.1; }

  // Called each animation frame by the host loop.
  frame(raw) {
    this.time += raw;
    this.flash = Math.max(0, this.flash - raw * 2.2);
    this.slowmoT = Math.max(0, this.slowmoT - raw);
    this.timeScale = this.slowmoT > 0 ? TUNING.fx.slowmo : 1;
    this.fxFlashA = Math.max(0, this.fxFlashA - raw * 3.2);
    this.bannerT = Math.max(0, this.bannerT - raw);
    const dt = raw * this.timeScale;

    if (!this.ended) {
      // countdown interpolation between snapshots
      this.light.timeLeft = Math.max(0, this.light.timeLeft - dt);
    }

    // Interpolate remote characters toward their snapshot targets.
    const k = 1 - Math.pow(0.0000001, dt);
    for (const c of this.chars.values()) {
      if (c.id === this.youId) continue;
      c.x += (c.tx - c.x) * Math.min(1, k * 1.2);
      c.y += (c.ty - c.y) * Math.min(1, k * 1.2);
      c.freezePop = Math.max(0, c.freezePop - dt * 3);
    }

    if (this.role === 'faker' && this.you && !this.ended) this._controlFaker(dt, raw);
    else if (this.role === 'watcher' && !this.ended) this._controlWatcher(dt);

    this._render();
  }

  _controlFaker(dt, raw) {
    const p = this.you;
    const inp = this.input;
    // Touch taps on HUD buttons.
    if (inp.clicked && !p.eliminated) {
      const h = this.hud.hit(inp.pointer.x, inp.pointer.y);
      if (h) {
        if (h.type === 'action') this._perform(h.id);
        else if (h.type === 'sync') this._sync();
      }
    }
    const ax = inp.axis();
    const onRed = this.light.phase === 'red';
    const jogging = inp.jogging() && ax.mag > 0;
    const speed = jogging ? TUNING.faker.jog : TUNING.faker.walk;
    p.lastFacing = p.facing;
    p._syncedThisFrame = false;

    if (p.eliminated) { p.vx = p.vy = 0; p.speed = 0; }
    else if (ax.mag > 0 && onRed) {
      p.vx = 0; p.vy = 0; p.speed = 0; p.state = 'idle';
      p.targetFacing = Math.atan2(ax.y, ax.x);
      p.pose = p.activeAction ? p.activeAction.pose : 'stand';
    } else if (ax.mag > 0) {
      p.activeAction = null;
      p.vx = ax.x * speed; p.vy = ax.y * speed; p.speed = speed; p.state = 'walking';
      p.targetFacing = Math.atan2(ax.y, ax.x);
    } else {
      p.vx = 0; p.vy = 0; p.speed = 0; p.state = 'idle';
      p.pose = p.activeAction ? p.activeAction.pose : 'stand';
    }

    if (!p.eliminated) {
      for (const a of ACTIONS) if (inp.pressed.has(a.key)) this._perform(a.id);
      if (inp.pressed.has('q')) this._performSmart();
      p.syncCooldown = Math.max(0, p.syncCooldown - dt);
      if (inp.pressed.has('e')) this._sync();
      if (p.activeAction) { p.activeAction.timer -= dt; p.pose = p.activeAction.pose; if (p.activeAction.timer <= 0) p.activeAction = null; }
    }

    integrate(p, dt, this.world);

    // Conformity feedback (personal only — the human Watcher reads you visually).
    if (onRed && !p.eliminated) {
      const base = crowdBaseline(p.x, p.y, [...this.chars.values()]);
      const ev = evaluateFreeze(p, base);
      p.humanness = ev.humanness; p.tellTag = ev.tag; p.baseFacing = base.facing;
    } else { p.humanness = 0; p.tellTag = 'ok'; p.baseFacing = null; }
    updatePlayerSuspicion(p, dt, { light: this.light, world: this.world, crowd: [...this.chars.values()], humanness: p.humanness });

    // Relay state ~20Hz.
    this._sendAcc += raw;
    if (this._sendAcc >= 0.05) {
      this._sendAcc = 0;
      this.net.send({ t: 'state', x: Math.round(p.x), y: Math.round(p.y), fa: +p.facing.toFixed(2), po: p.pose, st: p.state });
    }

    this.renderer.updateCamera(p, dt, 1240, 820);
  }

  _perform(id) {
    const a = ACTIONS.find((x) => x.id === id); if (!a) return;
    const valid = a.ctx === 'any' || !!this.world.nearestZone(this.you.x, this.you.y, a.ctx, 84);
    this.you.activeAction = { id, pose: ACTION_POSE[id], timer: TUNING.disguise.actionDuration };
    this.you.pose = ACTION_POSE[id];
    this.stats.actions++; this.audio.action(); if (!valid) this.audio.penalty();
  }
  _performSmart() {
    const p = this.you;
    for (const tag of ['bench', 'vending', 'shop', 'sign']) if (this.world.nearestZone(p.x, p.y, tag, 84)) { const a = ACTIONS.find((x) => x.ctx === tag); if (a) return this._perform(a.id); }
    this._perform('phone');
  }
  _sync() {
    const p = this.you; if (p.syncCooldown > 0) return;
    let best = null, bd = TUNING.disguise.syncRange ** 2;
    for (const c of this.chars.values()) {
      if (c === p || c.eliminated) continue;
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2; if (d < bd) { bd = d; best = c; }
    }
    if (!best) { this.audio.penalty(); return; }
    p.facing = best.facing; p.targetFacing = best.facing; p.pose = best.pose;
    p.activeAction = { id: 'sync', pose: best.pose, timer: TUNING.disguise.actionDuration };
    p._syncedThisFrame = true; p.syncCooldown = TUNING.disguise.syncCooldown; this.stats.syncs++; this.audio.syncStart();
  }

  _controlWatcher(dt) {
    const inp = this.input, ws = this.watch;
    const wp = this.renderer.s2w(inp.pointer.x, inp.pointer.y);
    ws.reticle.x = wp.x; ws.reticle.y = wp.y;
    ws.hover = this._pick(wp.x, wp.y, TUNING.watch.pickRadius);
    if (inp.rightClicked && ws.hover) { if (ws.pins.has(ws.hover.id)) ws.pins.delete(ws.hover.id); else ws.pins.add(ws.hover.id); this.audio.uiSelect(); }
    if (inp.clicked && this.light.phase === 'red' && ws.hover) { this.audio.accuse(); this.net.send({ t: 'accuse', id: ws.hover.id }); }
    this._sendAcc += dt;
    if (this._sendAcc >= 0.08) { this._sendAcc = 0; this.net.send({ t: 'watch', rx: Math.round(wp.x), ry: Math.round(wp.y) }); }
    this.renderer.updateCamera({ x: this.world.w / 2, y: this.world.h / 2 + 30 }, dt, TUNING.watch.viewW, TUNING.watch.viewH);
  }

  _pick(wx, wy, r) {
    let best = null, bd = r * r;
    for (const c of this.chars.values()) { if (c.eliminated) continue; const dx = c.x - wx, dy = (c.y - 14) - wy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = c; } }
    return best;
  }

  _render() {
    const t = this.T();
    const charArr = [...this.chars.values()];
    const scene = {
      chars: charArr,
      light: { phase: this.light.phase, timeLeft: this.light.timeLeft },
      reticle: null, role: this.role,
      watch: this.role === 'watcher' ? this.watch : null,
      reveal: !!this.ended, flash: this.flash, time: this.time, threat: 0,
      tells: { facing: t.tellFacing, iso: t.tellIso, pose: t.tellPose, move: t.tellMove, ok: t.tellOk },
      fxFlash: { col: this.fxFlashCol, a: this.fxFlashA },
      banner: this.bannerT > 0 && this.bannerKey ? { text: t[this.bannerKey] || '', color: this.bannerColor, alpha: Math.min(1, this.bannerT) } : null,
      goalMarker: (this.role === 'faker' && this.you && !this.you.eliminated && !this.ended)
        ? { x: this.world.goal.x, y: this.world.goal.y, label: `▲ ${t.goalWord} ${Math.max(0, Math.round(Math.hypot(this.world.goal.x - this.you.x, this.world.goal.y - this.you.y) / 16))}m` }
        : null,
    };
    this.renderer.render(scene);
    this._renderHud();
  }

  _renderHud() {
    const c = this.renderer, ctx = c.ctx, t = this.T();
    const base = {
      lang: this.settings.lang, hudScale: this.settings.hudScale, time: this.time, colorblind: this.settings.colorblind,
      light: { phase: this.light.phase, timeLeft: this.light.timeLeft, phaseDuration: this.light.phaseDuration },
      roundLeft: this.roundLeft, role: this.role,
      joy: this.input.joy, popups: null,
    };
    let s;
    if (this.role === 'watcher') {
      const red = this.light.phase === 'red';
      s = { ...base, marks: this.marks, maxMarks: 6, fakersAlive: this.alive, fakersTotal: this.total, pinsCount: this.watch.pins.size, hint: red ? t.accuseHint : t.observeHint, pinHint: t.pinHint };
    } else {
      const p = this.you || { x: 0, y: this.spawnY, suspicion: 0, syncCooldown: 0, humanness: 0, activeAction: null };
      s = {
        ...base, survival: TUNING.round.seconds - this.roundLeft, marks: this.marks, maxMarks: 6,
        progress: clamp01((this.spawnY - p.y) / (this.spawnY - this.world.goal.y)),
        tension: p.suspicion, penalty: this.light.phase === 'red' && p.humanness > 0.3,
        syncReady: p.syncCooldown <= 0, syncCooldownFrac: p.syncCooldown <= 0 ? 1 : 1 - p.syncCooldown / TUNING.disguise.syncCooldown,
        syncSecondsLeft: p.syncCooldown, activeActionId: p.activeAction ? p.activeAction.id : null,
        actionProgress: p.activeAction ? p.activeAction.timer / TUNING.disguise.actionDuration : null,
        actions: ACTIONS.map((a) => ({ ...a, valid: a.ctx === 'any' || !!this.world.nearestZone(p.x, p.y, a.ctx, 84) })),
        missions: null,
      };
    }
    ctx.save(); ctx.scale(c.dpr, c.dpr); this.hud.draw(ctx, c.vw, c.vh, s); ctx.restore();
  }

  dispose() { try { this.net.close(); } catch { /* ignore */ } }
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function fmt(sec) { sec = Math.max(0, sec | 0); const m = (sec / 60) | 0, s = sec % 60; return `${m}:${s.toString().padStart(2, '0')}`; }
