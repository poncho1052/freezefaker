# Freeze Faker Input Spec v0.1

This is the initial input specification for the first playable build.

---

## 1. Input Principles

- Controls should be simple enough for casual party-game players.
- Faker controls should feel close to a third-person character controller.
- Watcher controls should feel like an observation camera, not an FPS weapon.
- Accusation should feel like pointing out a suspicious person, not shooting.

---

## 2. Faker Controls

| Action | Keyboard / Mouse | Gamepad Candidate |
|---|---|---|
| Move | WASD | Left Stick |
| Camera | Mouse | Right Stick |
| Walk / Jog | Shift | Left Stick press / shoulder |
| Interact | F | A / Cross |
| NPC Sync | E | Y / Triangle |
| Open Action Wheel | Q | Left bumper |
| Select Action | 1〜5 or mouse | Right stick / face buttons |
| Cancel | Esc | B / Circle |
| Pause | Esc | Start |

---

## 3. Watcher Controls

| Action | Keyboard / Mouse | Gamepad Candidate |
|---|---|---|
| Pan Camera | WASD / edge pan | Left Stick |
| Look / Aim | Mouse | Right Stick |
| Zoom | Mouse Wheel | Triggers |
| Pin Target | Right Click | Left bumper |
| Accuse Target | Left Click | Right trigger |
| Replay Hint | R | Y / Triangle |
| Camera Switch | Tab | D-pad |
| Cancel | Esc | B / Circle |
| Pause | Esc | Start |

---

## 4. Spectator Controls

| Action | Keyboard / Mouse | Gamepad Candidate |
|---|---|---|
| Next Player | E | Right bumper |
| Previous Player | Q | Left bumper |
| Free Camera | C | Y / Triangle |
| Toggle UI | H | D-pad up |
| Exit Spectate | Esc | B / Circle |

---

## 5. Input Notes

### Faker
Faker should not have too many actions visible at once. The first build can use number keys instead of a polished action wheel.

Initial action slots:

1. Phone
2. Look Sign
3. Bench Sit
4. Vending
5. Look Around

### Watcher
Watcher targeting should prioritize clarity.

Implementation options:

- Raycast from camera to character collider
- Highlight target on hover
- Confirm accusation on click
- Disable accusation outside Red Light, or show warning

### Accessibility
Future settings should include:

- Mouse sensitivity
- Camera sensitivity
- Invert Y
- Controller support
- Remappable controls
- HUD scale

---

## 6. First Build Minimum

For the first playable build, only these are required:

Faker:

- Move
- Camera
- Interact / goal trigger

Watcher:

- Camera movement
- Zoom if easy
- Click to accuse

Shared:

- Pause / restart debug control
