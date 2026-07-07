# Freeze Faker Screen List v0.1

This document lists game screens for planning and implementation.

---

## 1. First Build Screens

These are required for the first playable vertical slice.

## 01_Title
Purpose:

- Start the game
- Enter prototype scene
- Access settings if available

Minimum elements:

- Freeze Faker logo
- Start / Play button
- Settings button optional
- Quit button optional

---

## 02_Lobby
Purpose:

- Prepare match
- Select role in local prototype or show assigned role

Minimum elements:

- Player list placeholder
- Role display
- Start match button
- Map name: Station Front
- Mode name: Classic / Freeze Run

---

## 03_Gameplay_Faker
Purpose:

- Main Faker gameplay HUD

Minimum elements:

- Current light state
- Round timer
- Goal indicator
- NPC Sync cooldown if implemented
- Action slots if implemented
- Simple role label

---

## 04_Gameplay_Watcher
Purpose:

- Main Watcher gameplay HUD

Minimum elements:

- Current light state
- Round timer
- Marks left
- Hover target highlight
- Accusation prompt
- Simple role label

---

## 05_Result
Purpose:

- Show round outcome

Minimum elements:

- Winning side
- Reason for win
- Correct accusations
- False accusations
- Faker reached goal or not
- Rematch / restart button
- Back to lobby button

---

## 06_Settings
Purpose:

- Adjust basic game settings

Minimum elements for first build:

- Mouse sensitivity
- Volume
- Window mode optional
- Back button

---

## 2. Commercial Alpha Screens

These are needed after the first playable build.

## 07_Tutorial
Purpose:

- Teach controls and rules

Sections:

- Faker basics
- Watcher basics
- Green / Red Light
- NPC Sync
- Accusation

---

## 08_CustomRoom
Purpose:

- Configure room rules

Settings:

- Map
- Mode
- Round time
- NPC count
- Faker count
- Watcher marks
- Light timing
- NPC Sync on/off
- Mission on/off

---

## 09_Spectator
Purpose:

- Watch active match

Elements:

- Camera mode
- Current target
- Light state
- Remaining time
- Name display toggle
- Role visibility toggle for streamer mode

---

## 10_Replay
Purpose:

- Watch match highlights

Elements:

- Timeline
- Accusation events
- False accusation events
- Faker goal events
- Identity reveal

---

## 11_CharacterCustomize
Purpose:

- Customize player appearance without breaking gameplay readability

Elements:

- Hair
- Hat
- Glasses
- Outfit
- Bag
- Color variants
- Preview in crowd

---

## 12_Achievements
Purpose:

- Display achievements / progress

Elements:

- Achievement list
- Progress indicators
- Unlock status

---

## 13_Credits
Purpose:

- Show credits and licenses

---

## 3. UI Style Notes

- Red Light / Green Light state must be readable at a glance.
- UI must not cover the crowd too heavily.
- Watcher UI can use surveillance-eye and reticle motifs.
- Faker UI should feel lighter and less aggressive.
- Use red for danger/Red Light, green for safe/Green Light, amber for warnings.

---

## 4. First Implementation Priority

Build only:

1. Title
2. Lobby or debug start screen
3. Gameplay Faker
4. Gameplay Watcher
5. Result

Settings can be minimal or postponed if needed.
