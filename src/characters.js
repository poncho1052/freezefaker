// Characters: NPCs and Fakers share one base system (dev spec §16.1).
// Behaviour/state lives here; drawing lives in renderer.js.
import { CLOTHING, SKIN, HAIR, TUNING } from './config.js';

const ARCHETYPES = ['commuter', 'student', 'shopper', 'local', 'staff', 'tourist'];

export function makeAppearance(rng, archetype = null) {
  const arch = archetype || rng.pick(ARCHETYPES);
  const a = {
    arch,
    clothing: rng.pick(CLOTHING),
    pants: rng.pick(['#2a2f38', '#3a3f47', '#4a4033', '#556', '#40372e']),
    skin: rng.pick(SKIN),
    hair: rng.pick(HAIR),
    hat: rng.chance(0.32) ? rng.pick(['#2b3550', '#6e5844', '#4a4f57', '#556b6e', '#c9bc9c']) : null,
    bag: rng.chance(0.5) ? rng.pick(['#3a2f28', '#4a4f57', '#556b6e', '#6b6b3a']) : null,
    glasses: rng.chance(0.28),
    scale: rng.range(0.94, 1.06),
    hairStyle: rng.int(0, 3),
  };
  // Staff wear a lighter apron accent.
  if (arch === 'staff') a.clothing = rng.pick(['#5a7355', '#357', '#8a8f95']);
  return a;
}

let _id = 1;
function baseChar(x, y, kind, appearance) {
  return {
    id: _id++,
    kind,                         // 'npc' | 'faker' | 'player'
    x, y, vx: 0, vy: 0,
    facing: -Math.PI / 2,         // face "up" toward the gate initially
    targetFacing: -Math.PI / 2,
    speed: 0,
    appearance,
    radius: TUNING.npc.radius,
    state: 'idle',                // walking | idle | action | frozen | resume
    pose: 'stand',                // renderer key
    poseSeed: Math.random(),
    target: null,
    idleTimer: 0,
    resumeTimer: 0,
    actionTimer: 0,
    bob: Math.random() * Math.PI * 2,
    // faker-only:
    suspicion: 0,
    goalReached: false,
    eliminated: false,
    accused: 0,                   // >0 while the accusation reveal plays
    syncCooldown: 0,
    lastFacing: -Math.PI / 2,
    mistake: 0,
  };
}

export function makeNpc(rng, world, spawn) {
  const c = baseChar(spawn.x, spawn.y, 'npc', makeAppearance(rng));
  c.radius = TUNING.npc.radius * c.appearance.scale;
  c.walkSpeed = rng.range(TUNING.npc.walkMin, TUNING.npc.walkMax);
  c.state = 'walking';
  c.target = rng.pick(world.waypoints);
  c.idlePose = 'stand';
  return c;
}

export function makeFaker(rng, world, spawn, isPlayer) {
  const c = baseChar(spawn.x, spawn.y, isPlayer ? 'player' : 'faker', makeAppearance(rng));
  c.radius = TUNING.faker.radius * c.appearance.scale;
  c.walkSpeed = TUNING.faker.walk;
  c.state = 'idle';
  c.pose = 'stand';
  if (!isPlayer) {
    c.aiWander = rng.range(0, Math.PI * 2);
    c.aiSkill = rng.range(0.45, 0.9);   // higher = fewer mistakes
    c.aiActionTimer = rng.range(2, 6);
  }
  return c;
}

// ---------------- NPC update ----------------
export function updateNpc(c, dt, ctx) {
  const { world, light, rng } = ctx;

  if (light.phase === 'red') {
    enterFrozen(c, world, rng);
    return;
  }
  if (light.phase === 'warning') {
    // Slight slowdown as everyone anticipates the freeze.
    c.speed *= 0.9;
  }

  // Resume stagger after red -> green.
  if (c.state === 'resume') {
    c.resumeTimer -= dt;
    if (c.resumeTimer > 0) { c.speed = 0; return; }
    c.state = c.prevState || 'walking';
  }

  if (c.state === 'idle') {
    c.speed = 0;
    c.idleTimer -= dt;
    if (c.idleTimer <= 0) {
      c.state = 'walking';
      c.target = pickTarget(c, world, rng);
    }
    return;
  }

  // walking
  const t = c.target || (c.target = pickTarget(c, world, rng));
  const dx = t.x - c.x, dy = t.y - c.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) {
    // Arrived: adopt a context-appropriate idle pose and wait.
    c.state = 'idle';
    c.idleTimer = rng.range(TUNING.npc.idleMin, TUNING.npc.idleMax);
    c.idlePose = poseForZone(t.zone) || rng.pick(['stand', 'phone', 'look', 'stand']);
    c.pose = c.idlePose;
    if (t.zone === 'bench') c.pose = 'sit';
    return;
  }
  const nx = dx / dist, ny = dy / dist;
  c.targetFacing = Math.atan2(ny, nx);
  c.speed = c.walkSpeed;
  c.vx = nx * c.speed; c.vy = ny * c.speed;
  c.pose = 'walk';
}

function pickTarget(c, world, rng) {
  // Prefer a nearby waypoint so movement looks local, not teleport-y.
  let best = null, bd = Infinity;
  for (let i = 0; i < 5; i++) {
    const wp = rng.pick(world.waypoints);
    const d = Math.hypot(wp.x - c.x, wp.y - c.y) + rng.range(0, 400);
    if (d < bd && d > 60) { bd = d; best = wp; }
  }
  return best || rng.pick(world.waypoints);
}

function poseForZone(zone) {
  switch (zone) {
    case 'vending': return 'vending';
    case 'bench': return 'sit';
    case 'shop': return 'shop';
    case 'sign': return 'sign';
    default: return null;
  }
}

