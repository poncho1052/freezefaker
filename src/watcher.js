// AI Watcher: during Red Light a focus reticle hunts the crowd, dwells on the
// most human-looking character, and accuses. Marks are consumed by false
// accusations (dev spec §9).
import { TUNING } from './config.js';

export class WatcherAI {
  constructor(rng, opts = {}) {
    this.rng = rng;
    this.marks = TUNING.watcher.marks + (opts.marksBonus || 0);
    this.aggro = opts.aggro || 1;    // difficulty / twist multiplier
    this.intelBias = 0;              // grows as outfit intel about the PLAYER reveals
    this.reticle = { x: TUNING.world.w / 2, y: 480, visible: false, lock: 0, size: 24, pulse: 0 };
    this.target = null;
    this.cooldown = 0;
    this._noise = new Map(); // stable per-character perception noise
    this.correct = 0;
    this.false = 0;
  }

  // Perceived "human-likeness" for a character.
  _score(c) {
    const W = TUNING.watcher;
    let base;
    if (c.kind === 'npc') base = 6 + hashNoise(c.id) * 12;      // NPCs read low
    else base = c.suspicion;                                     // fakers: real suspicion
    // The more of your outfit is known, the more you stand out to the AI.
    if (c.kind === 'player') base += this.intelBias;
    let n = this._noise.get(c.id);
    if (n === undefined) { n = (this.rng.next() * 2 - 1) * W.perceptionNoise; this._noise.set(c.id, n); }
    // Recently-moved fakers stand out extra.
    if (c.mistake > 0) base += 22;
    return base + n;
  }

  update(dt, ctx) {
    const { light, chars, onAccuse } = ctx;
    const W = TUNING.watcher;
    this.reticle.pulse += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (light.phase !== 'red') {
      // Roam idly off to the side; not accusing on green.
      this.reticle.visible = false;
      this.reticle.lock = 0;
      this.target = null;
      // fresh noise each red phase so it isn't perfectly repeatable
      if (light.phase === 'green') this._noise.clear();
      return;
    }

    this.reticle.visible = true;

    // Pick / refresh target: the most suspicious living character.
    if (!this.target || this.target.eliminated || this.target.goalReached || this.cooldown === 0 && this.rng.chance(0.02)) {
      this._pickTarget(chars);
    }
    if (!this.target) { this._sweep(dt); return; }

    // Move reticle toward the target's head area.
    const tx = this.target.x, ty = this.target.y - 26;
    const dx = tx - this.reticle.x, dy = ty - this.reticle.y;
    const d = Math.hypot(dx, dy);
    const step = W.reticleSpeed * this.aggro * dt;
    if (d > step) {
      this.reticle.x += (dx / d) * step;
      this.reticle.y += (dy / d) * step;
      this.reticle.lock = Math.max(0, this.reticle.lock - dt); // lose lock while travelling
    } else {
      this.reticle.x = tx; this.reticle.y = ty;
      // Dwell to build a lock, but only if still reads suspicious enough.
      const score = this._score(this.target);
      if (score >= W.accuseThreshold && this.cooldown === 0) {
        this.reticle.lock += (dt * this.aggro) / W.lockTime;
        if (ctx.audio && !this._lockBeeped && this.reticle.lock > 0.35) { ctx.audio.reticleLock(); this._lockBeeped = true; }
        if (this.reticle.lock >= 1) {
          this._commit(onAccuse, ctx);
        }
      } else {
        this.reticle.lock = Math.max(0, this.reticle.lock - dt * 1.5);
        this._lockBeeped = false;
        // target calmed down — look for someone else
        if (this.rng.chance(0.6)) this._pickTarget(chars);
      }
    }
  }

  _pickTarget(chars) {
    let best = null, bs = -Infinity;
    for (const c of chars) {
      if (c.eliminated || c.goalReached || c.accused > 0) continue;
      const s = this._score(c);
      if (s > bs) { bs = s; best = c; }
    }
    // Only commit attention if someone actually looks off; else sweep.
    this.target = bs >= TUNING.watcher.accuseThreshold - 16 ? best : null;
    this.reticle.lock = 0;
    this._lockBeeped = false;
  }

  _sweep(dt) {
    // Idle patrol drift so the reticle always feels alive/watching.
    const t = this.reticle.pulse;
    this.reticle.x += Math.cos(t * 0.8) * 60 * dt;
    this.reticle.y += Math.sin(t * 0.5) * 30 * dt;
    this.reticle.lock = 0;
  }

  _commit(onAccuse, ctx) {
    const t = this.target;
    const correct = t.kind === 'player' || t.kind === 'faker';
    if (ctx.audio) ctx.audio.accuse();
    if (correct) this.correct++; else { this.false++; this.marks = Math.max(0, this.marks - 1); }
    onAccuse(t, correct);
    this.reticle.lock = 0;
    this.target = null;
    this.cooldown = 1.1;             // brief pause before the next lock
    this._lockBeeped = false;
  }
}

// Deterministic per-id pseudo-noise so an NPC's baseline is stable within a life.
function hashNoise(id) {
  let x = Math.sin(id * 127.1) * 43758.5453;
  return x - Math.floor(x);
}
