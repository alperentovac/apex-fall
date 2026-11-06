# apex-fall

High-dopamine vertical climbing rage-game with exponential multipliers, procedural synth audio, and brutal drop penalties (Only Up / Jump King mechanics meets Flappy Bird arcade juice).

## Commands
- Check (before handoff): `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1` -> `OK` or `FAIL: <step>`; details in `.check.log`.
- Run Dev Server: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Typecheck: `npm run typecheck`

## Traps
- AudioContext requires an initial user interaction (click/touch/key) before it can emit sounds; initialized safely on first input.
- One-way platforms only trigger collision when falling downwards (`vy > 0`) to prevent snagging during upward jumps.
- Physics clamping: Delta time is capped at 50ms in the game loop to avoid physics tunneling during tab switches or frame drops.

## Docs
- `docs/STATUS.md`: read at session start. Anything agreed for later goes under Next right away. Now holds unfinished work only: when an item is done, delete it, don't log it (git log keeps history).
- `SPEC.md` (if present): the current task spec. `docs/adr/`: past decisions; read before changing a related area.

## Handoff
Check result, diff summary, anything not run; `docs/STATUS.md` updated.
