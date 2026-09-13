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
| 5b | Drink button reads as a drink; laptop test rig | done |
| 6 | Auction Blitz | not started |
| 7 | Bloom | not started |

## Testing on a laptop

```
./start.sh
```

(or double-click `start.command` in Finder). It serves the folder on the first
free port from 8080 and opens the browser. Ctrl-C in that terminal stops it.

One simple key set drives **one player at a time** — everything you need to test
solo, without reaching for four keyboard layouts:

| key | does |
|-----|------|
| **space** | drink — hold it and the cup pours |
| **shift** | brace |
| **arrows** | cup size (◂ ▸) and game (▴ ▾) |
| **1 2 3 4** | switch which player you're driving |
| **T** | turn the test keys off, back to the 4-player cabinet layouts |
| **F1** or **`** | the test panel |
| **Esc** | pause |

So a two-player match by yourself is: `space` (P1 joins) → `2` → `space` (P2
joins) → `1` → `shift` (start) → hold `space` to pull.

The test panel (F1) shows the live drink source, fps, phase, and every cup's
ml/sec, effective rate, level and percentage, plus whatever the running game
wants to show — for Tug of War that's per-player fatigue, pull and brace, and
the rope's position, velocity and tension. **FILL** and **EMPTY** set a cup
instantly so you don't have to drink a whole one to see what dry looks like.

Set `input.test.enabled: false` in `src/config.js` for the cabinet.

## The drink button

There is no flow sensor yet, so **the DRINK button is the sensor**. Hold it and
the cup pours at `drink.syntheticRateMlPerSec` (12 ml/s, ramped over a quarter
second), the figure lifts its cup to its head, tips back and gulps, and the
level drops — in the cup in its hand, in its gauge, and in the test panel.

Nothing above `src/drink-backends/button-hold.js` knows it was a button. When
the sensor exists, change one import line in `src/drink.js` and every game,
gauge and cup keeps working.

## Playing on the cabinet

Press **DRINK** to join, ◂ ▸ for cup size, ▴ ▾ for the game, **ACTION** to
start. In a round: hold **DRINK** to pull, hold **ACTION** to brace. When
you're dry you brace automatically, harder. At TOP UP, tap ACTION to go into
the next round as you are, or hold it to refill. **PAUSE** works from anywhere.

Four keyboard layouts stand in for the four cabinet sticks:

| slot | move | drink | action |
|------|------|-------|--------|
| P1 | W A S D | Q | E |
| P2 | ↑ ← ↓ → | , | . |
| P3 | I J K L | U | O |
| P4 | Num 8 4 5 6 | Num 7 | Num 9 |

## Running without the script

`gamepad-test.html` is a single file with no imports: open it straight from
disk in Chrome or Firefox. Press any button on each stick to make the browser
expose it.

The game uses ES modules, which Chrome refuses over `file://`. Any static
server works:

```
python3 -m http.server 8080
# or
npx http-server . -p 8080
```

then open `http://localhost:8080/`. Firefox will also open `index.html` from disk.

## Gamepad mappings

`gamepad-test.html` writes mappings to `localStorage` under
`cabinet.gamepadMappings.v1`. The game reads the same key, so bind on the
cabinet's browser profile once and it sticks. Use **Show JSON** on the test
page to copy a mapping between machines.
