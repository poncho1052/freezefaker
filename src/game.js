// Game orchestration: state machine, main loop, and glue between world,
// crowd, systems, HUD and UI.
import { TUNING, ACTIONS, PALETTE, I18N } from './config.js';
import { makeRng } from './rng.js';
import { createWorld } from './world.js';
import { Renderer } from './renderer.js';
import { Hud } from './hud.js';
import {
  makeNpc, makeFaker, updateNpc, updateFakerAI, integrate, separate, scheduleResume,
} from './characters.js';
import { LightCycle } from './lights.js';
import { updatePlayerSuspicion } from './suspicion.js';
import { WatcherAI } from './watcher.js';

const ACTION_POSE = { phone: 'phone', shop: 'shop', vending: 'vending', sit: 'sit', sign: 'sign', look: 'look' };

export class Game {
  constructor({ canvas, input, audio, ui, settings, live }) {
    this.canvas = canvas;
    this.input = input;
    this.audio = audio;
    this.ui = ui;
    this.settings = settings;
    this.live = live;
    this.hud = new Hud();
    this.state = 'menu';
    this.time = 0;
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    // Resume from pause via Escape / P (pausing is handled in the update step).
    this.input.onPress((k) => {
      if ((k === 'escape' || k === 'p') && this.state === 'paused') this.resume();
    });
    requestAnimationFrame(this._loop);
    // Lightweight debug/telemetry hook (also used by automated smoke tests).
    if (typeof window !== 'undefined') window.__ff = this;
  }

  announce(msg) { if (this.live) this.live.textContent = msg; }

  // ---------------- lifecycle ----------------
  start(tutorial = false) {
    this.audio.resume();
    const rng = makeRng();
    this.rng = rng;
    this.tutorial = tutorial;
    this.world = createWorld();
    this.renderer = new Renderer(this.canvas, this.world);

    // Build the crowd.
    this.chars = [];
    const spots = this.world.spawnPoints.slice();
    shuffle(spots, rng);

    // Player.
    this.player = makeFaker(rng, this.world, spots.pop(), true);
    this.chars.push(this.player);

    // AI Fakers (decoys who also race to the gate).
    const fakerCount = tutorial ? 2 : 4;
    for (let i = 0; i < fakerCount; i++) this.chars.push(makeFaker(rng, this.world, spots.pop(), false));

    // NPC crowd scattered across the plaza.
    const npcCount = tutorial ? 34 : 48;
    for (let i = 0; i < npcCount; i++) {
      const wp = rng.pick(this.world.waypoints);
      const spawn = { x: wp.x + rng.range(-40, 40), y: wp.y + rng.range(-40, 40) };
      this.chars.push(makeNpc(rng, this.world, spawn));
    }

    // Systems.
    this.lights = new LightCycle(rng, (phase, prev) => this._onPhase(phase, prev));
    this.watcher = new WatcherAI(rng);
    if (tutorial) this.watcher.__lenient = 18;

    // Round + stats.
    this.roundLeft = TUNING.round.seconds;
    this.survival = 0;
    this.spawnY = this.player.y;
    this.stats = { actions: 0, syncs: 0 };

    this.tipStage = 0; this.tipTimer = tutorial ? 0.5 : 0;
    this.endTimer = 0; this.ending = null;

    this.state = 'playing';
    this.ui.hideAll();
    this.announce(I18N[this.settings.lang].greenSub);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.show('pause');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hideAll();
    this.last = performance.now();
  }
  quitToTitle() {
    this.state = 'menu';
    this.ui.show('title');
  }

  _onPhase(phase, prev) {
    if (phase === 'warning') this.audio.redWarning();
    else if (phase === 'red') { this.audio.redStart(); this.audio.freezeSnap(); this.announce(I18N[this.settings.lang].redSub); }
    else if (phase === 'green') {
      this.audio.greenStart();
      this.announce(I18N[this.settings.lang].greenSub);
      // stagger NPC + faker resume
      for (const c of this.chars) if (c.kind === 'npc' || c.kind === 'faker') scheduleResume(c, this.rng);
    }
    this.audio.setTension(this.lights.tension);
  }

