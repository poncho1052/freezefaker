# Freeze Faker Task List

This task list is scoped to development planning. It is intentionally separated from implementation files so Claude Code can work in code folders without conflicts.

---

## Milestone 0: Repository Preparation

- [x] Add product specification
- [x] Add development specification
- [x] Add art direction
- [x] Add Claude Code brief
- [ ] Add reference image files under `assets/references/`
- [ ] Decide engine and project location
- [ ] Confirm first build target: local prototype or online prototype

---

## Milestone 1: Core Playable Prototype

Goal: prove the basic Freeze Faker loop works.

### Scene / Map
- [ ] Create Station Front graybox scene
- [ ] Add start area for Fakers
- [ ] Add GoalZone
- [ ] Add basic street layout
- [ ] Add simple obstacles / benches / vending placeholders
- [ ] Add NPC spawn points
- [ ] Add NPC path points

### Green / Red Light
- [ ] Implement match state machine
- [ ] Implement Green Light state
- [ ] Implement Red Light warning state
- [ ] Implement Red Light state
- [ ] Add configurable state durations
- [ ] Add visual state indicator
- [ ] Add audio placeholder cues

### NPCs
- [ ] Spawn 20〜40 NPCs
- [ ] Implement simple walking behavior
- [ ] Implement idle behavior
- [ ] Implement freeze behavior
- [ ] Implement resume behavior with small random delay
- [ ] Add at least 3 placeholder character variants

### Faker
- [ ] Implement controllable Faker movement
- [ ] Add basic camera
- [ ] Add GoalZone detection
- [ ] Add Faker win condition
- [ ] Add movement restriction or warning during Red Light

### Watcher
- [ ] Implement Watcher camera
- [ ] Add clickable character targeting
- [ ] Allow accusations only during Red Light
- [ ] Resolve correct accusation
- [ ] Resolve false accusation
- [ ] Add Mark count
- [ ] Add Watcher win condition

### UI
- [ ] Display Green Light / Red Light
- [ ] Display round timer
- [ ] Display Watcher marks left
- [ ] Display simple role indicator
- [ ] Display result screen

### Playtest
- [ ] Add debug instructions
- [ ] Add quick restart
- [ ] Add test checklist

---

## Milestone 2: Vertical Slice

Goal: make the first build feel like Freeze Faker, not just a technical prototype.

### NPC Behavior
- [ ] Add Phone action
- [ ] Add LookSign action
- [ ] Add BenchSit action
- [ ] Add Vending action
- [ ] Add ShopLook action
- [ ] Add context-based freeze poses

### Faker Actions
- [ ] Add action wheel or action bar
- [ ] Implement Phone disguise action
- [ ] Implement LookSign disguise action
- [ ] Implement BenchSit disguise action
- [ ] Implement Vending disguise action
- [ ] Implement BagAdjust or LookAround action

### NPC Sync
- [ ] Select nearby NPC
- [ ] Copy facing direction
- [ ] Copy walking speed
- [ ] Copy idle action
- [ ] Add cooldown
- [ ] Add simple UI indicator

### Suspicion Feedback
- [ ] Track internal suspicion score
- [ ] Increase suspicion for invalid movement/action
- [ ] Decrease suspicion for valid mimicry
- [ ] Add subtle Faker-side feedback
- [ ] Keep suspicion hidden from Watcher

### Visual Polish
- [ ] Replace graybox props with stylized placeholders
- [ ] Improve Red Light freeze moment
- [ ] Add traffic signal visual
- [ ] Add simple urban signage
- [ ] Add crowd clarity pass

---

## Milestone 3: Commercial Alpha

Goal: expand the vertical slice into a sellable game foundation.

### Modes
- [ ] Classic / Freeze Run
- [ ] Mission / Blend Task
- [ ] Custom Room settings
- [ ] Tutorial / Solo Practice

### Maps
- [ ] Station Front art pass
- [ ] Shopping Mall blockout
- [ ] Night Festival blockout

### Online
- [ ] Select networking solution
- [ ] Implement room creation
- [ ] Implement room join by code
- [ ] Sync player movement
- [ ] Sync light state
- [ ] Sync accusations
- [ ] Sync match result

### UI
- [ ] Title screen
- [ ] Lobby screen
- [ ] Gameplay HUD
- [ ] Result screen
- [ ] Settings screen
- [ ] Spectator UI

### Replay / Streaming
- [ ] Basic spectator mode
- [ ] Name display toggle
- [ ] Hide-role option
- [ ] Basic highlight replay candidate capture

---

## Milestone 4: Beta / Launch Preparation

### Content
- [ ] 3 maps playable
- [ ] 40+ NPC variants
- [ ] 15+ NPC behaviors
- [ ] 10+ disguise actions
- [ ] Character customization basics
- [ ] Achievements

### Platform
- [ ] Steam integration
- [ ] Steam invites
- [ ] Steam Cloud
- [ ] Controller support
- [ ] Steam Deck check

### QA
- [ ] Role assignment QA
- [ ] Light state sync QA
- [ ] Accusation QA
- [ ] NPC pathing QA
- [ ] Disconnect QA
- [ ] Balance QA
- [ ] Performance QA

### Marketing
- [ ] Steam capsule images
- [ ] Trailer script
- [ ] Gameplay trailer
- [ ] 15-second short video
- [ ] Press kit
- [ ] Store copy
- [ ] Discord setup

---

## Current Priority

Focus only on Milestone 1 unless explicitly told otherwise.

The first question is not whether the game is polished.

The first question is:

> Does it feel fun to hide in a crowd and freeze like an NPC while someone tries to spot you?
