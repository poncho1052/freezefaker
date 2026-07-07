// Green / Red Light cycle with a short warning (dev spec §5).
import { TUNING } from './config.js';

export class LightCycle {
  constructor(rng, onPhase) {
    this.rng = rng;
    this.onPhase = onPhase || (() => {});
    this.phase = 'green';
    this.timeLeft = TUNING.light.firstGreen;
    this.phaseDuration = this.timeLeft;
    this.cycles = 0;
  }

  get tension() {
    if (this.phase === 'red') return 1;
    if (this.phase === 'warning') return 0.6;
    return 0.15;
  }

  update(dt) {
    this.timeLeft -= dt;
    if (this.timeLeft > 0) return;
    const L = TUNING.light;
    if (this.phase === 'green') {
      this._set('warning', L.warning);
    } else if (this.phase === 'warning') {
      this._set('red', this.rng.range(L.redMin, L.redMax));
    } else { // red -> green
      this.cycles++;
      this._set('green', this.rng.range(L.greenMin, L.greenMax));
    }
  }

  _set(phase, dur) {
    const prev = this.phase;
    this.phase = phase;
    this.timeLeft = dur;
    this.phaseDuration = dur;
    this.onPhase(phase, prev);
  }
}