  // ---------------- main loop ----------------
  _loop(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;          // clamp big frame gaps
    this.time += dt;

    if (this.state === 'playing') this._update(dt);
    this._render();
    this.input.endFrame();
    requestAnimationFrame(this._loop);
  }

  _update(dt) {
    // Pause toggle.
    if (this.input.pressed.has('escape') || this.input.pressed.has('p')) { this.pause(); return; }

    const ctx = { world: this.world, light: this.lights, rng: this.rng, audio: this.audio, chars: this.chars };

    // Ending sequence (accusation reveal) plays out before the result screen.
    if (this.ending) {
      this.endTimer -= dt;
      this._stepCrowd(dt, ctx);
      this._renderScene();
      if (this.endTimer <= 0) this._showResult(this.ending);
      return;
    }

    this.lights.update(dt);
    this.roundLeft -= dt;
    this.survival += dt;

    this._playerControl(dt);
    this._stepCrowd(dt, ctx);

    // Suspicion + watcher.
    updatePlayerSuspicion(this.player, dt, { light: this.lights, world: this.world, crowd: this.chars });
    const threshold = TUNING.watcher.accuseThreshold + (this.watcher.__lenient || 0);
    this.watcher.update(dt, {
      light: this.lights, chars: this.chars, audio: this.audio,
      onAccuse: (target, correct) => this._onAccuse(target, correct),
      threshold,
    });

    this._resolveAccusations(dt);
    this._tutorialTips(dt);

    // Win / lose checks.
    if (this.player.goalReached) return this._beginEnd({ win: true });
    if (this.roundLeft <= 0) return this._beginEnd({ win: false, reason: 'timeup' });
    if (this.watcher.marks <= 0) return this._beginEnd({ win: true, reason: 'marks' });

    this.renderer.updateCamera(this.player, dt);
  }

  _playerControl(dt) {
    const p = this.player;
    if (p.eliminated) return;
    const inp = this.input;
    const ax = inp.axis();
    const jogging = inp.down('shift') && ax.mag > 0;
    p._jogging = jogging;
    const speed = jogging ? TUNING.faker.jog : TUNING.faker.walk;

    // Movement.
    if (ax.mag > 0) {
      // Cancel any held disguise pose when you move.
      p.activeAction = null;
      p.vx = ax.x * speed; p.vy = ax.y * speed; p.speed = speed;
      p.state = 'walking';
      const ang = Math.atan2(ax.y, ax.x);
      p.targetFacing = ang;
      if (p._inputAngle != null) {
        let d = Math.abs(angDelta(ang, p._inputAngle));
        if (d > 2.2) p._sharpTurn = true;
      }
      p._inputAngle = ang;
    } else {
      p.vx = 0; p.vy = 0; p.speed = 0; p.state = 'idle';
      p._inputAngle = null;
      if (p.activeAction) p.pose = p.activeAction.pose; else p.pose = 'stand';
    }

    // Reaching the goal.
    if (Math.hypot(this.world.goal.x - p.x, this.world.goal.y - p.y) < 66) p.goalReached = true;

    // Disguise actions (1-6, or Q for smart pick).
    for (const a of ACTIONS) {
      if (inp.pressed.has(a.key)) this._perform(a.id);
    }
    if (inp.pressed.has('q')) this._performSmart();

    // NPC Sync (E).
    p.syncCooldown = Math.max(0, p.syncCooldown - dt);
    if (inp.pressed.has('e')) this._sync();

    // Active disguise timer.
    if (p.activeAction) {
      p.activeAction.timer -= dt;
      p.pose = p.activeAction.pose;
      if (p.activeAction.timer <= 0) p.activeAction = null;
    }

    // Collision feedback with NPCs.
    p._collideCd = Math.max(0, (p._collideCd || 0) - dt);
    if (p.speed > 10 && p._collideCd === 0) {
      for (const c of this.chars) {
        if (c === p || c.kind !== 'npc' || c.eliminated) continue;
        if (Math.hypot(c.x - p.x, c.y - p.y) < c.radius + p.radius + 1) { p._collided = true; p._collideCd = 0.6; break; }
      }
    }
  }

