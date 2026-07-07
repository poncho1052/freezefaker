// Game orchestration: modes (Classic / Blend Task / Watcher), state machine,
// main loop, and glue between world, crowd, systems, HUD and UI.
import { TUNING, ACTIONS, MISSIONS, PALETTE, I18N, DIFFICULTY, TWISTS } from './config.js';
import { cluesFor, clueText } from './intel.js';
import { makeRng } from './rng.js';
import { createWorld } from './world.js';
import { createRenderer } from './renderer3d.js';
import { Hud } from './hud.js';
import {
  makeNpc, makeFaker, updateNpc, updateFakerAI, integrate, separate, scheduleResume,
} from './characters.js';
import { LightCycle } from './lights.js';
import { updatePlayerSuspicion } from './suspicion.js';
import { crowdBaseline, evaluateFreeze } from './conformity.js';
import { WatcherAI } from './watcher.js';
import { loadBest, saveBest } from './store.js';

const ACTION_POSE = { phone: 'phone', shop: 'shop', vending: 'vending', sit: 'sit', sign: 'sign', look: 'look' };

export class Game {
  constructor({ canvas, overlay, input, audio, ui, settings, live }) {
    this.canvas = canvas;
    this.overlay = overlay;
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
    // Touch routing: taps that land on HUD buttons never become world input.
    this.input.hitTest = (x, y) => {
      const h = this.state === 'online' && this.online ? this.online.hud : this.hud;
      return !!(h && h.hit && h.hit(x, y));
    };
    requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__ff = this;
  }

  announce(msg) { if (this.live) this.live.textContent = msg; }
  T() { return I18N[this.settings.lang] || I18N.en; }

  // ---------------- lifecycle ----------------
  // A session is a MATCH: best-of rounds, so every catch/escape moves a score.
  start(opts = {}) {
    const mode = opts.mode || 'classic';
    const tutorial = !!opts.tutorial;
    this.audio.resume();
    this.mode = tutorial ? 'classic' : mode;
    this.tutorial = tutorial;
    this.role = this.mode === 'watch' ? 'watcher' : 'faker';
    this.matchTarget = tutorial ? 1 : (opts.matchTarget || TUNING.match.winsNeeded);
    this.wins = { fakers: 0, watcher: 0 };
    this.roundNum = 0;
    this.score = 0;
    this._newRound();
  }