function enterFrozen(c, world, rng) {
  if (c.state === 'frozen') return;
  c.prevState = c.state === 'resume' ? (c.prevState || 'walking') : c.state;
  c.state = 'frozen';
  c.speed = 0; c.vx = 0; c.vy = 0;
  // Choose a natural freeze pose from current context.
  const z = world.zoneAt(c.x, c.y);
  const p = poseForZone(z && z.tag);
  if (p) c.pose = p;
  else if (c.pose === 'walk') c.pose = 'stand';
  // else keep current idle pose (phone/look/stand)

  // Freeze facing: NPCs turn toward the nearest crowd attractor, so a cluster
  // visibly shares one "型" that a Faker must match. r may be omitted for the
  // player (they keep whatever facing they set up).
  if (c.kind === 'npc') {
    const a = world.nearestAttractor(c.x, c.y, TUNING.conform.attractorRange);
    if (a) {
      const jitter = rng ? rng.range(-0.18, 0.18) : 0;
      c.facing = c.targetFacing = Math.atan2(a.y - c.y, a.x - c.x) + jitter;
    } else {
      c.facing = c.targetFacing; // keep heading
    }
  } else if (c.kind === 'faker') {
    // AI Faker imperfectly aligns to the crowd based on skill.
    const a = world.nearestAttractor(c.x, c.y, TUNING.conform.attractorRange);
    if (a && rng) {
      const err = (1 - c.aiSkill) * rng.range(-2.4, 2.4);
      c.facing = c.targetFacing = Math.atan2(a.y - c.y, a.x - c.x) + err;
    } else {
      c.facing = c.targetFacing;
    }
  } else {
    c.facing = c.targetFacing; // player
  }
  c.freezePop = 1; // renderer freeze-snap pop
}

// Called once when red ends: set the staggered resume.
export function scheduleResume(c, rng) {
  if (c.state !== 'frozen') return;
  c.state = 'resume';
  c.resumeTimer = rng.range(0, TUNING.light.resumeStaggerMax);
}

// ---------------- AI Faker update ----------------
export function updateFakerAI(c, dt, ctx) {
  if (c.eliminated || c.goalReached) { c.speed = 0; return; }
  const { world, light, rng } = ctx;
  c.syncCooldown = Math.max(0, c.syncCooldown - dt);

  if (light.phase === 'red') {
    // Stand still and hold the frozen pose. Conformity suspicion (facing /
    // pose / spacing vs the crowd) is scored centrally in the game loop.
    c.speed = 0;
    if (c.state !== 'frozen') enterFrozen(c, world, rng);
    // Low-skill fakers occasionally break the freeze with a visible twitch.
    if (rng.chance((1 - c.aiSkill) * 0.28 * dt)) {
      c.mistake = 0.45;
      c.facing += rng.range(-0.4, 0.4);
    }
    c.mistake = Math.max(0, c.mistake - dt);
    return;
  }

  if (c.state === 'resume') { c.resumeTimer -= dt; if (c.resumeTimer > 0) { c.speed = 0; return; } c.state = 'walking'; }

  // Head for the gate, weaving through the crowd to blend.
  const g = world.goal;
  const dx = g.x - c.x, dy = g.y - c.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 60) { c.goalReached = true; c.speed = 0; return; }

  c.aiWander += rng.range(-1, 1) * dt;
  const baseAng = Math.atan2(dy, dx);
  const ang = baseAng + Math.sin(c.aiWander) * 0.5;
  c.targetFacing = ang;
  c.speed = c.walkSpeed * rng.range(0.85, 1.0);
  c.vx = Math.cos(ang) * c.speed;
  c.vy = Math.sin(ang) * c.speed;
  c.pose = 'walk';

  // Occasionally perform a disguise action or sync to shed suspicion.
  c.aiActionTimer -= dt;
  if (c.aiActionTimer <= 0) {
    c.aiActionTimer = rng.range(3, 7);
    c.suspicion = Math.max(0, c.suspicion - rng.range(8, 20));
  }
  // Passive small suspicion from just being a moving human in the crowd.
  c.suspicion = Math.min(100, c.suspicion + rng.range(0, 2) * dt);
}

// ---------------- shared integration + crowd separation ----------------
export function integrate(c, dt, world) {
  // Smoothly rotate toward target facing.
  let d = normalizeAngle(c.targetFacing - c.facing);
  const maxTurn = TUNING.faker.turnRate * dt;
  if (Math.abs(d) > maxTurn) d = Math.sign(d) * maxTurn;
  c.lastFacing = c.facing;
  c.facing += d;

  if (c.speed > 0.01 && (c.state === 'walking' || c.kind === 'player')) {
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.bob += dt * (c.speed / 22);
  }
  world.resolve(c, c.radius);
}

export function separate(chars, dt) {
  // Cheap O(n^2) separation — fine for ~80 characters, keeps the crowd readable.
  for (let i = 0; i < chars.length; i++) {
    const a = chars[i];
    if (a.eliminated) continue;
    for (let j = i + 1; j < chars.length; j++) {
      const b = chars[j];
      if (b.eliminated) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const overlap = (min - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        // Frozen characters resist being shoved (they're locked in a pose).
        const aFroze = a.state === 'frozen', bFroze = b.state === 'frozen';
        const aw = aFroze ? 0.15 : 1, bw = bFroze ? 0.15 : 1;
        const tw = aw + bw || 1;
        a.x -= ux * overlap * (aw / tw) * 2;
        a.y -= uy * overlap * (aw / tw) * 2;
        b.x += ux * overlap * (bw / tw) * 2;
        b.y += uy * overlap * (bw / tw) * 2;
      }
    }
  }
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