  _perform(id) {
    const a = ACTIONS.find((x) => x.id === id);
    if (!a) return;
    const valid = a.ctx === 'any' || !!this.world.nearestZone(this.player.x, this.player.y, a.ctx, 84);
    this.player._actionResult = valid ? 'valid' : 'invalid';
    this.player.activeAction = { id, pose: ACTION_POSE[id], timer: TUNING.disguise.actionDuration };
    this.player.pose = ACTION_POSE[id];
    this.stats.actions++;
    this.audio.action();
    if (!valid) this.audio.penalty();
  }

  _performSmart() {
    // Pick the best contextual action for where you're standing.
    const p = this.player;
    for (const tag of ['bench', 'vending', 'shop', 'sign']) {
      if (this.world.nearestZone(p.x, p.y, tag, 84)) {
        const a = ACTIONS.find((x) => x.ctx === tag);
        if (a) return this._perform(a.id);
      }
    }
    this._perform('phone');
  }

  _sync() {
    const p = this.player;
    if (p.syncCooldown > 0) return;
    let best = null, bd = TUNING.disguise.syncRange ** 2;
    for (const c of this.chars) {
      if (c.kind !== 'npc' || c.eliminated) continue;
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) { this.audio.penalty(); return; }
    p.facing = best.facing; p.targetFacing = best.facing;
    p.pose = best.pose; p.activeAction = { id: 'sync', pose: best.pose, timer: TUNING.disguise.actionDuration };
    p._syncedThisFrame = true;
    p.syncCooldown = TUNING.disguise.syncCooldown;
    this.stats.syncs++;
    this.audio.syncStart();
  }

  _stepCrowd(dt, ctx) {
    for (const c of this.chars) {
      if (c.kind === 'npc') updateNpc(c, dt, ctx);
      else if (c.kind === 'faker') updateFakerAI(c, dt, ctx);
      integrate(c, dt, this.world);
    }
    separate(this.chars, dt);
  }

  _onAccuse(target, correct) {
    target.accused = 1.1;
    target._accuseCorrect = correct;
    if (target.kind === 'player') this.announce(I18N[this.settings.lang].caught);
  }

  _resolveAccusations(dt) {
    for (const c of this.chars) {
      if (c.accused > 0) {
        c.accused -= dt;
        if (c.accused <= 0) {
          c.accused = 0;
          if (c._accuseCorrect) {
            c.eliminated = true;
            if (c.kind === 'player') this._beginEnd({ win: false, reason: 'caught' });
          }
        }
      }
    }
  }

  _tutorialTips(dt) {
    if (!this.tutorial) return;
    this.tipTimer -= dt;
    const t = I18N[this.settings.lang];
    // advance tips on simple conditions
    if (this.tipStage === 0) { this.tip = t.tutHint1; if (this.player.y < this.spawnY - 120) { this.tipStage = 1; } }
    else if (this.tipStage === 1) { this.tip = this.lights.phase === 'red' ? t.tutHint2 : t.tutHint1; if (this.lights.cycles >= 1) this.tipStage = 2; }
    else if (this.tipStage === 2) { this.tip = t.tutHint3; if (this.stats.syncs > 0) this.tipStage = 3; }
    else this.tip = null;
  }

  _beginEnd(result) {
    if (this.ending) return;
    // If the player was caught, let the reveal animation play; otherwise short beat.
    this.ending = result;
    this.endTimer = result.reason === 'caught' ? 0.2 : 1.1;
    if (result.win) this.audio.win(); else if (result.reason !== 'caught') this.audio.lose();
    if (result.win) this.audio.goal();
    this.audio.setTension(0.2);
  }

