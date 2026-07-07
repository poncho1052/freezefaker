# Claude Code Brief

## Purpose

Build the first playable vertical slice of Freeze Faker without trying to implement the full commercial product at once.

The goal of the first build is to test whether the core experience is fun:

> A human player hides among NPCs, Red Light triggers, everyone freezes, and the Watcher tries to identify who looks too human.

## Important Constraint

Do not expand scope unless explicitly requested.

Prioritize the core loop over polish, cosmetics, online infrastructure, or store features.

---

## Read First

Before implementing, read:

- `docs/PRODUCT_SPEC.md`
- `docs/DEVELOPMENT_SPEC.md`
- `docs/ART_DIRECTION.md`

This brief overrides those documents for the first playable build scope.

---

## Recommended Project Location

If creating a Unity project, place it under:

```text
unity/FreezeFaker/
```

Keep documentation and game project files separate.

---

## Target First Build

### Build Type
Playable vertical slice.

### Initial Mode
Classic / Freeze Run.

### Initial Map
Station Front prototype.

This can be a graybox map at first.

### Initial Player Setup
Start with local prototype if online multiplayer is not ready.

Acceptable first versions:

1. Single-player local test with controllable Faker and simple Watcher test mode
2. Local multi-role debug scene
3. Basic multiplayer only if implementation is already straightforward

Do not block the core gameplay test on online networking.

---

## Must Build First

### Core Gameplay
- One scene: Station Front prototype
- Green Light / Red Light state cycle
- NPCs walk during Green Light
- NPCs freeze during Red Light
- Faker can move through the scene
- Faker tries to reach a GoalZone
- Watcher can observe the crowd
- Watcher can accuse characters during Red Light
- Correct accusation catches/eliminates Faker
- False accusation consumes a Mark
- Faker wins by reaching GoalZone
- Watcher wins by catching all Fakers

### Basic Numbers
- 1 Watcher
- 1〜3 Fakers
- 20〜40 NPCs
- Round length: 3 minutes
- Green Light: 8〜15 seconds
- Red Light warning: 0.8〜1.5 seconds
- Red Light: 5〜8 seconds
- Watcher marks: 5

### Basic UI
- Current state: Green Light / Red Light
- Round timer
- Watcher marks left
- Goal indicator for Faker
- Simple result screen

---

## Build After Core Loop Works

Only after the basic loop is playable:

- Disguise actions
- NPC Sync
- False accusation effects
- Better NPC freeze poses
- Simple replay or debug camera
- Better result stats

---

## Do Not Build Yet

Do not implement these in the first pass:

- Multiple maps
- Cosmetics
- Paid DLC
- Steam integration
- Achievements
- Full replay system
- UGC map editor
- Complex matchmaking
- Character customization
- Full streamer mode
- Advanced AI
- Mobile support
- Crossplay

---

## Core Design Rule

The game is not about simply stopping.

The player must stop like an NPC.

If the first prototype only checks whether the player moved, the core is not implemented yet.

The prototype should create situations where the Faker can look suspicious because of:

- Position
- Facing direction
- Spacing from NPCs
- Stopping location
- Pose or action context
- Movement immediately before Red Light

---

## Suggested First Implementation Order

1. Create Station Front graybox scene
2. Add NPC spawn points and simple path points
3. Implement NPC walking loop
4. Implement Green / Red Light state machine
5. Make NPCs freeze and resume
6. Add controllable Faker
7. Add GoalZone and Faker win condition
8. Add Watcher camera
9. Add clickable accusation targeting
10. Add correct / false accusation resolution
11. Add simple HUD
12. Add result screen
13. Add debug controls and simple playtest instructions

---

## Acceptance Criteria for First Playable Build

The first build is acceptable if:

- A user can run the scene and understand the goal
- NPCs visibly move and freeze
- The Faker can reach the goal
- The Watcher can accuse characters
- Correct and false accusation outcomes work
- The round can end with Faker or Watcher victory
- The scene can be used to test whether the Red Light freeze moment is fun

---

## Output Requested from Claude Code

After implementation, provide:

- What was built
- How to run it
- Main files created/changed
- Known limitations
- Next recommended implementation steps
- Any assumptions made
