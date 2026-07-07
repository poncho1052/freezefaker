# Freeze Faker

**Don’t Act Human.**

Freeze Faker は、NPCの群衆に紛れた人間プレイヤーが、Red Light の合図でNPCのように停止し、Watcherに見抜かれないようにする観察型かくれんぼパーティーゲームです。

普通の「動いたら負け」ではなく、**止まり方・目線・距離感・ポーズが人間っぽいとバレる**ことが特徴です。

> Freeze like an NPC. Don’t Act Human.

---

## ▶ Playable Build

This repository includes a **fully playable web game** (HTML5 Canvas + ES modules,
zero dependencies) with single-player modes **and real-time online multiplayer**:

- **Classic · Freeze Run** — cross the Station Front plaza to the gate while an AI Watcher hunts the crowd.
- **Blend Task** — complete disguise objectives around the plaza, then reach the gate.
- **Watcher · Spot the Human** — *you* watch the crowd from above; find the hidden Fakers and accuse them.
- **Play Online** — a room-code lobby where friends play together: one human Watcher vs. human Fakers hidden in the NPC crowd.

## 👥 Play with Friends (Online Multiplayer)

Multiplayer runs on a **zero-dependency Node server** (no `npm install`, just Node 18+).

**Host — start the server:**

```bash
node server/server.js          # Windows: node server\server.js
```

Open `http://localhost:8090`, click **PLAY ONLINE → Create Room**. You become the
**Watcher**; share the 4-letter room code shown in the lobby.

**Friends — join:** open the same address, **PLAY ONLINE → Join**, enter the code.
They spawn as **Fakers** hidden in the NPC crowd. When everyone’s in, the host presses **Start Match**.

Reaching your friends:

- **Same Wi-Fi / LAN:** they open `http://<your-LAN-IP>:8090`.
- **Over the internet:** expose the port with a tunnel and share the URL, e.g.
  `cloudflared tunnel --url http://localhost:8090` or `ngrok http 8090`.
- Change the port with `PORT=9000 node server/server.js`.

The server is authoritative for the NPC crowd, the light cycle and accusations, and
broadcasts human Fakers and NPCs as **one indistinguishable entity list** — the Watcher
can’t tell players from NPCs by any metadata, only by reading body language.

### The core mechanic: don’t just stop — stop like an NPC

This is the part that makes it Freeze Faker and not just Red Light Green Light.
When Red Light hits, the whole crowd freezes and **turns to face the nearest point
of interest** (a shop window, a sign, the station gate) — so each cluster shares a
readable "型" (stance). A Faker is judged **not by whether they moved**, but by how
far their frozen **facing, pose and spacing** drift from that local crowd baseline:

- face the wrong way → **Wrong way**
- stand apart from everyone → **Too alone**
- hold the wrong pose in a context spot → **Odd pose**

During Red Light you can **pivot in place** (movement keys) to fix your stance
without walking, or use **NPC Sync** to snap to a neighbour. Your current tell shows
over your head, and a small arrow points where the crowd is looking. In Watcher mode
the AI Fakers show these same tells through their actual body language — your job is
to read them.

### Run it

No build step and no dependencies. Two ways to serve it:

```bash
# Option A — the game server (also enables multiplayer). Needs Node 18+.
node server/server.js            # open http://localhost:8090

# Option B — any static server, for single-player only.
python3 -m http.server 8000      # open http://localhost:8000
```

(ES modules require `http://` — opening `index.html` via `file://` will not load the modules.)

### Controls

**Faker (Classic / Blend Task):**

| Action | Key |
| --- | --- |
| Move (Green) · Pivot in place (Red) | `W A S D` / Arrow keys |
| Jog (faster, more suspicious) | hold `Shift` |
| Disguise / Mimic actions | `1`–`6` |
| Smart disguise (auto-pick for your spot) | `Q` |
| NPC Sync (copy a nearby NPC’s facing + pose) | `E` |
| Pause | `Esc` / `P` |

**Watcher (Spot the Human):**

| Action | Input |
| --- | --- |
| Aim the focus reticle | Move the mouse |
| Accuse a suspect (Red Light only) | Left click |
| Pin / unpin a suspect | Right click |

### How to win

- **GREEN LIGHT** — move toward the glowing **▲ GATE**, weaving through the crowd.
- **RED LIGHT** — stop completely. Moving spikes your *Tension* and gets you accused.
- Use **disguise actions** near the matching spot (phone, bench, vending, shop window,
  sign) and **NPC Sync** to look natural and shed suspicion.
