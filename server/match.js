// Transport-agnostic multiplayer core: rooms by code + one authoritative match
// each. Used by both the local Node server (server.js) and the hosted deploy
// bundle (built by tools/build-deploy.mjs). A "conn" is anything with
// .send(string). Authoritative for: NPC crowd, light cycle, accusation
// resolution, win/lose. NPCs and human Fakers are broadcast as one
// indistinguishable entity list (hidden-role integrity).
import { TUNING } from '../src/config.js';
import { createWorld } from '../src/world.js';
import { makeNpc, makeFaker, updateNpc, integrate, separate, scheduleResume } from '../src/characters.js';
import { LightCycle } from '../src/lights.js';
import { makeRng } from '../src/rng.js';

const NOOP_AUDIO = new Proxy({}, { get: () => () => {} });

export const rooms = new Map();
let uid = 1;

export function nextId() { return uid++; }

export function code4() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return rooms.has(s) ? code4() : s;
}

// ---------------- Match ----------------
export class Match {
  constructor(room) {
    this.room = room;
    this.rng = makeRng((Date.now() >>> 0) ^ (nextId() * 2654435761));
    this.world = createWorld();
    this.goal = this.world.goal;
    this.lights = new LightCycle(this.rng, () => {});
    this.prevPhase = this.lights.phase;
    this.roundLeft = TUNING.round.seconds;
    this.marks = 6;
    this.over = null;

    this.npcs = [];
    for (let i = 0; i < 42; i++) {
      const wp = this.rng.pick(this.world.waypoints);
      this.npcs.push(makeNpc(this.rng, this.world, { x: wp.x + this.rng.range(-40, 40), y: wp.y + this.rng.range(-40, 40) }));
    }

    const spots = this.world.spawnPoints.slice();
    shuffle(spots, this.rng);
    this.fakerIds = [];
    for (const p of room.players.values()) {
      if (p.role !== 'faker') continue;
      const ch = makeFaker(this.rng, this.world, spots.pop() || this.rng.pick(this.world.spawnPoints), false);
      ch.id = 'p' + p.id;
      p.char = ch;
      this.fakerIds.push(ch.id);
    }
    this.fakersTotal = this.fakerIds.length;

    this.entities = [...this.npcs, ...this._fakerChars()];
    this.startedAt = Date.now();
  }

  _fakerChars() {
    const out = [];
    for (const p of this.room.players.values()) if (p.role === 'faker' && p.char) out.push(p.char);
    return out;
  }

  rosterFor() {
    return this.entities.map((c) => ({ id: c.id, a: c.appearance, x: Math.round(c.x), y: Math.round(c.y), f: +c.facing.toFixed(2) }));
  }

  tick(dt) {
    if (this.over) return;
    this.lights.update(dt);
    if (this.prevPhase !== this.lights.phase) {
      if (this.lights.phase === 'green') for (const c of this.npcs) scheduleResume(c, this.rng);
      this.prevPhase = this.lights.phase;
    }
    const ctx = { world: this.world, light: this.lights, rng: this.rng, audio: NOOP_AUDIO, chars: this.entities };
    for (const c of this.npcs) { updateNpc(c, dt, ctx); integrate(c, dt, this.world); }
    separate(this.npcs, dt);

    this.roundLeft -= dt;

    for (const p of this.room.players.values()) {
      if (p.role !== 'faker' || !p.char || p.char.eliminated || p.char.goalReached) continue;
      if (Math.hypot(this.goal.x - p.char.x, this.goal.y - p.char.y) < 66) { p.char.goalReached = true; this._end('fakers', 'goal'); return; }
    }

    const fakers = this._fakerChars();
    if (fakers.length && fakers.every((c) => c.eliminated)) return this._end('watcher', 'allcaught');
    if (this.roundLeft <= 0) return this._end('fakers', 'timeup');
    if (this.marks <= 0) return this._end('fakers', 'nomarks');
  }

  accuse(watcherPlayer, id) {
    if (this.over || this.lights.phase !== 'red') return;
    const target = this.entities.find((c) => c.id === id && !c.eliminated);
    if (!target) return;
    const correct = this.fakerIds.includes(id);
    target.accused = 1.0; target._accuseCorrect = correct;
    if (correct) { target.eliminated = true; }
    else { this.marks--; }
    this.room.broadcast({ t: 'ev', kind: 'accuse', id, correct });
  }

  snapshot() {
    const ents = this.entities.map((c) => [c.id, Math.round(c.x), Math.round(c.y), +c.facing.toFixed(2), c.pose, c.state, c.eliminated ? 1 : 0]);
    const alive = this._fakerChars().filter((c) => !c.eliminated && !c.goalReached).length;
    return {
      t: 'snap', ph: this.lights.phase, tl: +this.lights.timeLeft.toFixed(2), pd: +this.lights.phaseDuration.toFixed(2),
      rt: Math.max(0, Math.round(this.roundLeft)), marks: this.marks, alive, total: this.fakersTotal, ents,
    };
  }

