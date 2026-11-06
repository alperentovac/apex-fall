# SPEC: Hyper Rocket Overdrive & Minimalist Arcade HUD

## Goal
Transform the UI into a zero-clutter, dynamic neon arcade interface and introduce the "Hyper Rocket Overdrive" skill mechanic: collecting gems and landing combos fills an Overdrive energy tube (%0 -> %100). When full, the player activates a 2.5s rocket blast that pierces upward through 15-25 floors with invulnerability, intense fire particles, screen warp, and massive bonus multiplier.

## Out of Scope
- Permanent shop / upgrade tree persistence between runs (kept purely within the session run loop).
- Multiplayer leaderboards or networking.
- Soundtracks with licensed audio (procedural synth Web Audio will generate the rocket thruster sound).

## Acceptance Criteria
- Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1` -> returns `OK`.
- Running `npm run dev` and opening `http://localhost:5180`:
  - HUD is stripped of all grey boxes, label texts ("Floor", "Combo", "Sparks"), displaying only crisp glowing numeric counters (`0F`, `x1.0`).
  - A glowing vertical neon energy meter appears on screen, filling with each gem collected (+15%) and successful climb (+5%).
  - At 100%, an interactive pulsating neon rocket icon illuminates, and pressing `E`, clicking the icon, or double-tapping triggers the Overdrive.
  - During Overdrive: The character ignites a thruster flame particle cone, shoots vertically at extreme velocity (~2200 px/s), ignores collisions/hazards, shakes the screen, and smoothly decelerates at the peak.

## Testing & Seams
- `tests/game.test.ts`:
  - `Overdrive Charge Seam`: Verifies gem collection and combo landing increments energy meter and clamps at 100%.
  - `Overdrive Activation & Physics Seam`: Verifies activating overdrive sets player into invincible rocket state, applies sustained upward thrust, drains meter, and reverts to normal state after 2.5s.
- `scripts/check.ps1`:
  - Runs typecheck, vitest unit tests, and vite production build.

## Plan: Vertical Slices
- [ ] Slice 1: Energy & Overdrive State Engine -> `verify: npm test (overdrive state transitions, meter math, physics boost)`
  - Add overdrive charge state, energy decay/gain logic to `Player` interface in `src/types.ts`.
  - Implement rocket boost physics, invulnerability flag, and thruster particle spawner in `src/engine/physics.ts` and `src/engine/particles.ts`.
  - Add procedural synth rocket roar sound in `src/engine/audio.ts`.
  - Files touched: `src/types.ts`, `src/engine/physics.ts`, `src/engine/particles.ts`, `src/engine/audio.ts`, `tests/game.test.ts`.

- [ ] Slice 2: Minimalist Neon HUD & Energy Tube Render -> `verify: npm run build and browser visual check on :5180`
  - Strip HTML text labels and background boxes from `index.html`.
  - Implement canvas-drawn or sleek SVG/HTML vertical glowing neon charge tube.
  - Add pulsing rocket activation button with hotkey `E` / touch trigger.
  - Files touched: `index.html`, `src/main.ts`, `src/engine/juice.ts`.

- [ ] Slice 3: End-to-End Overdrive Juice & Acceptance Check -> `verify: powershell -NoProfile -File scripts/check.ps1`
  - Connect full loop: Gem collect -> charge meter -> activation -> rocket thruster VFX -> floor blast -> smooth landing transition.
  - Run Playwright test in headless browser to confirm zero console errors and take screenshots.
  - Files touched: `src/main.ts`, `scripts/check.ps1`, `docs/STATUS.md`.

## Open Questions
- None.
