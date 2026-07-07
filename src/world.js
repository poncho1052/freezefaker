// Station Front map: props (visuals + obstacles), context zones (dev spec §11.1),
// NPC waypoints, spawn points and the goal gate.
import { TUNING } from './config.js';

export function createWorld() {
  const { w, h } = TUNING.world;

  const props = [];
  const zones = [];
  const obstacles = []; // AABBs that block movement

  const addProp = (p) => { props.push(p); return p; };
  const addZone = (tag, x, y, rw, rh, label) => zones.push({ tag, x, y, w: rw, h: rh, cx: x + rw / 2, cy: y + rh / 2, label });
  const addObstacle = (x, y, rw, rh) => obstacles.push({ x, y, w: rw, h: rh });

  // ---- Top building band (station + shops). Blocks the top edge. ----
  addProp({ type: 'skyline', x: 0, y: 0, w, h: 210 });
  // Station facade (center) with a gate opening = the goal.
  addProp({ type: 'station', x: w / 2 - 260, y: 40, w: 520, h: 150 });
  addProp({ type: 'cafe', x: 120, y: 70, w: 300, h: 120, label: 'CAFÉ LUMIÈRE' });
  addProp({ type: 'store', x: w - 420, y: 70, w: 300, h: 120, label: 'MART 24H' });

  // Buildings are solid except the gate gap.
  addObstacle(0, 0, w / 2 - 90, 190);
  addObstacle(w / 2 + 90, 0, w / 2 - 90, 190);

  // ---- Goal: station gate ----
  const goal = { x: w / 2, y: 168, r: 74, tag: 'goal' };
  addProp({ type: 'gate', x: w / 2 - 90, y: 150, w: 180, h: 40 });
  addZone('goal', w / 2 - 90, 120, 180, 90, 'GATE');

  // ---- Pedestrian signal poles (the light-state landmarks) ----
  addProp({ type: 'signal', x: w / 2 + 300, y: 210 });
  addProp({ type: 'signal', x: w / 2 - 340, y: 240 });

  // ---- Crosswalk across the mid-plaza ----
  addProp({ type: 'crosswalk', x: w / 2 - 320, y: 520, w: 640, h: 90 });
  addZone('sign', w / 2 - 60, 470, 120, 60, 'CROSSING'); // "look at signal" context

  // ---- Left edge: vending machines + shop windows ----
  vendingCluster(60, 360);
  vendingCluster(60, 720);
  shopWindow(40, 520, 'left');

  // ---- Right edge: vending + shop windows ----
  vendingCluster(w - 150, 400);
  shopWindow(w - 130, 640, 'right');

  // ---- Benches around the plaza ----
  bench(w / 2 - 470, 700);
  bench(w / 2 + 330, 690);
  bench(w / 2 - 120, 820);

  // ---- Signboards / arcade signs ----
  signboard(300, 330, '駅前通り商店街');
  signboard(w - 360, 300, 'SHOPPING ST.');

  // ---- Planters (soft obstacles / decoration) ----
  // Kept clear of the central gate corridor (x ≈ w/2 ± 70) so the path is fair.
  planter(w / 2 - 320, 380); planter(w / 2 + 240, 420);
  planter(w / 2 - 210, 300); planter(w / 2 + 300, 900);

  // ---- Trash bins ----
  addProp({ type: 'bin', x: w / 2 - 250, y: 780, w: 26, h: 34 });
  addObstacle(w / 2 - 250, 780, 26, 30);

  // ---- Spawn points along the bottom (Fakers start near the crowd) ----
  const spawnPoints = [];
  for (let i = 0; i < 10; i++) {
    spawnPoints.push({ x: 240 + i * ((w - 480) / 9), y: 950 - (i % 2) * 40 });
  }

  // ---- NPC wander waypoints: a jittered grid over the walkable plaza ----
  const waypoints = [];
  for (let gx = 0; gx < 7; gx++) {
    for (let gy = 0; gy < 6; gy++) {
      const x = 200 + gx * ((w - 400) / 6);
      const y = 300 + gy * ((h - 420) / 5);
      // skip points buried in obstacles
      if (!insideAny(obstacles, x, y, 40)) waypoints.push({ x, y });
    }
  }
  // Anchor some waypoints to context zones so NPCs naturally use them.
  for (const z of zones) {
    if (z.tag === 'vending' || z.tag === 'bench' || z.tag === 'shop' || z.tag === 'sign') {
      waypoints.push({ x: z.cx, y: z.cy + (z.tag === 'bench' ? -2 : 40), zone: z.tag });
    }
  }

  // ---------- local builders ----------
  function vendingCluster(x, y) {
    addProp({ type: 'vending', x, y, w: 90, h: 70, hue: '#c33' });
    addProp({ type: 'vending', x: x + 46, y, w: 44, h: 70, hue: '#357' });
    addObstacle(x - 4, y, 98, 66);
    addZone('vending', x - 20, y + 66, 130, 70, 'VENDING');
  }
  function shopWindow(x, y, side) {
    const px = side === 'left' ? x : x;
    addProp({ type: 'shopwin', x: px, y, w: 90, h: 150, side });
    addObstacle(px, y, 90, 150);
    addZone('shop', side === 'left' ? px + 90 : px - 60, y + 30, 70, 100, 'WINDOW');
  }
  function bench(x, y) {
    addProp({ type: 'bench', x, y, w: 130, h: 34 });
    addZone('bench', x, y + 30, 130, 46, 'BENCH');
  }
  function signboard(x, y, text) {
    addProp({ type: 'signboard', x, y, w: 150, h: 46, text });
    addObstacle(x + 60, y + 46, 18, 40); // the pole
    addZone('sign', x - 10, y + 90, 170, 60, 'SIGN');
  }
  function planter(x, y) {
    addProp({ type: 'planter', x, y, w: 70, h: 40 });
    addObstacle(x + 6, y + 8, 58, 30);
  }

  const world = {
    w, h, props, zones, obstacles, waypoints, spawnPoints, goal,
    // minY reaches up into the gate mouth so the goal is actually reachable;
    // the top building band still blocks everywhere except the gate gap.
    walkable: { minX: 60, minY: 150, maxX: w - 60, maxY: h - 50 },

    // Return the context tag at a position ('any' actions always allowed).
    zoneAt(x, y) {
      for (const z of zones) {
        if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
      }
      return null;
    },
    nearestZone(x, y, tag, maxDist = 90) {
      let best = null, bd = maxDist * maxDist;
      for (const z of zones) {
        if (tag && z.tag !== tag) continue;
        const dx = x - z.cx, dy = y - z.cy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = z; }
      }
      return best;
    },
    // Push a moving circle out of solid obstacles and keep it in-bounds.
    resolve(pos, r) {
      const wk = world.walkable;
      pos.x = clamp(pos.x, wk.minX + r, wk.maxX - r);
      pos.y = clamp(pos.y, wk.minY + r, wk.maxY - r);
      for (const o of obstacles) {
        const nx = clamp(pos.x, o.x, o.x + o.w);
        const ny = clamp(pos.y, o.y, o.y + o.h);
        const dx = pos.x - nx, dy = pos.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 0.001;
          const push = (r - d);
          pos.x += (dx / d) * push;
          pos.y += (dy / d) * push;
        }
      }
    },
  };
  return world;
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function insideAny(rects, x, y, pad = 0) {
  return rects.some((o) => x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad);
}
