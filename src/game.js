// Game orchestration: modes (Classic / Blend Task / Watcher), state machine,
// main loop, and glue between world, crowd, systems, HUD and UI.
import { TUNING, ACTIONS, MISSIONS, PALETTE, I18N } from './config.js';
import { makeRng } from './rng.js';
import { createWorld } from './world.js';
import { Renderer } from './renderer.js';
import { Hud } from './hud.js';
import {
  makeNpc, makeFaker, updateNpc, updateFakerAI, integrate, separate, scheduleResume,
} from './characters.js';
import { LightCycle } from './lights.js';
import { updatePlayerSuspicion } from './suspicion.js';
import { crowdBaseline, evaluateFreeze } from './conformity.js';
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
    this.mode = 'classic';
    this.role = 'faker';
    this.time = 0;
    this.flash = 0;
    this.reveal = false;
    // screen-feel state
    this.timeScale = 1; this.slowmoT = 0; this.threat = 0;
    this.fxFlashA = 0; this.fxFlashCol = [229, 57, 53];
    this.bannerKey = null; this.bannerColor = '#fff'; this.bannerT = 0;
    this._alerted = false; this._hbAcc = 0;
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    this.input.onPress((k) => {
      if ((k === 'escape' || k === 'p') && this.state === 'paused') this.resume();
    });
    requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__ff = this;
  }

  announce(msg) { if (this.live) this.live.textContent = msg; }
  T() { return I18N[this.settings.lang] || I18N.en; }

  // ---------------- lifecycle ----------------
  start(opts = {}) {
    const mode = opts.mode || 'classic';
    const tutorial = !!opts.tutorial;
    this.audio.resume();
    const rng = makeRng();
    this.rng = rng;
    this.mode = tutorial ? 'classic' : mode;
    this.tutorial = tutorial;
    this.role = this.mode === 'watch' ? 'watcher' : 'faker';
    this.world = createWorld();
    this.renderer = new Renderer(this.canvas, this.world);

    this.chars = [];
    const spots = this.world.spawnPoints.slice();
    shuffle(spots, rng);

    if (this.role === 'faker') {
      this.player = makeFaker(rng, this.world, spots.pop(), true);
      this.chars.push(this.player);
    } else {
      this.player = null;
    }

    // Fakers: decoys in Faker modes, the targets in Watcher mode.
    const fakerCount = this.role === 'watcher' ? 5 : (tutorial ? 2 : 4);
    for (let i = 0; i < fakerCount; i++) this.chars.push(makeFaker(rng, this.world, spots.pop() || rng.pick(this.world.spawnPoints), false));

    const npcCount = tutorial ? 34 : 48;
    for (let i = 0; i < npcCount; i++) {
      const wp = rng.pick(this.world.waypoints);
      this.chars.push(makeNpc(rng, this.world, { x: wp.x + rng.range(-40, 40), y: wp.y + rng.range(-40, 40) }));
    }

    this.lights = new LightCycle(rng, (phase, prev) => this._onPhase(phase, prev));

    if (this.role === 'faker') {
      this.watcher = new WatcherAI(rng);       // AI opponent
      if (tutorial) this.watcher.__lenient = 18;
      this.watch = null;
    } else {
      this.watcher = null;
      this.watch = { marks: TUNING.watch.marks, reticle: { x: this.world.w / 2, y: this.world.h / 2 }, hover: null, pins: new Set(), fakersTotal: fakerCount };
    }

    // Missions (Blend Task).
    if (this.mode === 'mission') {
      const pool = MISSIONS.slice(); shuffle(pool, rng);
      this.missions = pool.slice(0, 3).map((m) => ({ ...m, done: false }));
    } else this.missions = null;

    this.roundLeft = TUNING.round.seconds;
    this.survival = 0;
    this.spawnY = this.player ? this.player.y : this.world.h - 90;
    this.stats = { actions: 0, syncs: 0, correct: 0, false: 0 };
    this.tipStage = 0; this.tip = null;
    this.endTimer = 0; this.ending = null; this.reveal = false; this.flash = 0;

    this.state = 'playing';
    this.ui.hideAll();
    this.announce(this.T().greenSub);
  }

  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.ui.show('pause'); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.ui.hideAll(); this.last = performance.now(); }
  quitToTitle() { this.state = 'menu'; this.ui.show('title'); }

  _onPhase(phase, prev) {
    if (phase === 'warning') this.audio.redWarning();
    else if (phase === 'red') { this.audio.redStart(); this.audio.freezeSnap(); this.flash = 1; this.renderer.addShake(5); this.announce(this.T().redSub); }
    else if (phase === 'green') {
      this.audio.greenStart();
      this.announce(this.T().greenSub);
      for (const c of this.chars) if (c.kind === 'npc' || c.kind === 'faker') scheduleResume(c, this.rng);
    }
    this.audio.setTension(this.lights.tension);
  }

  // ---------------- main loop ----------------
  _loop(now) {
    let raw = (now - this.last) / 1000;
    this.last = now;
    if (raw > 0.05) raw = 0.05;
    this.time += raw;

    if (this.state === 'online' && this.online) {
      this.online.frame(raw);
      this.input.endFrame();
      requestAnimationFrame(this._loop);
      return;
    }

    this.flash = Math.max(0, this.flash - raw * 2.2);
    this._updateFx(raw);
    const dt = raw * this.timeScale;

    if (this.state === 'playing') this._update(dt, raw);
    this._render();
    this.input.endFrame();
    requestAnimationFrame(this._loop);
  }

  enterOnline(match) { this.online = match; this.state = 'online'; this.ui.hideAll(); }
  exitOnline() { if (this.online) { this.online.dispose(); this.online = null; } this.state = 'menu'; }

  // Screen-feel: slow-mo, flash, banner timers, and the hunted-lock threat loop.
  _updateFx(raw) {
    this.slowmoT = Math.max(0, this.slowmoT - raw);
    this.timeScale = this.slowmoT > 0 ? TUNING.fx.slowmo : 1;
    this.fxFlashA = Math.max(0, this.fxFlashA - raw * 3.2);
    this.bannerT = Math.max(0, this.bannerT - raw);

    if (this.state !== 'playing') { this.threat *= (1 - Math.min(1, raw * 4)); return; }

    if (this.role === 'faker' && this.watcher && !this.ending) {
      const w = this.watcher;
      const onMe = w.target === this.player && w.reticle.visible && !this.player.eliminated;
      const goal = onMe ? Math.min(1, w.reticle.lock) : 0;
      const prev = this.threat;
      this.threat += (goal - prev) * Math.min(1, raw * 7);
      if (onMe && w.reticle.lock > 0.14 && !this._alerted) {
        this._alerted = true; this.audio.alertSting(); this._banner('bSpotted', PALETTE.red); this.renderer.addShake(7);
      }
      if (!onMe || w.reticle.lock < 0.05) {
        if (this._alerted && prev > 0.4) { this.audio.relief(); this._banner('bClose', PALETTE.green); }
        this._alerted = false;
      }
      // Heartbeat quickens with danger.
      this._hbAcc += raw;
      const period = this.threat > 0.06 ? 0.92 - this.threat * 0.6 : 999;
      if (this._hbAcc >= period) { this._hbAcc = 0; this.audio.heartbeat(0.5 + this.threat); }
    } else {
      this.threat *= (1 - Math.min(1, raw * 4));
    }
  }

  _banner(key, color) { this.bannerKey = key; this.bannerColor = color; this.bannerT = 1.1; }

  // Slow-mo + camera punch + shake + flash on a dramatic accusation.
  _dramatize(target, correct, isPlayer) {
    this.slowmoT = isPlayer ? TUNING.fx.slowmoPlayer : TUNING.fx.slowmoDecoy;
    this.renderer.punchZoom(target.x, target.y, isPlayer ? 0.9 : 0.6, this.slowmoT + 0.1);
    this.renderer.addShake(isPlayer ? 15 : 9);
    this.fxFlashA = isPlayer ? 0.75 : 0.5;
    this.fxFlashCol = correct ? [229, 57, 53] : [255, 193, 7];
    this.audio.impact();
    if (isPlayer) this._banner('bCaught', PALETTE.red);
    else if (correct) this._banner('bGotcha', PALETTE.amber);
    else this._banner('bMiss', PALETTE.amber);
  }

  _update(dt, raw = dt) {
    if (this.input.pressed.has('escape') || this.input.pressed.has('p')) { this.pause(); return; }
    const ctx = { world: this.world, light: this.lights, rng: this.rng, audio: this.audio, chars: this.chars };

    if (this.ending) {
      this.endTimer -= raw;
      this._stepCrowd(dt, ctx);
      this._scoreConformity(dt);
      if (this.endTimer <= 0) this._showResult(this.ending);
      return;
    }

    this.lights.update(dt);
    this.roundLeft -= dt;
    this.survival += dt;

    if (this.role === 'faker') this._playerControl(dt);
    this._stepCrowd(dt, ctx);
    this._scoreConformity(dt);

    if (this.role === 'faker') {
      updatePlayerSuspicion(this.player, dt, { light: this.lights, world: this.world, crowd: this.chars, humanness: this.player.humanness });
      this.watcher.update(dt, {
        light: this.lights, chars: this.chars, audio: this.audio,
        onAccuse: (t, correct) => this._onAccuse(t, correct),
      });
    } else {
      this._watcherControl(dt);
    }

    this._resolveAccusations(dt);
    if (this.missions) this._checkMissions(dt);
    this._tutorialTips(dt);

    // ---- win / lose ----
    if (this.role === 'faker') {
      if (this.player.goalReached) return this._beginEnd(true, 'goal');
      if (this.roundLeft <= 0) return this._beginEnd(false, 'timeup');
      if (this.watcher.marks <= 0) return this._beginEnd(true, 'marks');
    } else {
      const fakers = this.chars.filter((c) => c.kind === 'faker');
      if (fakers.some((c) => c.goalReached)) return this._beginEnd(false, 'watchlose');
      if (fakers.length && fakers.every((c) => c.eliminated)) return this._beginEnd(true, 'watchwin');
      if (this.roundLeft <= 0) return this._beginEnd(false, 'watchtime');
      if (this.watch.marks <= 0) return this._beginEnd(false, 'watchmarks');
    }

    const view = this.role === 'watcher'
      ? { f: { x: this.world.w / 2, y: this.world.h / 2 + 30 }, w: TUNING.watch.viewW, h: TUNING.watch.viewH }
      : { f: this.player, w: 1240, h: 820 };
    this.renderer.updateCamera(view.f, dt, view.w, view.h);
  }

  // ---------------- conformity scoring (the core mechanic) ----------------
  _scoreConformity(dt) {
    const red = this.lights.phase === 'red';
    const C = TUNING.conform;
    for (const c of this.chars) {
      if (c.kind !== 'faker' && c.kind !== 'player') continue;
      if (c.eliminated || c.goalReached) { c.humanness = 0; c.tellTag = 'ok'; c.baseFacing = null; continue; }
      if (!red) { c.humanness = 0; c.tellTag = 'ok'; c.baseFacing = null; continue; }
      const base = crowdBaseline(c.x, c.y, this.chars);
      const ev = evaluateFreeze(c, base);
      c.humanness = ev.humanness; c.tellTag = ev.tag; c.baseFacing = base.facing;
      if (c.kind === 'faker') {
        if (ev.humanness > C.tellShow) { c.suspicion = Math.min(100, c.suspicion + C.redRise * ev.humanness * dt); if (ev.humanness > 0.6) c.mistake = Math.max(c.mistake, 0.3); }
        else c.suspicion = Math.max(0, c.suspicion - C.goodFreeze * dt);
      }
    }
  }

  // ---------------- Faker control ----------------
  _playerControl(dt) {
    const p = this.player;
    if (p.eliminated) return;
    const inp = this.input;
    const ax = inp.axis();
    const jogging = inp.down('shift') && ax.mag > 0;
    p._jogging = jogging;
    const speed = jogging ? TUNING.faker.jog : TUNING.faker.walk;

    const onRed = this.lights.phase === 'red';
    if (ax.mag > 0 && onRed) {
      // RED LIGHT: you may pivot in place to fix your stance, but not walk.
      // This is the heart of the game — match the crowd's facing without moving.
      p.vx = 0; p.vy = 0; p.speed = 0; p.state = 'idle'; p._inputAngle = null;
      p.targetFacing = Math.atan2(ax.y, ax.x);
      p.pose = p.activeAction ? p.activeAction.pose : 'stand';
    } else if (ax.mag > 0) {
      p.activeAction = null;
      p.vx = ax.x * speed; p.vy = ax.y * speed; p.speed = speed; p.state = 'walking';
      const ang = Math.atan2(ax.y, ax.x); p.targetFacing = ang;
      if (p._inputAngle != null && Math.abs(angDelta(ang, p._inputAngle)) > 2.2) p._sharpTurn = true;
      p._inputAngle = ang;
    } else {
      p.vx = 0; p.vy = 0; p.speed = 0; p.state = 'idle'; p._inputAngle = null;
      p.pose = p.activeAction ? p.activeAction.pose : 'stand';
    }

    const canGoal = this.mode !== 'mission' || this._missionsDone();
    if (canGoal && Math.hypot(this.world.goal.x - p.x, this.world.goal.y - p.y) < 66) p.goalReached = true;

    for (const a of ACTIONS) if (inp.pressed.has(a.key)) this._perform(a.id);
    if (inp.pressed.has('q')) this._performSmart();

    p.syncCooldown = Math.max(0, p.syncCooldown - dt);
    if (inp.pressed.has('e')) this._sync();

    if (p.activeAction) { p.activeAction.timer -= dt; p.pose = p.activeAction.pose; if (p.activeAction.timer <= 0) p.activeAction = null; }

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
    // Mission completion via a valid contextual action.
    if (valid && this.missions) {
      const m = this.missions.find((mm) => !mm.done && !mm.red && mm.ctx === a.ctx);
      if (m) { m.done = true; this.audio.uiSelect(); }
    }
  }

  _performSmart() {
    const p = this.player;
    for (const tag of ['bench', 'vending', 'shop', 'sign']) {
      if (this.world.nearestZone(p.x, p.y, tag, 84)) { const a = ACTIONS.find((x) => x.ctx === tag); if (a) return this._perform(a.id); }
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

  // ---------------- Watcher control (human) ----------------
  _watcherControl(dt) {
    const inp = this.input, ws = this.watch;
    const wp = this.renderer.s2w(inp.pointer.x, inp.pointer.y);
    ws.reticle.x = wp.x; ws.reticle.y = wp.y;
    ws.hover = this._pickChar(wp.x, wp.y, TUNING.watch.pickRadius);
    if (inp.rightClicked && ws.hover) {
      if (ws.pins.has(ws.hover.id)) ws.pins.delete(ws.hover.id); else ws.pins.add(ws.hover.id);
      this.audio.uiSelect();
    }
    if (inp.clicked && this.lights.phase === 'red' && ws.hover) this._watcherAccuse(ws.hover);
  }

  _pickChar(wx, wy, r) {
    let best = null, bd = r * r;
    for (const c of this.chars) {
      if (c.eliminated) continue;
      const dx = c.x - wx, dy = (c.y - 14) - wy, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  _watcherAccuse(target) {
    if (target.accused > 0) return;
    const correct = target.kind === 'faker';
    this.audio.accuse();
    target.accused = 1.0; target._accuseCorrect = correct;
    this._dramatize(target, correct, false);
    if (correct) this.stats.correct++;
    else { this.stats.false++; this.watch.marks--; this.audio.falseAccuse(); }
    this.watch.pins.delete(target.id);
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
    target.accused = 1.1; target._accuseCorrect = correct;
    this._dramatize(target, correct, target.kind === 'player');
    if (target.kind === 'player') this.announce(this.T().caught);
  }

  _resolveAccusations(dt) {
    for (const c of this.chars) {
      if (c.accused > 0) {
        c.accused -= dt;
        if (c.accused <= 0) {
          c.accused = 0;
          if (c._accuseCorrect) {
            c.eliminated = true;
            if (c.kind === 'player') this._beginEnd(false, 'caught');
          }
        }
      }
    }
  }

  _missionsDone() { return this.missions ? this.missions.every((m) => m.done) : true; }

  _checkMissions(dt) {
    if (this.lights.phase !== 'red') return;
    const p = this.player;
    for (const m of this.missions) {
      if (m.done || !m.red) continue;
      if (this.world.nearestZone(p.x, p.y, m.ctx, 76)) { m.done = true; this.audio.uiSelect(); }
    }
  }

  _tutorialTips(dt) {
    if (!this.tutorial) return;
    const t = this.T();
    if (this.tipStage === 0) { this.tip = t.tutHint1; if (this.player.y < this.spawnY - 120) this.tipStage = 1; }
    else if (this.tipStage === 1) { this.tip = this.lights.phase === 'red' ? t.tutHint2 : t.tutHint1; if (this.lights.cycles >= 1) this.tipStage = 2; }
    else if (this.tipStage === 2) { this.tip = t.tutHint3; if (this.stats.syncs > 0) this.tipStage = 3; }
    else this.tip = null;
  }

  _beginEnd(win, key) {
    if (this.ending) return;
    this.ending = { win, key };
    this.reveal = true;
    this.endTimer = 1.6;
    this.threat = 0; this._alerted = false;
    if (win) {
      this.audio.win(); if (key === 'goal') this.audio.goal();
      this.fxFlashA = 0.5; this.fxFlashCol = [46, 204, 113];
      this.renderer.addShake(6);
      if (key === 'goal' && this.player) this.renderer.punchZoom(this.player.x, this.player.y, 0.5, 0.9);
      this._banner('bSafe', PALETTE.green);
    } else if (key !== 'caught') {
      this.audio.lose();
    }
    this.audio.setTension(0.2);
  }

  _showResult(result) {
    this.state = 'result';
    const t = this.T();
    if (!result.win && result.key === 'caught') this.audio.caught();

    let title, sub, stats;
    if (this.role === 'watcher') {
      const map = {
        watchwin: [t.watchWin, t.watchWinSub], watchlose: [t.watchLose, t.watchLoseSub],
        watchtime: [t.watchTimeUp, t.watchTimeUpSub], watchmarks: [t.watchMarks, t.watchMarksSub],
      };
      [title, sub] = map[result.key] || [t.watchLose, ''];
      const total = this.watch.fakersTotal;
      const acc = (this.stats.correct + this.stats.false) ? Math.round(100 * this.stats.correct / (this.stats.correct + this.stats.false)) : 0;
      stats = [
        { k: t.statCaught, v: `${this.stats.correct}/${total}` },
        { k: t.statAccuracy, v: `${acc}%` },
        { k: t.marks, v: `${this.watch.marks}/${TUNING.watch.marks}` },
        { k: t.statTime, v: fmt(this.survival) },
      ];
    } else {
      const map = {
        goal: [t.win, t.winSub], marks: [t.win, t.winSub],
        timeup: [t.timeUp, t.timeUpSub], caught: [t.lose, t.loseSub],
      };
      [title, sub] = map[result.key] || [t.lose, ''];
      const progress = clamp01((this.spawnY - this.player.y) / (this.spawnY - this.world.goal.y));
      stats = [
        { k: t.statTime, v: fmt(this.survival) },
        { k: t.statProgress, v: Math.round(progress * 100) + '%' },
        { k: t.statActions, v: String(this.stats.actions) },
        { k: t.statSync, v: String(this.stats.syncs) },
      ];
    }
    this.ui.showResult({ win: result.win, title, sub, stats });
    this.announce(title);
    this.ending = null;
  }

  // ---------------- rendering ----------------
  _render() {
    if (this.state === 'menu') return;
    if (this.state === 'result') { if (this.renderer) this._renderScene(); return; }
    this._renderScene();
    if (this.state === 'playing' || this.ending) this._renderHud();
  }

  _renderScene() {
    const t = this.T();
    const scene = {
      chars: this.chars,
      light: { phase: this.lights.phase, timeLeft: this.lights.timeLeft },
      reticle: this.watcher ? this.watcher.reticle : null,
      role: this.role,
      watch: this.watch,
      reveal: this.reveal,
      flash: this.flash,
      time: this.time,
      tells: { facing: t.tellFacing, iso: t.tellIso, pose: t.tellPose, move: t.tellMove, ok: t.tellOk },
      threat: this.role === 'faker' ? this.threat : 0,
      fxFlash: { col: this.fxFlashCol, a: this.fxFlashA },
      banner: this.bannerT > 0 && this.bannerKey ? { text: t[this.bannerKey] || '', color: this.bannerColor, alpha: this.bannerT } : null,
    };
    this.renderer.render(scene);
  }

  _renderHud() {
    const ctx = this.renderer.ctx;
    const c = this.renderer;
    const t = this.T();
    const base = {
      lang: this.settings.lang, hudScale: this.settings.hudScale, time: this.time,
      colorblind: this.settings.colorblind,
      light: { phase: this.lights.phase, timeLeft: this.lights.timeLeft, phaseDuration: this.lights.phaseDuration },
      roundLeft: this.roundLeft, role: this.role,
    };
    let s;
    if (this.role === 'watcher') {
      const alive = this.chars.filter((x) => x.kind === 'faker' && !x.eliminated && !x.goalReached).length;
      const red = this.lights.phase === 'red';
      s = {
        ...base,
        marks: this.watch.marks, maxMarks: TUNING.watch.marks,
        fakersAlive: alive, fakersTotal: this.watch.fakersTotal,
        pinsCount: this.watch.pins.size,
        hint: red ? t.accuseHint : t.observeHint, pinHint: t.pinHint,
      };
    } else {
      const p = this.player;
      s = {
        ...base,
        survival: this.survival,
        marks: this.watcher.marks, maxMarks: TUNING.watcher.marks,
        progress: clamp01((this.spawnY - p.y) / (this.spawnY - this.world.goal.y)),
        tension: p.suspicion,
        penalty: this.lights.phase === 'red' && p.humanness > 0.3,
        syncReady: p.syncCooldown <= 0,
        syncCooldownFrac: p.syncCooldown <= 0 ? 1 : 1 - p.syncCooldown / TUNING.disguise.syncCooldown,
        syncSecondsLeft: p.syncCooldown,
        activeActionId: p.activeAction ? p.activeAction.id : null,
        actionProgress: p.activeAction ? p.activeAction.timer / TUNING.disguise.actionDuration : null,
        actions: ACTIONS.map((a) => ({ ...a, valid: a.ctx === 'any' || !!this.world.nearestZone(p.x, p.y, a.ctx, 84) })),
        missions: this.missions ? this.missions.map((m) => ({ label: this.settings.lang === 'ja' ? m.labelJA : m.labelEN, done: m.done })) : null,
        missionsTitle: t.objectives,
      };
    }
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
    ctx.fillStyle = 'rgba(14,22,33,0.9)'; rr(ctx, x, y, w, 40, 10); ctx.fill();
    ctx.strokeStyle = PALETTE.amber; ctx.lineWidth = 1.5; rr(ctx, x, y, w, 40, 10); ctx.stroke();
    ctx.fillStyle = PALETTE.offwhite; ctx.textAlign = 'center'; ctx.fillText(text, vw / 2, y + 25);
  }

  applySettings() { this.audio.setVolume(this.settings.volume); }
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