  _showResult(result) {
    this.state = 'result';
    const progress = clamp01((this.spawnY - this.player.y) / (this.spawnY - this.world.goal.y));
    if (!result.win && result.reason === 'caught') this.audio.caught();
    this.ui.showResult({
      win: result.win,
      reason: result.reason,
      survival: fmt(this.survival),
      progress: Math.round(progress * 100) + '%',
      actions: this.stats.actions,
      syncs: this.stats.syncs,
    });
    this.announce(result.win ? I18N[this.settings.lang].win : I18N[this.settings.lang].lose);
    this.ending = null;
  }

  // ---------------- rendering ----------------
  _render() {
    if (this.state === 'menu' || this.state === 'result') {
      // Keep a calm ambient render behind menus if a world exists.
      if (this.renderer && (this.state === 'result')) this._renderScene();
      return;
    }
    this._renderScene();
    if (this.state === 'playing' || this.ending) this._renderHud();
  }

  _renderScene() {
    const scene = {
      chars: this.chars,
      light: { phase: this.lights.phase, timeLeft: this.lights.timeLeft },
      reticle: this.watcher.reticle,
      time: this.time,
    };
    this.renderer.render(scene);
  }

  _renderHud() {
    const ctx = this.renderer.ctx;
    const p = this.player;
    const px = p.x, py = p.y;
    const s = {
      lang: this.settings.lang,
      hudScale: this.settings.hudScale,
      time: this.time,
      light: { phase: this.lights.phase, timeLeft: this.lights.timeLeft, phaseDuration: this.lights.phaseDuration },
      roundLeft: this.roundLeft,
      survival: this.survival,
      marks: this.watcher.marks, maxMarks: TUNING.watcher.marks,
      progress: clamp01((this.spawnY - py) / (this.spawnY - this.world.goal.y)),
      tension: p.suspicion,
      penalty: this.lights.phase === 'red' && p.speed > 10,
      syncReady: p.syncCooldown <= 0,
      syncCooldownFrac: p.syncCooldown <= 0 ? 1 : 1 - p.syncCooldown / TUNING.disguise.syncCooldown,
      syncSecondsLeft: p.syncCooldown,
      colorblind: this.settings.colorblind,
      activeActionId: p.activeAction ? p.activeAction.id : null,
      actionProgress: p.activeAction ? p.activeAction.timer / TUNING.disguise.actionDuration : null,
      actions: ACTIONS.map((a) => ({
        ...a,
        valid: a.ctx === 'any' || !!this.world.nearestZone(px, py, a.ctx, 84),
      })),
    };
    // scale HUD drawing into CSS pixels (renderer.ctx is already dpr-scaled per frame? no)
    const c = this.renderer;
    ctx.save();
    ctx.scale(c.dpr, c.dpr);
    this.hud.draw(ctx, c.vw, c.vh, s);
    if (this.tutorial && this.tip) this._drawTip(ctx, c.vw, c.vh, this.tip);
    ctx.restore();
  }

  _drawTip(ctx, vw, vh, text) {
    ctx.font = '600 15px system-ui, sans-serif';
    const w = Math.min(ctx.measureText(text).width + 40, vw - 40);
    const x = vw / 2 - w / 2, y = vh - 190;
    ctx.fillStyle = 'rgba(14,22,33,0.9)';
    rr(ctx, x, y, w, 40, 10); ctx.fill();
    ctx.strokeStyle = PALETTE.amber; ctx.lineWidth = 1.5; rr(ctx, x, y, w, 40, 10); ctx.stroke();
    ctx.fillStyle = PALETTE.offwhite; ctx.textAlign = 'center';
    ctx.fillText(text, vw / 2, y + 25);
  }

  applySettings() {
    this.audio.setVolume(this.settings.volume);
  }
}

// helpers
function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i);[a[i], a[j]] = [a[j], a[i]]; } }
function angDelta(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function fmt(sec) { sec = Math.max(0, sec | 0); const m = (sec / 60) | 0, s = sec % 60; return `${m}:${s.toString().padStart(2, '0')}`; }
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
