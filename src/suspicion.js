// Suspicion scoring for the player Faker (dev spec §8). Internal signal that
// feeds the Watcher AI and the subtle tension meter — never shown as a number.
import { TUNING } from './config.js';

export function updatePlayerSuspicion(player, dt, ctx) {
  const S = TUNING.suspicion;
  const { light, crowd } = ctx;
  let delta = 0;

  const moving = player.speed > 6;
  const nearest = nearestNpcDist(player, crowd);
  const isolated = nearest > S.isolationRadius;

  if (light.phase === 'red') {
    if (moving) {
      delta += S.moveOnRed * dt;           // the cardinal sin
    } else {
      // Freezing still. Better if you're not stranded alone in the open.
      const bonus = isolated ? 0.35 : 1;
      delta -= S.goodFreeze * dt * bonus;
    }
    // Spinning to look around during the freeze reads as human.
    const churn = Math.abs(angleDelta(player.facing, player.lastFacing)) / Math.max(dt, 0.0001);
    if (churn > 2.2 && !player._syncedThisFrame) delta += S.facingChurn * dt;
  } else {
    // Green / warning
    if (player._jogging) delta += S.jog * dt;
    else delta -= S.decayGreen * dt;
    if (isolated) delta += S.isolation * dt;
  }

  // One-shot impulses set by the game loop this frame.
  if (player._sharpTurn) delta += S.sharpTurn;
  if (player._collided) delta += S.npcCollision;
  if (player._actionResult === 'valid') delta += S.validAction;
  if (player._actionResult === 'invalid') delta += S.wrongContextAction;
  if (player._syncedThisFrame) delta += S.syncBonus;

  player.suspicion = clamp(player.suspicion + delta, 0, S.max);

  // Clear one-shots.
  player._sharpTurn = false;
  player._collided = false;
  player._actionResult = null;
  player._syncedThisFrame = false;
}

function nearestNpcDist(p, crowd) {
  let best = Infinity;
  for (const c of crowd) {
    if (c === p || c.kind !== 'npc' || c.eliminated) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < best) best = d;
  }
  return best;
}

function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
