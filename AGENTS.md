# apex-fall

<Purpose: one sentence, observable outcome.>

## Commands
- Check (before handoff): `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1` -> `OK` or `FAIL: <step>`; details in `.check.log`.
- <run / build / test / deploy commands>

## Traps
- <non-obvious things actually hit, not guessable from code>

## Docs
- `docs/STATUS.md`: read at session start. Anything agreed for later goes under Next right away. Now holds unfinished work only: when an item is done, delete it, don't log it (git log keeps history).
- `SPEC.md` (if present): the current task spec. `docs/adr/`: past decisions; read before changing a related area.

## Handoff
Check result, diff summary, anything not run; `docs/STATUS.md` updated.