- Reach the gate → **you win**. Get read by the Watcher → **caught**. Outlast the round → the Watchers win.

### What’s implemented

- Three modes: **Classic · Freeze Run**, **Blend Task** (missions), and playable **Watcher · Spot the Human**
- **Freeze-conformity** core: crowd faces shared attractors on freeze; Fakers judged on facing / pose / spacing
  deviation — with on-screen tells, an expected-facing arrow, and pivot-in-place on Red
- **Hunted-tension loop**: when the AI Watcher locks onto you, a red threat vignette closes in with a quickening
  heartbeat and a **SPOTTED!** alert — turn to blend or NPC-Sync to break the lock for a **CLOSE!** relief, or get
  caught in a slow-mo, screen-shaking **GOTCHA** punch-zoom. Decoy catches and your goal run get the same payoff.
- Green / Red Light cycle with a warning phase, per-phase countdown, freeze-snap flash, and staggered NPC resume
- A readable NPC crowd (~48) with archetypes, wander schedules and context-aware freeze poses
- AI **decoy Fakers** who race the gate, freeze with imperfect tells, and can be caught in your place
- **Suspicion system** (conformity, jogging, sharp turns, isolation, wrong-context actions, collisions —
  offset by valid actions, good freezes and NPC Sync)
- **AI Watcher** with a roaming focus reticle, dwell-to-lock accusation, and a marks economy
- **End-of-round identity reveal** marking every Faker
- Disguise action bar, NPC Sync cooldown, mission checklist, and the full in-match HUD from the UI concept board
- Mode select · Title · How-to · Settings · Pause · Result screens, recreated **Freeze Faker** logo
- EN / JA localization, colorblind signal assist, volume + HUD-scale settings (saved locally)
- Fully synthesized audio (WebAudio) — no external asset files

The art direction (palette, logo, pedestrian-signal + watcher-eye + reticle motifs, semi-deformed
crowd) follows [Art Direction](docs/ART_DIRECTION.md) and the reference design boards in the repo root.

### Source layout

```
index.html          boot shell            src/world.js        map, zones, obstacles, waypoints
styles.css          menu / screen styling src/characters.js   NPC + Faker behaviour & poses
assets/favicon.svg  tab icon              src/renderer.js     camera, crowd & plaza drawing
src/main.js         bootstrap             src/hud.js          in-match HUD
src/config.js       palette, tuning, i18n src/lights.js       green/red light cycle
src/game.js         modes + loop          src/suspicion.js    suspicion scoring
src/input.js        keyboard / mouse      src/conformity.js   crowd-baseline freeze scoring
src/audio.js        synthesized SFX       src/watcher.js      AI Watcher & accusation
src/rng.js          seedable PRNG         src/ui.js           logo + DOM screens
src/net.js          WebSocket client      src/store.js        settings persistence
src/online.js       online match (client)
server/server.js    rooms + authoritative match   server/wsserver.js   zero-dep HTTP+WebSocket
```

This slice corresponds to Milestones 1–2 in the [Development Spec](docs/DEVELOPMENT_SPEC.md)
(core prototype → playable single-player Station Front). Online multiplayer, additional maps,
and the full commercial content scope remain as documented next steps.

---

## Documents

- [Product Spec](docs/PRODUCT_SPEC.md) — 販売できる商品としての企画仕様
- [Development Spec](docs/DEVELOPMENT_SPEC.md) — 開発会社・エンジニア向けの実装仕様
- [Art Direction](docs/ART_DIRECTION.md) — ロゴ、世界観、キャラクター、UIの方向性

## Core Concept

- Faker はNPCの群衆に紛れ、目的地やミッション達成を目指す
- Watcher は Red Light 中に、群衆の中の“人間っぽい違和感”を見抜く
- 視聴者は「この中に人間がいる」というクイズとして楽しめる

## Visual Direction

Pop, readable, slightly surreal, and stream-friendly.

- Semi-deformed stylized characters
- Bright station-front shopping street
- Soft navy / gray / off-white base
- Red / green / amber signal accents
- Light surveillance motif without becoming horror or dystopian

## Launch Scope (target)

- Online multiplayer · 1 Watcher vs 3–7 Fakers + NPC crowd
- Classic (Freeze Run) & Mission (Blend Task) modes · Custom rooms · Tutorial
- 3 launch maps · 40+ NPC variations · 15+ NPC behaviors · 10+ disguise actions
- Replay / highlight support · Streamer-friendly settings
