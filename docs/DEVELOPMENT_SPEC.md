# Freeze Faker Development Spec v0.1

This document translates the product concept into an implementation-oriented specification for engineers, designers, and development partners.

---

## 1. Core Implementation Goal

Build a commercial online multiplayer party game where:

- Fakers move through a crowd of NPCs.
- Red Light causes everyone to freeze.
- Fakers must freeze in a way that looks natural for an NPC.
- Watcher identifies suspicious human-like characters.

The core technical challenge is not only multiplayer movement. The game depends on a readable crowd simulation where NPCs create a behavioral baseline and Fakers can deviate from it in subtle, funny, and observable ways.

---

## 2. Player Roles

## 2.1 Faker
Human player hiding among NPCs.

Primary goals:

- Reach the goal or complete assigned missions.
- Blend into NPC movement patterns.
- Freeze naturally during Red Light.
- Avoid Watcher accusation.

Core controls:

- Move
- Camera rotate
- Walk / light jog
- Stop / freeze
- Open action wheel
- Trigger disguise action
- Trigger NPC Sync
- Interact with mission objects

## 2.2 Watcher
Human player observing the crowd.

Primary goals:

- Detect Fakers.
- Accuse suspicious characters during Red Light.
- Avoid false accusations.

Core controls:

- Move camera
- Zoom
- Pan / rotate observation view
- Pin suspicious target
- Accuse target
- Use limited replay / camera hint
- Switch camera angle if enabled

## 2.3 NPC
Non-player crowd character.

Primary goals:

- Establish believable crowd patterns.
- Provide camouflage for Fakers.
- Provide comparison baseline for Watcher.
- Freeze naturally during Red Light.

---

## 3. Match Structure

## 3.1 Match Setup
Inputs:

- Map
- Game mode
- Player count
- Faker count
- NPC count
- Round timer
- Light cycle settings
- Watcher accusation limit
- Mission settings

Default Classic setup:

- 1 Watcher
- 3〜7 Fakers
- 40〜80 NPCs
- 3-minute round
- Green Light: 8〜15 seconds
- Red Light: 5〜8 seconds
- Red Light warning: 0.8〜1.5 seconds

## 3.2 Match Flow
1. Lobby assigns roles.
2. Players load into map.
3. Fakers spawn among or near NPC crowd.
4. Watcher starts at observation position.
5. Countdown starts.
6. Light cycle begins.
7. Fakers progress toward goal or missions.
8. Red Light freezes NPCs and restricts Faker movement.
9. Watcher accuses during Red Light.
10. Round ends when win condition is met.
11. Result screen reveals identities and key moments.

---

## 4. State Machine

## 4.1 Match States
- Lobby
- Loading
- IntroCountdown
- GreenLight
- RedLightWarning
- RedLight
- AccusationResolution
- RoundEnd
- Result
- Rematch / ReturnToLobby

## 4.2 Player States: Faker
- Idle
- Walking
- Jogging
- MimicAction
- NPCSync
- Frozen
- Accused
- Eliminated
- GoalReached
- Spectating

## 4.3 Player States: Watcher
- Observing
- Zooming
- Pinning
- Accusing
- ReplayReview
- Penalized
- Result

## 4.4 NPC States
- Walking
- Waiting
- PerformingAction
- PathTransition
- Frozen
- ResumeAction

---

## 5. Green / Red Light System

## 5.1 Green Light
During Green Light:

- NPCs follow behavior trees / schedules.
- Fakers can move and perform disguise actions.
- Watcher can observe and pin, but default rules should prevent accusations.
- Mission interactions are available.

## 5.2 Red Light Warning
A short warning phase before freeze.

Effects:

- Audio cue
- Signal animation
- UI warning
- Optional slight NPC speed adjustment

Purpose:

- Give Fakers a small chance to prepare.
- Preserve tension without making the freeze too easy.

## 5.3 Red Light
During Red Light:

- NPCs enter Frozen state using context-appropriate poses.
- Fakers must stop.
- Faker movement beyond tolerance increases suspicion and may trigger penalty.
- Watcher can accuse.
- Accusation resolution occurs immediately or after a brief reveal animation.

---

## 6. NPC Crowd System

## 6.1 NPC Goals
NPCs must be readable, predictable enough to mimic, and varied enough to feel like a crowd.

