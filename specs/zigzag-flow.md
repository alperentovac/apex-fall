# SPEC: ZIGZAG FLOW — Minimalist Rhythmic 2.5D Arcade

## Goal
Build **ZIGZAG FLOW**, a minimalist, fast-paced, highly rhythmic 2.5D isometric arcade game. A glowing ball advances automatically along an endless procedural zigzag path suspended in a deep void (`#090D18`). The player controls the ball using a single input (Tap / Space / Click) to alternate directions by 90 degrees (`+X` vs `+Y` in isometric space). Turns are evaluated using active segment and corner vector geometry (Perfect / Good / Miss) without artificial position snapping. A procedural Web Audio synthesizer dynamically builds musical layers as the Perfect combo climbs (piano notes, percussive rhythm, bassline, melodic flourishes, full Flow Mode). Features fixed-timestep physics, adaptive 60/120 FPS canvas rendering, minimal HUD, and zero-delay instant restart.

## Out of Scope
- Online multiplayer, remote matchmaking, or live ghost replays.
- Server-side account systems and cloud save sync (local storage only).
- Cosmetic shop, microtransactions, and unlockable skin customization (deferred to Phase 2).
- Automatic trajectory correction or center-snapping on turns (player momentum and position are preserved).
- Multi-directional free turning (strictly binary 2-axis alternating 90-degree switches).

## Acceptance Criteria
- Quality gate check: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1` returns `OK`.
- Unit tests: `npm test` executes and passes all tests in `tests/zigzag-flow.test.ts`.
- Production build: `npm run build` succeeds without TypeScript or Vite errors.
- End-to-End Gameplay Flow (`http://localhost:5180`):
  1. **Start Screen:** Minimalist dark canvas showing "TAP OR PRESS SPACE TO START", Score: 0, Best Score, and Best Combo.
  2. **Movement & Control:** First tap launches the ball along the starting segment. Every subsequent tap flips the velocity vector 90° (`[+vx, 0]` <-> `[0, +vy]`).
  3. **Vector Timing & Corner Evaluation:**
     - Checks the ball's position relative to the active segment and target corner $C_k = (x_k, y_k)$.
     - **Perfect:** Tap occurs within the tight apex tolerance ($d \le R_{\text{perfect}}$) while approaching or on the corner. Awards high score bonus, increments Perfect combo streak, triggers an ascending pentatonic note and subtle particle spark. Top position is not artificially snapped.
     - **Good:** Tap occurs on the corner platform tile but outside the Perfect radius ($R_{\text{perfect}} < d \le R_{\text{good}}$). Awards base survival points, resets Perfect combo counter to 0, plays a softer click, and steps down the active music tier by one level.
     - **Miss & Fall:** Tapping too early, turning away from the path, or failing to tap before rolling off the platform tile. Ball rolls off into the void and falls along the Z-axis under gravity.
  4. **Dynamic Speed & Human Reaction Scaling:**
     - Starts at an accessible tempo (1–2 turns/sec).
     - Speed ramps smoothly as distance increases.
     - Procedural path generator dynamically computes minimum segment lengths based on current velocity, guaranteeing players have sufficient physical reaction time (targeting 3–4 turns/sec mid-game, and short rhythmic bursts of 5–6 turns/sec in advanced flow sections).
  5. **Performance-Driven Tiered Audio (Web Audio API):**
     - **Combo 1–9:** Clean, crisp pentatonic piano/bell tones.
     - **Combo 10–24:** Light rhythmic hi-hat/percussion pulse layer.
     - **Combo 25–49:** Deep driving bass synthesizer layer.
     - **Combo 50–99:** Rich melodic arp and harmony layer.
     - **Combo 100+:** Full energetic "Flow Mode" with harmonic flourish and intensified glow.
     - On Good turn: Audio does not cut out abruptly; the musical intensity smoothly steps down by one tier.
  6. **Instant Restart & Minimal HUD:**
     - Ball drops for ~300ms, triggering subtle camera dip and clean game over state.
     - HUD displays: Top-left: Score, Top-center: Perfect Combo (`×24`), Top-right: Best Score & Best Combo.
     - Next tap or spacebar press restarts the game instantly with a clean seeded path and zero menu delay.

## Testing & Seams
- `tests/zigzag-flow.test.ts`:
  - `Path Generation Seam`: Validates procedural segment generation, forward-only progression, absence of overlapping tiles, and speed-adaptive minimum segment lengths.
  - `Vector Timing & Corner Seam`: Validates accurate detection of Perfect, Good, and Miss based on ball coordinates, heading, and corner boundaries; asserts that ball coordinates are never modified/snapped on turn.
  - `Combo & Audio Tier Seam`: Validates combo incrementing, combo reset on Good turn, and correct calculation of active musical layer tier (1-9, 10-24, 25-49, 50-99, 100+) including single-step tier degradation on Good turns.
  - `High Score & Persistence Seam`: Validates `localStorage` reading/writing for personal best score and highest combo.
- `scripts/check.ps1`:
  - Runs TypeScript compilation, Vitest test suite, and Vite production bundle.

## Plan: Vertical Slices
- [x] Slice 1: Core 2.5D Isometric Engine, Vector Timing & Instant Game Loop -> `verify: npm test and browser manual play on :5180`
  - Implement 2.5D isometric coordinate transformations (`worldToScreen`, `screenToWorld`).
  - Implement procedural zigzag path generator with speed-adjusted segment lengths.
  - Implement fixed-timestep physics loop and vector-based corner hit-testing (Perfect, Good, Miss) without position snapping.
  - Implement single-tap controls (Touch, Mouse Click, Spacebar) and zero-delay instant restart cycle.
  - Files touched: `src/types.ts`, `src/engine/world.ts`, `src/engine/physics.ts`, `src/main.ts`, `tests/zigzag-flow.test.ts`.

- [x] Slice 2: Tiered Performance-Driven Procedural Synth Engine -> `verify: npm test (audio tiers) and browser audio check`
  - Implement Web Audio synthesizer using pure oscillator and gain nodes (pentatonic note generation, percussion clicks, bass synth, harmonic arps).
  - Implement dynamic tier system (1-9 notes, 10-24 rhythm, 25-49 bass, 50-99 rich melody, 100+ Flow Mode) with smooth degradation on Good turns.
  - Connect corner timing events directly to musical feedback and milestone flourishes.
  - Files touched: `src/engine/audio.ts`, `src/main.ts`, `tests/zigzag-flow.test.ts`.

- [ ] Slice 3: Zen Arcade Visuals, Particle Juice, Smooth Camera & Local Persistence -> `verify: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1`
  - Style canvas with deep midnight navy background (`#090D18`), glowing geometric path tiles, neon ball trail, and restrained particle bursts on Perfect turns.
  - Implement smooth camera tracking (`lerp`) targeting 60 FPS on mobile and 120 FPS on high-refresh displays.
  - Render clean minimal HUD (Score, Combo, Best Score, Best Combo) and connect `localStorage` persistence.
  - Run full validation check script and ensure green status.
  - Files touched: `src/engine/render.ts`, `src/engine/juice.ts`, `src/engine/particles.ts`, `src/main.ts`, `index.html`, `docs/STATUS.md`.

## Open Questions
- None.
