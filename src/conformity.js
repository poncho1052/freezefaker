// Freeze-conformity: the core of Freeze Faker. During Red Light a Faker is
// judged not by "did they move" but by how far their frozen facing, pose and
// spacing drift from the local NPC crowd baseline (PRODUCT_SPEC §8).
import { TUNING } from './config.js';

const SPECIAL_POSE = new Set(['shop', 'vending', 'sit', 'sign']);

// The dominant facing / pose / density of the NPC crowd around a point.
export function crowdBaseline(x, y, crowd) {
  const R = TUNING.conform.neighborRadius, R2 = R * R;
  let sx = 0, sy = 0, n = 0;
  const poseCount = {};
  for (const c of crowd) {
    if (c.kind !== 'npc' || c.eliminated) continue;
    const dx = c.x - x, dy = c.y - y;
    if (dx * dx + dy * dy > R2) continue;
    sx += Math.cos(c.facing); sy += Math.sin(c.facing); n++;
    poseCount[c.pose] = (poseCount[c.pose] || 0) + 1;
  }
  if (n === 0) return { facing: null, pose: 'stand', count: 0 };
  let pose = 'stand', best = -1;
  for (const p in poseCount) if (poseCount[p] > best) { best = poseCount[p]; pose = p; }
  return { facing: Math.atan2(sy, sx), pose, count: n };
}

// How human a frozen Faker looks vs the baseline. Returns {humanness 0..1, tag}.
// tag ∈ 'ok' | 'move' | 'facing' | 'pose' | 'iso'
export function evaluateFreeze(faker, baseline) {
  if (faker.speed > 6) return { humanness: 1, tag: 'move', facingDev: 0 };

  const tol = (TUNING.conform.facingTolDeg * Math.PI) / 180;
  let facingDev = 0;
  if (baseline.facing != null) {
    const d = Math.abs(angDelta(faker.facing, baseline.facing));
    facingDev = d <= tol ? 0 : (d - tol) / (Math.PI - tol);
  }
  const poseDev = (SPECIAL_POSE.has(baseline.pose) && faker.pose !== baseline.pose) ? 1 : 0;
  const iso = baseline.count === 0 ? 1 : baseline.count === 1 ? 0.55 : 0;

  const humanness = clamp01(0.62 * facingDev + 0.34 * poseDev + 0.34 * iso);

  // Pick the single most-telling factor for the on-screen hint.
  let tag = 'ok', m = 0;
  const f = 0.62 * facingDev, p = 0.34 * poseDev, i = 0.34 * iso;
  if (f > m) { m = f; tag = 'facing'; }
  if (p > m) { m = p; tag = 'pose'; }
  if (i > m) { m = i; tag = 'iso'; }
  return { humanness, tag: humanness < 0.22 ? 'ok' : tag, facingDev };
}

export function angDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