NPCs should not be hyper-realistic. They should have mild regularity so Fakers can learn and imitate them.

## 6.2 NPC Behavior Categories
Initial required behaviors:

1. Walk to destination
2. Wait at crosswalk
3. Look at phone
4. Look at shop window
5. Check vending machine
6. Sit on bench
7. Look at sign
8. Read newspaper
9. Adjust bag
10. Stand in queue
11. Wait near bus stop
12. Enter / exit shop area
13. Avoid nearby characters
14. Pause at plaza
15. Resume movement after Red Light

## 6.3 NPC Scheduling
Each NPC should have:

- Archetype
- Current behavior
- Target location
- Movement speed range
- Idle action list
- Freeze pose set
- Resume delay range

## 6.4 NPC Freeze Pose
During Red Light, NPC chooses freeze pose based on current context.

Examples:

- Walking NPC: mid-step or natural standing pause
- Phone NPC: phone-looking pose
- Bench NPC: seated pose
- Vending NPC: facing machine pose
- Queue NPC: forward-facing waiting pose
- Shop NPC: looking-at-display pose

## 6.5 NPC Resume
After Red Light ends, NPCs should not all resume in the exact same frame.

Use small staggered delay:

- 0.0〜0.5 seconds random resume offset

This creates natural visual flow while preserving the satisfying freeze moment.

---

## 7. Faker Systems

## 7.1 Movement
Faker movement should include:

- Walk speed: similar to NPC speed
- Jog speed: faster but increases suspicion
- Turn rate: slightly limited to avoid unnatural snapping
- Collision handling with NPCs
- Contextual slowdown near dense crowds

## 7.2 Disguise Action Wheel
Faker can open an action wheel or action bar.

Launch actions:

1. Phone
2. Shop Look
3. Vending
4. Bench Sit
5. Wait
6. Look Sign
7. Newspaper
8. Bag Adjust
9. Stretch
10. Look Around

Each action has:

- Required context
- Animation
- Duration
- Suspicion modifier
- Cooldown if needed

## 7.3 Action Context Validation
Actions should be evaluated based on environment.

Examples:

- Vending is natural near vending machine.
- Vending is suspicious away from vending machine.
- Bench Sit requires bench interaction point.
- Chat requires nearby person or NPC.
- Queue requires queue zone.

Implementation suggestion:

- Place contextual interaction volumes in map.
- Each volume exposes valid action tags.
- Action score is based on match between selected action and current zone.

## 7.4 NPC Sync
NPC Sync allows Faker to copy or align with nearby NPC behavior.

Inputs:

- Target NPC
- Distance
- Target behavior
- Current light state
- Cooldown

Effects:

- Align facing direction
- Match walking speed
- Copy idle pose
- Copy context action

Constraints:

- Cooldown after use
- Cannot sync with invalid NPC states
- Long sync duration may look suspicious
- Duplicate behavior near target NPC can create visual oddness intentionally

Suggested cooldown:

- 10〜20 seconds

---

## 8. Suspicion System

## 8.1 Purpose
Suspicion is an internal system that supports feedback and balancing.

It should not replace human observation. It should guide feedback and create risk.

## 8.2 Suspicion Inputs
Suspicion increases when Faker:

- Moves after Red Light
- Jog/runs too often
- Turns sharply
- Collides with NPC
- Uses action in invalid context
- Stops at unnatural location
- Faces wrong direction during Red Light
- Stands too close or too far from crowd flow
- Performs repeated actions
- Remains in one place too long

Suspicion decreases when Faker:

- Uses valid context action
- Syncs with NPC successfully
- Follows crowd speed
- Freezes in natural zone
- Faces consistent direction
- Maintains proper spacing

## 8.3 Faker Feedback
Faker may see a subtle suspicion indicator.

Possible UI:

- Small heart / tension meter
- Color shift around player reticle
- Small vibration / pulse

## 8.4 Watcher Feedback
Watcher should not see suspicion values.

Watcher should rely on visual behavior.

Possible exception:

- In tutorial only, suspicious characters may be highlighted for learning.

---

## 9. Watcher Systems

## 9.1 Observation Camera
Recommended default:

- Elevated semi-top-down camera
- Smooth pan and zoom
- Can rotate within constraints

Alternative map-specific cameras:

- CCTV camera nodes
- Street-level zoom view
- Replay camera