  _newRound() {
    this.roundNum++;
    const rng = makeRng();
    this.rng = rng;
    const tutorial = this.tutorial;
    this.world = createWorld();
    if (!this.renderer) this.renderer = createRenderer(this.canvas, this.overlay, this.world);

    this.diff = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
    // Round twist from round 2 on, so repeats stay fresh.
    this.twist = (!tutorial && this.roundNum >= 2) ? rng.pick(TWISTS) : null;

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

    const npcCount = (tutorial ? 34 : 48) + (this.twist?.npcExtra || 0);
    for (let i = 0; i < npcCount; i++) {
      const wp = rng.pick(this.world.waypoints);
      this.chars.push(makeNpc(rng, this.world, { x: wp.x + rng.range(-40, 40), y: wp.y + rng.range(-40, 40) }));
    }

    this.lights = new LightCycle(rng, (phase, prev) => this._onPhase(phase, prev), { redBonus: this.twist?.redBonus || 0 });

    const aggro = this.diff.aggro * (this.twist?.aggro || 1);
    if (this.role === 'faker') {
      this.watcher = new WatcherAI(rng, { aggro: tutorial ? 0.7 : aggro, marksBonus: this.diff.marksBonus });
      this.watch = null;
    } else {
      this.watcher = null;
      this.watch = { marks: TUNING.watch.marks + this.diff.marksBonus, reticle: { x: this.world.w / 2, y: this.world.h / 2 }, hover: null, pins: new Set(), fakersTotal: fakerCount };
    }

    // Progressive outfit intel: about YOU in Faker modes, about the current
    // WANTED faker in Watcher mode. One clue is known from the start.
    this.intel = { level: 1, t: this.diff.intelInterval, target: null };
    if (this.role === 'watcher') this._pickWanted();
    else { this.intel.target = this.player; this.watcher.intelBias = TUNING.intel.aiBias; }

    // Missions (Blend Task).
    if (this.mode === 'mission') {
      const pool = MISSIONS.slice(); shuffle(pool, rng);
      this.missions = pool.slice(0, 3).map((m) => ({ ...m, done: false }));
    } else this.missions = null;

    this.roundLeft = this.twist?.roundSec || TUNING.round.seconds;
    this.survival = 0;
    this.spawnY = this.player ? this.player.y : this.world.h - 90;
    if (this.roundNum === 1) this.stats = { actions: 0, syncs: 0, correct: 0, false: 0 };
    this.tipStage = 0; this.tip = null;
    this.endTimer = 0; this.ending = null; this.reveal = false; this.flash = 0;
    this.interlude = null;
    this.followTarget = null;          // spectate camera target after a catch
    this.popups = [];                  // floating score popups
    this._redPeakHuman = 0;            // for PERFECT FREEZE detection
    this._hadThreat = false;           // for CLOSE CALL detection

    this.state = 'playing';
    this.ui.hideAll();
    this.announce(this.T().greenSub);
    // First round: a short camera flyover from the gate back to you, so the
    // objective is physically obvious. Later rounds announce their twist.
    this.intro = (this.role === 'faker' && this.roundNum === 1) ? 2.3 : 0;
    if (this.intro > 0 && this.renderer.jumpTo) this.renderer.jumpTo(this.world.goal.x, this.world.goal.y + 60);
    this.bannerText = null;
    if (this.twist) this._bannerLit(this.settings.lang === 'ja' ? this.twist.labelJA : this.twist.labelEN, PALETTE.amber, 3.0);
    else if (this.role === 'faker') this._banner(this.mode === 'mission' ? 'bMission' : 'bGoal', PALETTE.green, 3.2);
  }

  _pickWanted() {
    const alive = this.chars.filter((c) => c.kind === 'faker' && !c.eliminated && !c.goalReached);
    this.intel.target = alive.length ? this.rng.pick(alive) : null;
  }

  // Outfit intel reveals over time (difficulty sets the pace).
  _tickIntel(dt) {
    const I = this.intel;
    if (this.role === 'watcher') {
      if (!I.target || I.target.eliminated || I.target.goalReached) this._pickWanted();
    }
    if (!I.target || I.level >= TUNING.intel.maxClues) return;
    I.t -= dt;
    if (I.t > 0) return;
    I.level++;
    I.t = this.diff.intelInterval;
    const t = this.T();
    if (this.role === 'faker') {
      this.watcher.intelBias = I.level * TUNING.intel.aiBias;
      const clue = cluesFor(this.player.appearance)[I.level - 1];
      this.popups.push({ text: `${t.exposed}: ${clueText(clue, t, this.settings.lang)}`, color: PALETTE.amber, t: 2.0, max: 2.0 });
      this.audio.redWarning();
      if (I.level >= TUNING.intel.maxClues) this._bannerLit(t.fullyExposed, PALETTE.red, 2.2);
    } else {
      this.audio.uiSelect();
    }
  }

  _bannerLit(text, color, t = 1.1) { this.bannerKey = '__lit'; this.bannerText = text; this.bannerColor = color; this.bannerT = t; this._bannerMax = t; }

