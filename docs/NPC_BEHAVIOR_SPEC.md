# Freeze Faker NPC Behavior Spec v0.1

NPC behavior is the foundation of Freeze Faker. NPCs are not background decoration. They define what “normal” looks like.

---

## 1. Design Goal

NPCs should be:

- Predictable enough for Fakers to mimic
- Varied enough to feel like a crowd
- Readable enough for Watchers to compare
- Slightly artificial, not fully realistic
- Consistent with the semi-deformed 3D style

The best NPCs are not perfectly human. They have gentle regularity.

---

## 2. First Build NPC Behaviors

For the first playable build, implement only a small set.

### Required
1. Walk
2. Idle
3. Freeze
4. Resume

### Recommended if time allows
5. Phone
6. LookSign
7. BenchSit
8. Vending
9. ShopLook

---

## 3. NPC State Flow

Basic loop:

```text
Spawn
  -> ChooseDestination
  -> Walk
  -> Arrive
  -> IdleAction
  -> ChooseDestination
```

When Red Light occurs:

```text
AnyState
  -> FreezePose
  -> HoldUntilGreen
  -> ResumeDelay
  -> PreviousOrNextBehavior
```

---

## 4. Core States

## 4.1 Walk
NPC moves along path points or NavMesh.

Parameters:

- Walk speed
- Turn speed
- Destination
- Avoidance radius
- Animation variant

Design note:

NPC walk speed should be slightly consistent. Fakers should be able to learn it.

## 4.2 Idle
NPC stands naturally for a short period.

Parameters:

- Idle duration
- Facing direction
- Idle animation

## 4.3 Freeze
NPC stops during Red Light.

Parameters:

- Freeze pose
- Freeze transition speed
- Context-specific pose

## 4.4 Resume
NPC resumes after Green Light returns.

Parameters:

- Resume delay: 0.0〜0.5 seconds
- Previous behavior or new behavior

---

## 5. Context Actions

## 5.1 Phone
NPC looks at phone.

Good locations:

- Plaza
- Near station
- Waiting areas
- Sidewalk

Freeze pose:

- Head down
- Phone held at chest height

## 5.2 LookSign
NPC looks at sign or map.

Good locations:

- Signboard
- Station map
- Shopping street sign

Freeze pose:

- Body facing sign
- Head slightly up

## 5.3 BenchSit
NPC sits on bench.

Good locations:

- Bench interaction points only

Freeze pose:

- Seated
- Looking forward / phone / newspaper

## 5.4 Vending
NPC looks at vending machine.

Good locations:

- Vending machine interaction point

Freeze pose:

- Facing vending machine
- Arm near button or side

## 5.5 ShopLook
NPC looks at shop window.

Good locations:

- Storefront interaction zone

Freeze pose:

- Body angled toward display
- Slight lean possible

---

## 6. Red Light Freeze Rules

When Red Light begins:

1. Stop movement quickly.
2. Choose context-appropriate freeze pose.
3. Hold pose until Green Light.
4. Avoid all NPCs freezing into identical pose.

### Pose Selection Priority
1. Current action pose
2. Nearby context pose
3. Walking freeze pose
4. Generic idle pose

---

## 7. Readability Rules

NPCs should not:

- Turn too sharply
- Sprint
- Jitter
- Clip heavily into each other
- Choose absurd actions
- Freeze facing random directions without reason

NPCs may:

- Repeat patterns gently
- Use similar postures
- Pause at predictable spots
- Walk in slightly mechanical but believable ways

---

## 8. Comparison Baseline

Watcher should be able to compare Fakers against NPCs by checking:

- Walk speed
- Stop timing
- Facing direction
- Distance from nearby NPCs
- Context action validity
- Pose naturalness

NPC behavior must make those comparisons possible.

---

## 9. First Build Implementation Suggestion

Use simple components:

```text
NPCController
NPCBehaviorState
NPCPathPoint
NPCContextZone
NPCFreezePose
```

Each NPC should have:

- Archetype ID
- Current state
- Current target point
- Current action
- Current freeze pose
- Resume delay

---

## 10. Future Expansion

Commercial version should add:

- Queue behavior
- Crosswalk behavior
- Bus stop waiting
- Newspaper reading
- Bag adjust
- Cafe waiting
- Group conversation
- Shop entering/exiting
- Festival stall behavior
- Shopping mall escalator behavior

But do not implement all of these before the core loop is fun.