  _end(winner, reason) {
    if (this.over) return;
    this.over = { winner, reason };
    this.room.broadcast({ t: 'end', winner, reason, fakerIds: this.fakerIds });
  }
}

// ---------------- Room ----------------
export class Room {
  constructor(code) { this.code = code; this.players = new Map(); this.hostId = null; this.match = null; }
  broadcast(msg) { const s = JSON.stringify(msg); for (const p of this.players.values()) p.conn.send(s); }
  lobby() {
    return {
      t: 'lobby', code: this.code, host: this.hostId,
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, ready: p.ready, role: p.role })),
      inMatch: !!this.match,
    };
  }
  add(player, role) { player.role = role; this.players.set(player.id, player); }
  remove(id) {
    const p = this.players.get(id); if (!p) return;
    this.players.delete(id);
    if (this.match && p.char) p.char.eliminated = true;
    if (this.hostId === id) { const first = this.players.keys().next().value; this.hostId = first || null; if (first) this.players.get(first).role = 'watcher'; }
    if (this.players.size === 0) { if (this.match) this.match.over = { winner: 'none' }; rooms.delete(this.code); }
    else this.broadcast(this.lobby());
  }
}

export function makePlayer(conn) { return { id: nextId(), name: 'Player', conn, ready: false, role: null, room: null, char: null }; }

export function handleMessage(player, m) {
  switch (m.t) {
    case 'create': {
      const room = new Room(code4());
      rooms.set(room.code, room);
      player.name = (m.name || 'Host').slice(0, 16);
      room.hostId = player.id;
      room.add(player, 'watcher');
      player.room = room;
      player.conn.send(JSON.stringify({ t: 'joined', id: player.id, code: room.code, host: true, role: 'watcher' }));
      room.broadcast(room.lobby());
      break;
    }
    case 'join': {
      const room = rooms.get((m.code || '').toUpperCase());
      if (!room) return player.conn.send(JSON.stringify({ t: 'error', msg: 'Room not found' }));
      if (room.match) return player.conn.send(JSON.stringify({ t: 'error', msg: 'Match already started' }));
      if (room.players.size >= 8) return player.conn.send(JSON.stringify({ t: 'error', msg: 'Room full' }));
      player.name = (m.name || 'Faker').slice(0, 16);
      room.add(player, 'faker');
      player.room = room;
      player.conn.send(JSON.stringify({ t: 'joined', id: player.id, code: room.code, host: false, role: 'faker' }));
      room.broadcast(room.lobby());
      break;
    }
    case 'ready': { player.ready = !!m.v; if (player.room) player.room.broadcast(player.room.lobby()); break; }
    case 'role': {
      const room = player.room; if (!room || room.hostId !== player.id || room.match) return;
      for (const p of room.players.values()) p.role = (p.id === m.id) ? 'watcher' : 'faker';
      room.hostId = m.id ?? room.hostId;
      room.broadcast(room.lobby());
      break;
    }
    case 'start': {
      const room = player.room;
      if (!room || room.hostId !== player.id || room.match) return;
      if (room.players.size < 2) return player.conn.send(JSON.stringify({ t: 'error', msg: 'Need at least 2 players' }));
      startMatch(room);
      break;
    }
    case 'state': {
      const c = player.char; if (!c || c.eliminated) return;
      if (typeof m.x === 'number') { c.x = m.x; c.y = m.y; c.facing = m.fa; c.pose = m.po; c.state = m.st; }
      break;
    }
    case 'watch': { player.rx = m.rx; player.ry = m.ry; break; }
    case 'accuse': { const room = player.room; if (room && room.match && player.role === 'watcher') room.match.accuse(player, m.id); break; }
    case 'leave': { if (player.room) { player.room.remove(player.id); player.room = null; } break; }
  }
}

export function startMatch(room) {
  room.match = new Match(room);
  const roster = room.match.rosterFor();
  const goal = { x: room.match.goal.x, y: room.match.goal.y, r: room.match.goal.r };
  for (const p of room.players.values()) {
    p.conn.send(JSON.stringify({
      t: 'init', role: p.role, you: p.char ? p.char.id : null, goal, roster,
      round: TUNING.round.seconds,
    }));
  }
  const dt = 1 / 30;
  let n = 0;
  room._timer = setInterval(() => {
    const match = room.match;
    if (!match) { clearInterval(room._timer); return; }
    match.tick(dt);
    if (++n % 2 === 0) room.broadcast(match.snapshot());
    if (match.over) {
      clearInterval(room._timer);
      setTimeout(() => { if (room.players.size) { for (const p of room.players.values()) { p.ready = false; p.char = null; } room.match = null; room.broadcast(room.lobby()); } }, 4500);
    }
  }, dt * 1000);
}

function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i);[a[i], a[j]] = [a[j], a[i]]; } }