  // Score popup + points, shown the moment something good/bad happens.
  addScore(pts, labelKey, color) {
    this.score = Math.max(0, this.score + pts);
    const t = this.T();
    this.popups.push({ text: `${t[labelKey] || labelKey}  ${pts >= 0 ? '+' : ''}${pts}`, color: color || (pts >= 0 ? PALETTE.green : PALETTE.red), t: 1.6, max: 1.6 });
    if (this.popups.length > 4) this.popups.shift();
    if (pts > 0) this.audio.scorePop();
  }

  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.ui.show('pause'); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.ui.hideAll(); this.last = performance.now(); }
  quitToTitle() { this.state = 'menu'; this.ui.show('title'); }

  _onPhase(phase, prev) {
    if (phase === 'warning') this.audio.redWarning();
    else if (phase === 'red') {
      this.audio.redStart(); this.audio.freezeSnap(); this.flash = 1; this.renderer.addShake(5);
      this._redPeakHuman = 0;
      this.announce(this.T().redSub);
    } else if (phase === 'green') {
      this.audio.greenStart();
      this.announce(this.T().greenSub);
      // survived a whole Red Light reading as pure NPC → PERFECT FREEZE
      if (prev === 'red' && this.role === 'faker' && this.player && !this.player.eliminated && !this.ending && this._redPeakHuman < 0.25) {
        this.addScore(TUNING.score.perfectFreeze, 'pPerfect');
      }
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

    if (this.role === 'faker' && this.watcher && !this.ending && !this.interlude) {
      const w = this.watcher;
      const onMe = w.target === this.player && w.reticle.visible && !this.player.eliminated;
      const goal = onMe ? Math.min(1, w.reticle.lock) : 0;
      const prev = this.threat;
      this.threat += (goal - prev) * Math.min(1, raw * 7);
      if (onMe && w.reticle.lock > 0.14 && !this._alerted) {
        this._alerted = true; this.audio.alertSting(); this._banner('bSpotted', PALETTE.red); this.renderer.addShake(7);
      }
      if (!onMe || w.reticle.lock < 0.05) {
        if (this._alerted && prev > 0.4) {
          this.audio.relief(); this._banner('bClose', PALETTE.green);
          this.addScore(TUNING.score.closeCall, 'pClose');
        }
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

  _banner(key, color, t = 1.1) { this.bannerKey = key; this.bannerColor = color; this.bannerT = t; this._bannerMax = t; }

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

    for (const p of this.popups) p.t -= raw;
    this.popups = this.popups.filter((p) => p.t > 0);

    // Between-round interlude: crowd keeps living, scoreboard shows.
    if (this.interlude) {
      this.interlude.t -= raw;
      this._stepCrowd(dt, ctx);
      if (this.interlude.t <= 0) { this.interlude = null; this._newRound(); }
      return;
    }

    if (this.ending) {
      this.endTimer -= raw;
      this._stepCrowd(dt, ctx);
      this._scoreConformity(dt);
      if (this.endTimer <= 0) this._roundOver(this.ending);
      return;
    }

    // Round-1 intro: the camera glides from the gate back to you.
    if (this.intro > 0) {
      this.intro -= raw;
      this._stepCrowd(dt, ctx);
      const u = 1 - Math.max(0, this.intro) / 2.3;
      const e = u * u * (3 - 2 * u); // smoothstep
      const g = this.world.goal, p = this.player;
      this.renderer.updateCamera({ x: g.x + (p.x - g.x) * e, y: g.y + 60 + (p.y - g.y - 60) * e }, dt, 1240, 820);
      return;
    }

    this._tickIntel(dt);
    this.lights.update(dt);
    this.roundLeft -= dt;
    if (!this.player || !this.player.eliminated) this.survival += dt;

    if (this.role === 'faker') this._playerControl(dt);
    this._stepCrowd(dt, ctx);
    this._scoreConformity(dt);

    if (this.role === 'faker') {
      if (!this.player.eliminated) {
        updatePlayerSuspicion(this.player, dt, { light: this.lights, world: this.world, crowd: this.chars, humanness: this.player.humanness });
      }
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

    // ---- round end conditions (team framing: you + the AI fakers) ----
    if (this.role === 'faker') {
      // AI teammates who slip through the gate keep the round alive for the team.
      for (const c of this.chars) {
        if (c.kind !== 'faker' || !c.goalReached || c._counted) continue;
        c._counted = true;
        this.addScore(TUNING.score.mateEscape, 'pMate', PALETTE.green);
      }
      if (this.player.goalReached) {
        this.addScore(TUNING.score.goal, 'pGoal');
        return this._beginEnd('fakers', 'goal');
      }
      const team = [this.player, ...this.chars.filter((c) => c.kind === 'faker')];
      const active = team.filter((c) => !c.eliminated && !c.goalReached);
      const escaped = team.some((c) => c.goalReached);
      if (active.length === 0) return this._beginEnd(escaped ? 'fakers' : 'watcher', escaped ? 'teamgoal' : 'allcaught');
      if (this.player.eliminated && escaped) return this._beginEnd('fakers', 'teamgoal');
      if (this.roundLeft <= 0) {
        if (!this.player.eliminated) this.addScore(TUNING.score.timeSurvive, 'pSurvive');
        return this._beginEnd(active.length > 0 || escaped ? 'fakers' : 'watcher', 'timeup');
      }
      if (this.watcher.marks <= 0) return this._beginEnd('fakers', 'marks');
    } else {
      const fakers = this.chars.filter((c) => c.kind === 'faker');
      if (fakers.some((c) => c.goalReached)) return this._beginEnd('fakers', 'watchlose');
      if (fakers.length && fakers.every((c) => c.eliminated)) {
        this.addScore(TUNING.score.watcherRound, 'bRoundWin');
        return this._beginEnd('watcher', 'watchwin');
      }
      if (this.roundLeft <= 0) return this._beginEnd('fakers', 'watchtime');
      if (this.watch.marks <= 0) return this._beginEnd('fakers', 'watchmarks');
    }

    // camera: follow your char, or a surviving teammate when you're caught
    let focus = this.player;
    if (this.role === 'faker' && this.player.eliminated) {
      if (!this.followTarget || this.followTarget.eliminated || this.followTarget.goalReached) {
        this.followTarget = this.chars.find((c) => c.kind === 'faker' && !c.eliminated && !c.goalReached) || this.player;
      }
      focus = this.followTarget;
    }
    const view = this.role === 'watcher'
      ? { f: { x: this.world.w / 2, y: this.world.h / 2 + 30 }, w: TUNING.watch.viewW, h: TUNING.watch.viewH }
      : { f: focus, w: 1240, h: 820 };
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
      if (c.kind === 'player') this._redPeakHuman = Math.max(this._redPeakHuman, ev.humanness);
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

    // Touch taps on HUD buttons (actions / sync / pause).
    if (inp.clicked) {
      const h = this.hud.hit(inp.pointer.x, inp.pointer.y);
      if (h) {
        if (h.type === 'action') this._perform(h.id);
        else if (h.type === 'sync') this._sync();
        else if (h.type === 'pause') { this.pause(); return; }
      }
    }

    const ax = inp.axis();
    const jogging = inp.jogging() && ax.mag > 0;
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

    // Your pose is frozen while the light is red — the action holds as long
    // as the freeze does (this is what lets you HOLD a Blend Task pose).
    if (p.activeAction) {
      if (!onRed) p.activeAction.timer -= dt;
      p.pose = p.activeAction.pose;
      if (p.activeAction.timer <= 0) p.activeAction = null;
    }

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
    if (inp.clicked) {
      const h = this.hud.hit(inp.pointer.x, inp.pointer.y);
      if (h && h.type === 'pause') { this.pause(); return; }
    }
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
    if (correct) {
      this.stats.correct++;
      const wanted = this.intel.target === target;
      this.addScore(TUNING.score.watcherCatch + (wanted ? 100 : 0), wanted ? 'pWanted' : 'pCatch');
    }
    else { this.stats.false++; this.watch.marks--; this.audio.falseAccuse(); this.addScore(TUNING.score.watcherMiss, 'pMiss'); }
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
            if (c.kind === 'player') {
              // Caught is not the end: your team plays on, you spectate.
              this.audio.caught();
              this._banner('bTeamOn', PALETTE.amber, 2.2);
              this.announce(this.T().spectating);
            }
          }
        }
      }
    }
  }

  _missionsDone() { return this.missions ? this.missions.every((m) => m.done) : true; }

  // Blend Tasks are held THROUGH Red Light: be in the zone, in the pose, while
  // frozen. Progress accrues only on red — the risk is committing to a spot.
  _checkMissions(dt) {
    const p = this.player;
    if (p.eliminated) return;
    const hold = TUNING.mission.holdSeconds;
    for (const m of this.missions) {
      if (m.done) continue;
      m.progress = m.progress || 0;
      if (this.lights.phase !== 'red') continue;
      const inZone = !!this.world.nearestZone(p.x, p.y, m.ctx, 76);
      const poseOk = !m.pose || p.pose === m.pose;
      if (inZone && poseOk && p.speed < 6) {
        m.progress = Math.min(hold, m.progress + dt);
        if (m.progress >= hold) {
          m.done = true;
          this.audio.missionDone();
          this.addScore(TUNING.score.mission, 'pMission');
          // completing a task steadies your nerves and resets your Sync
          p.suspicion = Math.max(0, p.suspicion - 30);
          p.syncCooldown = 0;
          if (this._missionsDone()) this._banner('bGoal', PALETTE.green, 2.6);
        }
      }
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

  // winner: 'fakers' | 'watcher' — my side wins if it matches my team.
  _beginEnd(winner, key) {
    if (this.ending) return;
    const mySide = this.role === 'watcher' ? 'watcher' : 'fakers';
    const win = winner === mySide;
    this.ending = { win, winner, key };
    this.reveal = true;
    this.endTimer = 1.6;
    this.threat = 0; this._alerted = false;
    if (win) {
      if (key === 'goal') { this.audio.goal(); this.renderer.punchZoom(this.player.x, this.player.y, 0.5, 0.9); }
      this.fxFlashA = 0.5; this.fxFlashCol = [46, 204, 113];
      this.renderer.addShake(6);
    }
    this.audio.setTension(0.2);
  }

  // Round settled: move the match score, then interlude or final result.
  _roundOver(result) {
    this.wins[result.winner]++;
    const matchOver = this.wins[result.winner] >= this.matchTarget;
    this.ending = null;
    this.reveal = false;
    if (matchOver) return this._showResult(result);

    if (result.win) { this.audio.roundWin(); this._banner('bRoundWin', PALETTE.green, 2.4); }
    else { this.audio.roundLose(); this._banner('bRoundLose', PALETTE.red, 2.4); }
    const mySide = this.role === 'watcher' ? 'watcher' : 'fakers';
    if (this.wins[mySide] === this.matchTarget - 1 || this.wins[mySide === 'watcher' ? 'fakers' : 'watcher'] === this.matchTarget - 1) {
      setTimeout(() => { if (this.interlude) this._banner('bMatchPoint', PALETTE.amber, 1.4); }, 1300);
    }
    this.interlude = { t: TUNING.match.interlude, win: result.win, key: result.key };
    this.announce(result.win ? this.T().bRoundWin : this.T().bRoundLose);
  }

  _showResult(result) {
    this.state = 'result';
    const t = this.T();
    if (result.win) this.audio.win(); else this.audio.lose();

    // rank + personal best
    const S = TUNING.score;
    const rank = this.score >= S.rankS ? 'S' : this.score >= S.rankA ? 'A' : this.score >= S.rankB ? 'B' : 'C';
    const best = loadBest();
    const prev = best[this.mode] || 0;
    const isRecord = this.score > prev;
    if (isRecord) { best[this.mode] = this.score; saveBest(best); }

    let title, sub, stats;
    const scoreRows = [
      { k: t.scoreWord, v: String(this.score) + (isRecord ? ' ★' : '') },
      { k: t.rankWord, v: rank },
    ];
    if (this.role === 'watcher') {
      title = result.win ? t.matchWin : t.matchLose;
      const map = {
        watchwin: t.watchWinSub, watchlose: t.watchLoseSub,
        watchtime: t.watchTimeUpSub, watchmarks: t.watchMarksSub,
      };
      sub = `${this.wins.watcher} - ${this.wins.fakers} · ` + (map[result.key] || '');
      const acc = (this.stats.correct + this.stats.false) ? Math.round(100 * this.stats.correct / (this.stats.correct + this.stats.false)) : 0;
      stats = [
        ...scoreRows,
        { k: t.statCaught, v: String(this.stats.correct) },
        { k: t.statAccuracy, v: `${acc}%` },
      ];
    } else {
      const map = {
        goal: t.winSub, teamgoal: t.pMate, marks: t.winSub,
        timeup: t.pSurvive, allcaught: t.loseSub,
      };
      title = result.win ? t.matchWin : t.matchLose;
      sub = `${this.wins.fakers} - ${this.wins.watcher} · ` + (map[result.key] || '');
      stats = [
        ...scoreRows,
        { k: t.statTime, v: fmt(this.survival) },
        { k: t.statSync, v: String(this.stats.syncs) },
      ];
    }
    this.ui.showResult({ win: result.win, title, sub: (isRecord ? t.newRecord + '  ·  ' : '') + sub, stats });
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
      banner: this.bannerT > 0 && this.bannerKey ? { text: this.bannerKey === '__lit' ? (this.bannerText || '') : (t[this.bannerKey] || ''), color: this.bannerColor, alpha: Math.min(1, this.bannerT) } : null,
      goalMarker: this._goalMarker(t),
    };
    this.renderer.render(scene);
  }

  // Floating GOAL marker (with live distance) for Faker modes; hidden while
  // Blend Task objectives are unfinished so the checklist stays the focus.
  _goalMarker(t) {
    if (this.role !== 'faker' || !this.player || this.player.eliminated || this.ending) return null;
    if (this.missions && !this._missionsDone()) return null;
    const g = this.world.goal;
    const meters = Math.max(0, Math.round(Math.hypot(g.x - this.player.x, g.y - this.player.y) / 16));
    return { x: g.x, y: g.y, label: `▲ ${t.goalWord} ${meters}m` };
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
      // match & score layer
      score: this.score,
      wins: this.wins, matchTarget: this.matchTarget, roundNum: this.roundNum,
      popups: this.popups,
      spectating: this.role === 'faker' && this.player && this.player.eliminated && !this.ending && !this.interlude ? t.spectating : null,
      interlude: this.interlude ? {
        frac: this.interlude.t / TUNING.match.interlude, win: this.interlude.win,
        title: this.interlude.win ? t.bRoundWin : t.bRoundLose,
        score: `${t.teamFakers} ${this.wins.fakers}  -  ${this.wins.watcher} ${t.teamWatcher}`,
        next: `${t.roundWord} ${this.roundNum + 1}`,
      } : null,
      teamFakers: t.teamFakers, teamWatcher: t.teamWatcher, scoreWord: t.scoreWord,
      joy: this.input.joy, canPause: this.input.hasTouch,
      intel: this.intel.target ? {
        level: this.intel.level, max: TUNING.intel.maxClues,
        frac: this.intel.level >= TUNING.intel.maxClues ? 1 : 1 - this.intel.t / this.diff.intelInterval,
        clues: cluesFor(this.intel.target.appearance),
        appearance: this.intel.target.appearance,
      } : null,
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
        missions: this.missions ? this.missions.map((m) => ({
          label: this.settings.lang === 'ja' ? m.labelJA : m.labelEN, done: m.done,
          frac: m.done ? 1 : (m.progress || 0) / TUNING.mission.holdSeconds,
        })) : null,
        missionsTitle: t.objectives, missionsHint: t.holdOnRed,
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
