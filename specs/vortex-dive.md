# SPEC: Vortex Dive - Infinite Neon Freefall & Color Ring Smasher

## Goal
Transform the game entirely into a high-speed downward freefall arcade experience ("Vortex Dive"): the player plunges vertically through an infinite tunnel of rotating neon color rings with pass-through gap holes and dangerous obstacle segments. Navigating multiple rings without collision triggers a "Meteor Fireball Dive" that smashes through obstacles with intense visual and audio juice. Supports touch drag, mouse flick, keyboard steering, and an optional toggleable device tilt (gyroscope) mode.

## Out of Scope
- Full 3D rendering engine (keeps ultra-smooth 120 FPS via 2.5D Canvas perspective).
- Multiplayer live races.
- In-app purchases.

## Acceptance Criteria
- Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1` -> returns `OK`.
- Running `npm run dev` and opening `http://localhost:5180`:
  - Player character continuously falls downward with gravity and aerodynamic trail.
  - Spaced neon rings appear below, each with safe open gap arc(s) and red hazard arc(s).
  - Touching/dragging or moving mouse rotates the rings smoothly around the center.
  - Passing through a ring gap increments depth count, score, and combo multiplier.
  - Clearing 3+ rings consecutively without touching safe landing pads ignites "Meteor Fireball Dive", smashing through the next hazard cleanly.
  - Hitting a hazard segment triggers an instant shatter explosion and immediate single-tap restart.
  - A settings toggle button allows enabling "Device Tilt Control" (using `DeviceOrientationEvent.gamma` on mobile).

## Testing & Seams
- `tests/game.test.ts`:
  - `Ring Generation & Angular Seam`: Tests that rings generate with non-overlapping safe gaps and hazard angles, progressing in difficulty.
  - `Angular Collision & Freefall Seam`: Tests angular collision detection against ring arcs and gap passages.
  - `Meteor Fireball State Seam`: Verifies that consecutive gap passings trigger Meteor mode and award bonus multiplier.
- `scripts/check.ps1`:
  - Runs typecheck, vitest unit tests, and vite production build.

## Plan: Vertical Slices
- [ ] Slice 1: Ring Geometry & Freefall Physics Engine -> `verify: npm test (angular collision, gap passing, meteor streak)`
  - Replace platform generation with procedural `Ring` data structure (radius, rotation, gapStartAngle, gapEndAngle, hazardStartAngle, hazardEndAngle).
  - Implement downward freefall physics, rotational ring controls (touch/drag/keys/tilt), and angular hit-testing.
  - Files touched: `src/types.ts`, `src/engine/world.ts`, `src/engine/physics.ts`, `tests/game.test.ts`.

- [ ] Slice 2: Neon Ring Render, Meteor Juice & Procedural Sound -> `verify: npm run build and browser visual check on :5180`
  - Render glowing neon arc rings, pass-through indicators, and player diving trail.
  - Implement Meteor Fireball aura, ring shatter fragments, and deep whoosh/synth passage audio.
  - Files touched: `src/engine/juice.ts`, `src/engine/particles.ts`, `src/engine/audio.ts`.

- [ ] Slice 3: Controls, Tilt Gyroscope Settings & Cloudflare Deploy -> `verify: powershell -NoProfile -File scripts/check.ps1 and git push / wrangler pages deploy`
  - Implement responsive touch drag, mouse movement, keyboard (A/D/Arrows), and Gyroscope tilt listener with a sleek HUD toggle.
  - Validate with automated browser test and update Cloudflare Pages production deployment.
  - Files touched: `index.html`, `src/main.ts`, `docs/STATUS.md`.

## Open Questions
- None.
