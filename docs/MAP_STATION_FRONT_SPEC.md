# Freeze Faker Map Spec: Station Front v0.1

Station Front is the first and most important map. It should prove the core game loop.

---

## 1. Map Role

Station Front is:

- The tutorial-friendly map
- The main store-page visual map
- The first playable prototype map
- The baseline for NPC movement and crowd readability

It should communicate the game in one glance:

> A crowd in a station-front shopping street freezes, and humans are hiding among them.

---

## 2. Map Theme

A bright urban station-front shopping street.

Reference elements:

- Japanese station entrance
- Shopping street signage
- Crosswalk
- Convenience store
- Vending machines
- Cafe frontage
- Benches
- Bus stop
- Store windows
- Tactile paving
- Planters
- Public clock
- Pedestrian signal

The map should feel Japanese-inspired but globally readable.

---

## 3. First Build Layout

The first graybox can be simple.

Recommended layout:

```text
[Start Area] ---- [Plaza / Crowd Area] ---- [Crosswalk] ---- [Station Gate / Goal]
                         |                      |
                    [Vending]              [Cafe / Bench]
                         |
                  [Shop Window]
```

Core path:

- Fakers start near shopping street entrance.
- GoalZone is near station gate.
- NPCs move across the plaza and crosswalk.
- Watcher observes from elevated camera.

---

## 4. Required Zones

### Faker Start Zone
- Safe initial spawn area
- Not too close to goal
- Mixed with some NPCs

### GoalZone
- Station gate / ticket gate area
- Faker win trigger
- Clearly visible but risky to approach

### Plaza Zone
- Main crowd area
- Most accusations happen here

### Crosswalk Zone
- Creates natural stopping moments
- Good for Red Light tension

### Vending Zone
- Supports Vending action
- Good suspicious context area

### Bench Zone
- Supports BenchSit action
- Creates stationary NPCs

### Shop Window Zone
- Supports ShopLook action
- Gives Fakers natural cover

### Signboard Zone
- Supports LookSign action

### Bus Stop Zone
- Supports Wait action

---

## 5. NPC Pathing

### Path Types
- Main flow: shopping street to station
- Cross flow: side street to cafe / bus stop
- Loop flow: plaza circular route
- Static points: bench, vending, signboard, shop window

### First Build Requirements
- 20〜40 NPCs
- 10〜20 path points
- At least 5 context interaction points
- NPCs should not clump too much
- NPCs should create enough cover for Fakers

---

## 6. Watcher Camera

### Recommended Default
Elevated semi-top-down camera.

Watcher should see:

- Main plaza
- Crosswalk
- Goal approach
- Most interaction zones

Watcher should not see:

- Every detail perfectly at once

Watcher should need to pan/zoom to inspect details.

### Camera Bounds
Keep camera inside map boundaries.

Allow:

- Pan
- Zoom
- Slight rotation if useful

---

## 7. Visual Readability

### Must Be Clear
- Where the crowd is
- Where the goal is
- What state the light is in
- Which areas are valid action contexts
- Which characters are standing / walking / frozen

### Avoid
- Too many signs covering characters
- Excessive visual clutter
- Dark lighting
- Tiny characters that are unreadable
- NPCs hidden behind props too often

---

## 8. Red Light Signal Placement

Include at least one prominent signal source.

Options:

- Pedestrian signal
- Public announcement speaker
- Large station display
- Watcher-eye billboard

The Red Light signal should be visible in key visual and gameplay.

---

## 9. First Build Props

Minimum props:

- Station gate placeholder
- Crosswalk stripes
- Vending machine
- Bench
- Shop window
- Signboard
- Bus stop sign
- Planters / bollards
- Simple building blocks

Art polish can come later.

---

## 10. Gameplay Balance Notes

Map should support:

- Multiple routes to goal
- Natural stopping points
- Risky open areas
- Safe but slower crowd paths
- Watcher line-of-sight decisions

Bad map signs:

- Fakers always win by running straight
- Watcher can see everything too easily
- NPCs block all movement
- Fakers have no reason to blend
- Red Light freezes look visually boring

---

## 11. First Build Acceptance Criteria

Station Front graybox is acceptable if:

- Fakers can travel from start to goal
- NPCs move through the main area
- Red Light freeze moment is visible
- Watcher can inspect the crowd
- At least 3 context zones exist
- The map creates at least one funny or tense accusation moment

---

## 12. Future Art Pass Direction

Final art should follow `docs/ART_DIRECTION.md`.

Key final art motifs:

- Bright city plaza
- Clean station signage
- Soft navy / gray / off-white base
- Red / green / amber signal accents
- Semi-deformed NPC crowd
- Light surveillance-eye motif
