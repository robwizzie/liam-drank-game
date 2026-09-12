# Arcade drinking games cabinet

Three local-multiplayer party games for a custom arcade cabinet, sharing one
launcher and one set of systems. Drinking is a game mechanic, not a penalty.

Plain HTML + JS + Canvas 2D. No build step, no framework, no dependencies.

## Status

| gate | deliverable | state |
|------|-------------|-------|
| 1 | File structure and module contracts — `docs/ARCHITECTURE.md` | awaiting sign-off |
| 2 | `gamepad-test.html` — verify on the real cabinet | awaiting cabinet test |
| 3 | Visual design plan — `docs/DESIGN.md` | awaiting direction choice |
| 4 | Shared systems + Tug of War, placeholder visuals | not started |
| 5 | Tug of War, final visuals + audio | not started |
| 6 | Auction Blitz | not started |
| 7 | Bloom | not started |

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