## 9.2 Pin System
Watcher can mark suspicious characters without accusing.

Pin properties:

- Local to Watcher
- Limited count or unlimited, depending on balance
- Does not affect target
- Helps tracking during Red Light

## 9.3 Accusation
Watcher selects a character and confirms accusation.

Resolution:

- If target is Faker: target eliminated or revealed
- If target is NPC: false accusation penalty

## 9.4 False Accusation Penalties
Configurable options:

- Lose one mark
- Temporary visual noise
- Reduced Red Light time
- Score penalty
- Immediate loss after 3 false accusations

Default:

- Limited marks. False accusations consume marks.

---

## 10. Mission System

## 10.1 Mission Types
Possible Faker missions:

- Reach goal
- Visit location
- Perform valid action
- Collect stamp
- Wait in zone during Red Light
- Interact with object
- Follow NPC path briefly

## 10.2 Mission Visibility
Fakers see their own mission objectives.
Watcher should not directly see mission targets unless custom rules allow it.

## 10.3 Mission Balance
Missions should force movement and risk.

A good mission:

- Requires crossing visible areas
- Offers multiple paths
- Encourages contextual disguise actions
- Creates moments for Watcher to observe

---

## 11. Map Implementation Requirements

Each map requires:

- Navmesh / pathing graph
- NPC spawn zones
- Faker spawn zones
- Watcher camera bounds
- Goal zones
- Mission zones
- Context action zones
- Occlusion / visibility tuning
- Crowd density tuning
- Red Light visual signal locations

## 11.1 Station Front Required Zones
- Station gate goal
- Crosswalk zone
- Vending machine zone
- Convenience store zone
- Cafe zone
- Bench zone
- Bus stop zone
- Signboard zone
- Queue zone
- Plaza pathing zone

## 11.2 Shopping Mall Required Zones
- Food court
- Escalator area
- Shop display zones
- Benches
- Queue zones
- Open atrium
- Goal exits

## 11.3 Night Festival Required Zones
- Food stalls
- Queue areas
- Lantern street
- Shrine / gate point
- Bench / rest zone
- Crowd bottleneck
- Goal exit

---

## 12. UI Requirements

## 12.1 In-match HUD
Required for Fakers:

- Current light state
- Round timer
- Objective / goal direction
- NPC Sync cooldown
- Disguise action wheel
- Subtle suspicion feedback
- Alive teammates count

Required for Watcher:

- Current light state
- Round timer
- Accusation marks left
- Pinned targets
- Zoom state
- Replay hint count
- Faker remaining count if rules allow

## 12.2 Lobby UI
- Create room
- Join room
- Room code
- Player list
- Ready button
- Role assignment settings
- Map selection
- Mode selection
- Custom rule settings

## 12.3 Result UI
Display:

- Winning side
- Faker identities
- Watcher performance
- Faker survival times
- Correct accusations
- False accusations
- Best Faker
- Best Watcher
- Highlight replay links

## 12.4 Spectator UI
- Current target
- Camera switching
- Light state
- Remaining time
- Name display toggle
- Hide roles for streaming

---

## 13. Online Multiplayer Requirements

## 13.1 Required
- Online multiplayer sessions
- Public matchmaking
- Private room by code
- Friend invite support
- Host migration or graceful room close
- Reconnect handling
- Region selection
- Player ready states

## 13.2 Network Sync Priorities
High priority:

- Player position
- Player action state
- Light state
- Accusation events
- Eliminations
- Mission completion

Medium priority:

- NPC positions near players / camera
- NPC action state
- Pins
- UI timer sync

Low priority:

- Cosmetic details
- Distant NPC minor animation offsets
- Ambient props

## 13.3 Anti-cheat / Fairness Considerations
Risks:

- Faker identity leakage
- Client-side role visibility
- Position hacks
- Spectator role spoilers

Basic rules:

- Role authority should be server-side.
- Accusation validation should be server-side.
- Mission completion should be server-side.
- Clients should not receive unnecessary hidden role metadata for non-owned characters.

---

## 14. Replay / Highlight Requirements

## 14.1 Basic Replay
Store short rolling buffer for key events.

Capture moments:

- Red Light start
- Accusation
- False accusation
- Faker goal
- Last Faker survival
- Suspicion spike if used

## 14.2 Result Highlights
After match, allow players to view:

- Best accusation
- Worst false accusation
- Smoothest Faker survival
- Final reveal

## 14.3 Streamer Utility
Options:

- Hide names
- Hide roles
- Show role reveal only at end
- Disable chat
- Clean HUD mode

---

## 15. Audio Requirements

Required sound categories:

- Green Light start
- Red Light warning
- Red Light start
- NPC freeze snap
- Accusation select
- Correct accusation
- False accusation
- Faker eliminated
- Faker goal reached
- NPC Sync start
- NPC Sync end
- Penalty
- UI navigation
- Result win / lose

Audio tone:

- Urban
- Playful
- Tense during Red Light
- Not horror
- Not military
- Stream-friendly

---

## 16. Art Implementation Notes

## 16.1 Character Production
Characters should be modular.

Modular parts:

- Head
- Hair
- Upper body
- Lower body
- Shoes
- Bag
- Hat
- Glasses
- Accessory

NPC and player characters should share the same base system.

## 16.2 Readability Rules
- Silhouettes must remain readable from elevated camera.
- Faces should be simple.
- Clothing should be muted.
- Extreme skins should be avoided.
- Animation poses must be readable from distance.

## 16.3 Animation Requirements
Core animation set:

- Idle neutral
- Walk
- Jog
- Stop / freeze transition
- Phone
- Shop look
- Vending look
- Bench sit
- Wait
- Look sign
- Newspaper
- Bag adjust
- Look around
- Accused reaction
- Goal success

---

## 17. Accessibility and Settings

Required settings:

- Mouse sensitivity
- Camera sensitivity
- Volume controls
- Display mode
- Resolution
- Language
- Colorblind-friendly signal mode
- Subtitles for announcements
- HUD scale
- Name display toggle
- Controller support

Colorblind considerations:

- Red / Green should also use icons and shapes.
- Red Light and Green Light must be distinguishable without color alone.

---

## 18. Localization

Initial languages:

- English
- Japanese

Future candidates:

- Korean
- Simplified Chinese
- Traditional Chinese
- Spanish
- French
- German

Text should be simple and short because the game relies on visual understanding.

---

## 19. Steam Integration

Required:

- Steam achievements
- Steam friends invite support
- Steam overlay compatibility
- Steam Cloud for settings / progression
- Steam Deck compatibility target if feasible

Recommended:

- Rich presence
- Join game from friends list

---

## 20. QA Focus Areas

Critical QA:

- Role assignment consistency
- Light state sync
- Accusation accuracy
- False accusation handling
- NPC pathing stuck cases
- NPC and player collision
- Reconnect / disconnect
- Match end conditions
- Custom room settings
- Replay correctness
- Spectator role leakage

Gameplay QA:

- Watcher too strong / too weak
- Faker movement too obvious / too invisible
- Red Light warning too easy / too hard
- NPC Sync too powerful / useless
- Map visibility balance
- Mission risk balance

---

## 21. Development Milestones

## Milestone 1: Core Prototype
- One map graybox
- Faker movement
- Watcher camera
- NPC walking
- Green / Red Light
- Basic accusation
- Basic win condition

## Milestone 2: Playable Vertical Slice
- Station Front art pass
- 40 NPCs
- 5+ disguise actions
- NPC Sync
- UI HUD
- Private room multiplayer
- Result screen

## Milestone 3: Commercial Alpha
- 3 maps blocked in
- Online matchmaking
- Tutorial
- 10+ disguise actions
- 15+ NPC behaviors
- Replay basics
- Spectator mode

## Milestone 4: Beta
- Full content pass
- Performance optimization
- Steam integration
- Achievements
- Localization EN/JA
- QA pass
- Streamer settings

## Milestone 5: Launch Candidate
- Store assets
- Trailer
- Bug fixing
- Balance pass
- Press kit
- Release build

---

## 22. Non-negotiable Product Pillars

1. The rule must be understandable in 10 seconds.
2. Red Light freeze moments must look satisfying.
3. The crowd must be readable.
4. Faker and Watcher must both be fun.
5. False accusations must be funny, not only frustrating.
6. The game must create short-video moments naturally.
7. The design must avoid becoming generic NPC hide-and-seek.
8. The core is human-like body language, not only movement detection.

---

## 23. Core Tagline for Development

> If the player only stops moving, the game is not finished.  
> The player must stop like an NPC.

