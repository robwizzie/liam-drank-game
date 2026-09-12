# Arcade drinking games cabinet

Three local-multiplayer party games for a custom arcade cabinet, sharing one
launcher and one set of systems. Drinking is a game mechanic, not a penalty.

Plain HTML + JS + Canvas 2D. No build step, no framework, no dependencies.

## Status

| gate | deliverable | state |
|------|-------------|-------|
| 1 | File structure and module contracts — `docs/ARCHITECTURE.md` | approved |
| 2 | `gamepad-test.html` — verify on the real cabinet | built; cabinet check pending |
| 3 | Visual design plan — `docs/DESIGN.md` | approved: Enamel Sign |
| 4 | Shared systems + Tug of War, keyboard-playable | done |
| 5 | Tug of War, final visuals + audio | done, awaiting play test |
| 6 | Auction Blitz | not started |
| 7 | Bloom | not started |

## Playing Tug of War on a keyboard

1. Serve the folder (below) and open it. Press **Q** to join as P1, **,** (comma) as P2, **U** as P3, **Numpad 7** as P4.
2. **Left/right** on your keys cycles cup size. **Up/down** picks a game. **E** (P1's action) starts.
3. Hold your **drink** key to pull. Hold your **action** key to brace. When you're dry you brace automatically, harder.
4. TOP UP: tap action to go into the next round as you are, hold it to refill. **Esc** pauses from anywhere.

## Running

`gamepad-test.html` is a single file with no imports: open it straight from
disk in Chrome or Firefox. Press any button on each stick to make the browser
expose it.

The game itself (from gate 4) uses ES modules, which Chrome refuses over
`file://`. Serve the folder with anything static:

```
npx http-server . -p 8080
# or
python3 -m http.server 8080
```

then open `http://localhost:8080/`. Firefox will also open `index.html` from disk.

## Gamepad mappings

`gamepad-test.html` writes mappings to `localStorage` under
`cabinet.gamepadMappings.v1`. The game reads the same key, so bind on the
cabinet's browser profile once and it sticks. Use **Show JSON** on the test
page to copy a mapping between machines.
