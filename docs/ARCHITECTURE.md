# Architecture — file structure and module contracts

**Gate 1 deliverable.** No game code exists yet. This document is the contract
the rest of the build is held to. If a later gate needs to change something
here, the doc changes first.

---

## File tree

```
liam-drank-game/
├── index.html                # the cabinet app: one <canvas>, one <script type="module" src="src/main.js">
├── gamepad-test.html         # standalone diagnostic; zero imports from src/ (gate 2)
├── start.sh                  # serve + open a browser; the laptop entry point
├── start.command             # the same, double-clickable in Finder
├── README.md
├── docs/
│   ├── ARCHITECTURE.md       # this file
│   └── DESIGN.md             # visual plan, 3 directions (gate 3)
└── src/
    ├── main.js               # boot: canvas, rAF loop, screen stack, global pause
    ├── config.js             # EVERY tunable constant, grouped by system
    ├── canvas.js             # logical resolution, letterbox scaling, safe-area rect
    ├── input.js              # gamepad + keyboard unification, mappings, held/justPressed/axis
    ├── drink.js              # the drink interface games read; owns cup volume + backend
    ├── drink-backends/
    │   ├── button-hold.js    # hold duration → synthetic ml/sec  (today)
    │   └── flow-sensor.js    # serial / WebSocket pulses → ml     (later; stub with the same shape)
    ├── players.js            # join/leave, slot → colour/glyph, cup capacity preset
    ├── rounds.js             # round lifecycle state machine, scoreboard, TOP UP
    ├── fx.js                 # shake, pooled particles, tweens/easing, callout banners
    ├── audio.js              # WebAudio synth palette, per-player pitch
    ├── ui.js                 # shared drawing: fuel gauge (ring/bar/segment), DRY badge, cup, type helpers
    ├── debug.js              # the on-screen test panel (config.debug.toggleKeys); laptop only
    ├── launcher.js           # game select + player registration screen
    └── games/
        ├── index.js          # registry: `export default [tugofwar, auction, bloom]`  ← the "one launcher entry"
        ├── tugofwar.js
        ├── auction.js
        └── bloom.js
```

Adding a fourth game = add `src/games/foo.js` + one line in `src/games/index.js`.
Anything else is an abstraction failure and gets fixed in the shared module,
not worked around in the game.

Serving: `./start.sh` (or double-click `start.command`) picks the first free
port from 8080, serves the folder and opens the browser. `file://` works in
Firefox; Chrome blocks ES modules over `file://`, so any static server does
(`npx http-server .` or `python3 -m http.server`). No build step either way.

---

## Frame flow

```
main.js loop (rAF, dt clamped to 50ms):
  input.poll()                       // read every gamepad + keyboard once
  drink.update(dt)                   // backend → ml this frame → totals/remaining/rate
  if (input.justPressed(any, 'pause')) pause.toggle()
  if (!paused) screen.update(dt)     // screen = launcher | rounds (which drives the active game)
  fx.update(dt); audio.update(dt)
  canvas.begin(ctx)                  // clear, letterbox transform
  fx.applyShake(ctx)
  screen.render(ctx, W, H)
  fx.render(ctx)                     // particles + callouts, always on top
  pause.render(ctx)                  // dim + PAUSED, so it works from any state
  debug.render(ctx)                  // the test panel, truly last; sits over pause too
  canvas.end(ctx)
```

---

## Module contracts

### `config.js`

```js
export default {
  display: { width: 1920, height: 1080, safeArea: 0.90 },
  input:   { keyboard: { /* slot → key map, 4 slots */ }, deadzone: 0.5, storageKey: 'cabinet.gamepadMappings.v1' },
  drink:   { syntheticRateMlPerSec: 25, rampSec: 0.25, cupPresets: {...}, targetCupPerRoundSec: 90,
             diminish: { kneeMlPerSec: 30, exponent: 0.6 }, waterPromptEveryMl: 1000 },
  players: { colors: [...8], glyphs: [...8], maxPlayers: 8 },
  rounds:  { countdownSec: 3, roundEndHoldSec: 2.5 },
  fx:      { shake: {...}, particles: { poolSize: 600 }, tween: {...} },
  audio:   { masterGain: 0.4, pitchStepPerPlayer: 1.06 },
  games: {
    tugofwar: { ... },   // read by games/tugofwar.js as config.games.tugofwar
    auction:  { ... },
    bloom:    { ... },
  },
}
```

Every constant has a one-line comment: what it does and what raising it feels
like. No numeric literal outside `config.js` except `0`, `1`, `2`, `0.5` and
π-family maths.

### `canvas.js`

```js
export const W, H;                 // logical resolution from config
export function attach(canvasEl);  // sets up resize listener, DPR
export function begin(ctx);        // clear + letterbox transform (scale + centre)
export function end(ctx);
export function safe();            // { x, y, w, h } — central 90% rect in logical units
export function toLogical(clientX, clientY);
```

Games and screens render in logical units only. Nothing reads `window.innerWidth`.

### `input.js`

```js
export const ACTIONS = ['drink','action','pause','up','down','left','right'];
export function poll();                       // once per frame, before anything else
export function devices();                    // [{ kind:'gamepad'|'keyboard', id, index, slot|null }]
export function bindDevice(deviceKey, slot);  // players.js calls this on join
export function held(slot, action)     → bool
export function justPressed(slot, action) → bool
export function justReleased(slot, action) → bool
export function axis(slot)             → { x: -1..1, y: -1..1 }   // dpad/hat/stick unified
export function anyJustPressed(action) → slot | null              // for "press DRINK to join"
export function loadMappings() / saveMappings(obj)                 // localStorage, same schema as gamepad-test.html
export function test() → { on, driving, map, driveKeys }          // the laptop test rig, below
export function setTestMode(on) / setTestDriving(n)
```

Mapping resolution per gamepad: `byIndex[gp.index]` → `byId[gp.id]` → the
**cabinet layout** (`config.input.cabinet`: W3C standard indices in the
cabinet controller layer's vocabulary — `a b x y l r lz rz coin start` plus
d-pad buttons 12–15 and the left stick as a fallback for the directions).
With `assumeForAllPads: true` every pad gets the layout whatever mapping string
it reports; a saved binding only exists to override one misbehaving encoder.
`cabinet.actions` names which button is which game action (`drink: 'a'`,
`action: 'b'`, `pause: 'start'`); that is the one place to change when the
real buttons are known. A binding may be a list of alternatives (button OR
axis); the strongest wins. Pads are also edge-polled on a background timer
(`pollIntervalMs`) so a tap between two frames is latched and delivered on
the next `poll()`, matching the cabinet layer's own event queue. Schema is
defined by `gamepad-test.html` and documented in its Saved Mappings panel.

**Laptop test rig** (`config.input.test`, on by default — set `enabled: false`
for the cabinet). One simple key set reaches exactly one keyboard slot at a
time, so a single person can join, drive and play every player in turn:

| key | action |
|-----|--------|
| `Space` | drink |
| `ShiftLeft` | action |
| arrows | up / down / left / right |
| `1` `2` `3` `4` | choose which keyboard slot the set drives |
| `T` | toggle the rig off and back on |

A key that appears in `test.map` reaches **only** the driven slot while the rig
is on, so P2's arrows go quiet unless you are driving P2 — otherwise one arrow
press would move two players. Nothing else about the device model changes: the
rig writes into the same `kb:n` virtual devices, so joining, binding and every
per-slot read work exactly as they do on the cabinet.

Keyboard slots 0–3 are fixed in `config.input.keyboard`:

| slot | move       | drink | action | pause |
|------|------------|-------|--------|-------|
| 0    | W A S D    | Q     | E      | Esc / P (global) |
| 1    | ↑ ← ↓ →    | ,     | .      | |
| 2    | I J K L    | U     | O      | |
| 3    | Num 8 4 5 6| Num 7 | Num 9  | |

### `drink.js` — the interface every game reads

```js
// per player, refreshed every frame by drink.update(dt)
export function state(slot) → {
  rate,          // ml/sec right now, 0 when not drinking, 0 when dry (clamped)
  effective,     // rate after config.drink.diminish curve — games use THIS for force/growth/bids
  total,         // ml this round
  remaining,     // ml left in the cup since last refill
  remainingPct,  // 0..1
  isDrinking,    // rate > 0
  isDry,         // remaining <= 0
  sessionTotal,  // ml since app start (survives refills, rounds, game switches)
  justWentDry,   // true for exactly one frame — rounds.js / fx use it for the DRY callout
}
export function update(dt);
export function beginRound(slots);       // zero `total`; does NOT refill
export function refill(slot);            // remaining = capacityMl   (TOP UP only)
export function setCapacity(slot, ml);
export function setRemaining(slot, ml);  // DEBUG/TOOLS ONLY — the test panel's FILL/EMPTY.
                                         // Games and rounds.js go through refill(), so TOP UP stays
                                         // the only way a cup gets fuller during a match.
export function diminish(rate, params = config.drink.diminish) → number   // the shared curve, exposed for games with custom params
export function fatigueTracker(params) → { update(dt, drinking) → mul, value, mul }   // the "chugging pays less" rail; one per player per game
export { backend };                      // the ONE named export a sensor source replaces
```

**Backend contract** (`drink-backends/*.js`). A backend knows nothing about
cups, capacity, rounds, or games. It answers one question per frame:

```js
export default {
  name: 'button-hold',
  start(),                 // called once at boot
  mlThisFrame(slot, dt) → number,   // ml delivered to this player's mouth since last frame
  stop(),
}
```

**Today the DRINK button *is* the sensor.** There is no flow hardware, and
`button-hold.js` is the live backend, not a placeholder: holding the button
pours, and the game shows a figure lifting its cup and drinking.

`button-hold.js` reads `input.held(slot, 'drink')`, ramps a synthetic rate up
over `rampSec`, returns `rate * dt`. `flow-sensor.js` will count pulses from a
serial/WebSocket stream and return `pulses * mlPerPulse`. `drink.js` does the
integration, clamping, rate smoothing and the diminishing curve. Swapping
backends is one import line in `drink.js`.

**Enforcement:** games never see the `'drink'` action. The `inputs` object
main.js hands to a game (below) does not carry it, and `input.held(slot,'drink')`
is only imported by `button-hold.js` and `launcher.js` (join prompt).

### `players.js`

```js
export function join(deviceKey) → Player | null   // next free slot, auto colour/glyph
export function leave(slot);
export function all() → Player[]                  // joined, in slot order
export function get(slot) → Player
export function setCapacityPreset(slot, presetKey | customMl);

Player = {
  slot,        // 0..7, stable for the session
  label,       // 'P1'..'P8'
  color,       // identity hex — same in every game
  glyph,       // secondary cue: numeral + shape name, e.g. { n: 3, shape: 'triangle' }
  capacityMl,
  device,      // { kind, id, index }
  team,        // set by games that use teams, null otherwise
}
```

### `rounds.js`

State machine that owns a game module for the length of a match.

```
LOBBY ──start──▶ COUNTDOWN ──▶ PLAYING ──game returns result──▶ ROUND_END
                     ▲                                             │
                     │                              (hold N sec, then)
                     │                                             ▼
                     └──── all players confirmed ◀────────────  TOP_UP
                                                                   │
                                                          (last round?) ──▶ MATCH_END ──action──▶ LOBBY / launcher
```

```js
export function startMatch(gameModule, players, { rounds });
export function update(dt, inputs);
export function render(ctx, w, h);
export function phase() → 'COUNTDOWN' | 'PLAYING' | 'ROUND_END' | 'TOP_UP' | 'MATCH_END'
export function scoreboard() → [{ slot, points, roundsWon }]
```

TOP_UP rules (first-class, not a warning screen):
- Each player presses `action` to confirm. Round can't start until all joined players confirm.
- A player may press `action` to confirm **without** refilling. They stay in, dry, no nag, no colour change.
- Refill is a *second* explicit input: hold `action` ~0.6s → cup animates full → `drink.refill(slot)`. Tap = ready as-is.
- If `sessionTotal` crossed a `waterPromptEveryMl` boundary since the last TOP_UP, a one-line invitation shows under that player. It is informational and never blocks.

Instant restart: ROUND_END auto-advances to TOP_UP; TOP_UP → COUNTDOWN on the last confirm. No dialogs anywhere.

### Game module contract

```js
export default {
  id: 'tugofwar',
  name: 'Tug of War',
  tagline: 'Drink to pull. Brace to hold.',
  minPlayers: 2,
  maxPlayers: 8,
  defaultRounds: 3,                    // overridable from config.games[id].rounds

  init(players, cfg),                  // fresh round state. cfg === config.games[id]
  update(dt, inputs) → undefined | RoundResult,
  render(ctx, w, h),                   // logical units, safe-area aware via canvas.safe()
  teardown(),                          // stop loops, release audio nodes
  debugRows?() → [{ slot?, text }],    // optional; read by debug.js when the test panel is open
  playAllRounds?: true,                // optional; points games play every round instead of finishing on a majority of round wins
  matchSummary?(board, players) → { winners, banner },   // optional; default is most points
}

// inputs — array indexed by slot; only joined slots are populated
inputs[slot] = {
  slot,
  x, y,                    // unified axis, deadzoned, -1..1
  held(action),            // 'action' | 'up' | 'down' | 'left' | 'right'   ('drink' is not available here)
  justPressed(action),
  drink: DrinkState,       // the drink.js interface above, this player, this frame
}

RoundResult = {
  winners: [slot, ...],    // empty array = draw
  scores:  { [slot]: points },   // added to the match scoreboard
  banner:  'TEAM A WINS',  // optional; rounds.js shows it big
}
```

Games render only the arena. `rounds.js` draws countdown, round-end banner,
TOP_UP and match-end on top. `fx.js` and `audio.js` are imported directly by
games (they are effects, not state).

### `fx.js`

```js
export function shake(magnitude, seconds);
export function burst(x, y, { count, color, speed, life, size, gravity });   // pooled; never allocates per frame
export function tween(obj, props, seconds, ease = ease.outBack) → handle;
export const ease = { linear, outQuad, outCubic, outBack, outElastic, inOutQuad };
export function callout(text, { sub, color, seconds });                    // 'PLAYER 3 IS DRY'
export function update(dt); export function render(ctx); export function applyShake(ctx);
```

### `audio.js`

```js
export function unlock();                      // call on first user input (autoplay policy)
export function play(name, { slot, gain });    // 'join' | 'roundStart' | 'impact' | 'eliminated' | 'dry' | 'win' | 'tick' | 'veto'
export function drinkTone(slot, rate);         // continuous; rate 0 stops it. Pitch = base * pitchStep^slot
export function update(dt);
```

### `ui.js`

```js
export function gauge(ctx, { kind: 'ring'|'bar'|'segment', x, y, w, h, r, pct, color, isDry, t });
   // handles the three states itself: normal / low (<20%, pulses using t) / dry (outline + DRY badge)
export function badge(ctx, text, x, y, opts);
export function text(ctx, str, x, y, { size: 'hero'|'title'|'big'|'label'|'small', align, color, stroke });
export function playerMark(ctx, player, x, y, r);   // identity: colour + numeral + shape, used by every game
export function cup(ctx, x, y, w, h, { pct, color, isDry, ready, t, showBadge, halo });
export function cupAt(ctx, cx, cy, w, h, angle, opts);   // the same cup, centred and rotated — a cup in a hand
   // halo: a cream moat around the cup so an identity-coloured cup still reads
   // against an identity-coloured body. showBadge: false for hand-sized cups.
```

---

## Where the safety rails live

| Rail | Module |
|------|--------|
| Diminishing returns on flow | `drink.js` (`effective`) — every game reads `effective`, never raw `rate` for force. Per-game curves via `drink.diminish(rate, cfg.games[id].diminish)`. |
| Dry clamps rate to 0 | `drink.js` |
| Dry by choice | `rounds.js` TOP_UP — tap to confirm without refilling |
| Water invitation | `rounds.js` TOP_UP, threshold in `config.drink.waterPromptEveryMl` |
| Global pause | `main.js`, before screen update, from any state |
| Cup-per-round target | `config.drink.targetCupPerRoundSec` — round timers and rate constants are derived from it, not hand-set |

---

## Decisions taken at gate 1 (approved)

1. **Refill gesture in TOP UP**: tap `action` = ready as you are; hold `action` for `refillHoldSec` = refill and ready. The cup fills on screen while you hold, so an accidental short hold just reads as ready.
2. **Keyboard layouts**: the 4-slot table above, in `config.input.keyboard`.
3. **Mapping key**: per gamepad id string, with a per-index override from the test page's checkbox.
4. **Tug of War teams**: alternate by join order (slot 0 left, 1 right, 2 left, ...). Change `teamOf()` in `games/tugofwar.js` if the cabinet's physical sides make a different rule obvious.

## Gate 4 verdict: did the abstraction hold?

Yes, with two additions that live entirely inside `drink.js` and `config.js`:

- **Asymmetric rate smoothing.** The reported rate rises through a low-pass but falls fast (`rateReleaseSec`). Without it, a half-second pause between sips still read as continuous drinking, so Tug of War's fatigue punished burst sipping — the opposite of the intent. Any game with a sustained-flow penalty needs this, so it belongs in the layer, not the game.
- **A rate floor** (`rateFloorMlPerSec`) so `isDrinking` flips cleanly instead of trailing off.

Tug of War reads only `inputs[slot].drink.{effective, rate, isDry, isDrinking, remainingPct}` and never touched `input.js`. The `'drink'` action is unreachable from game code (the guard in `main.js` throws). Nothing in the game module knows whether the ml came from a button or a sensor. The flow-sensor backend can be dropped in by changing one import line.

## Gate 5b verdict: the button, and testing without the cabinet

Two changes, neither of which touched the drink contract:

- **The drink reads as a drink.** Tug of War's figures hold their cup in the
  free hand; `drink.isDrinking` drives one `sip` value per player and the whole
  pose — cup up beside the head, head tipped back off the neck, cup tipping,
  gulp droplets off the rim — falls out of that single lerp. The cup is drawn
  with `ui.cupAt` and a cream halo, because a player-coloured cup in front of a
  player-coloured body is otherwise one silhouette. The game still reads only
  `inputs[slot].drink`; it never learned where the ml came from.
- **`debug.js` and the input test rig** are additive. The panel is a renderer
  plus `drink.setRemaining`; the rig writes into the existing `kb:n` devices
  rather than inventing a fifth device kind, so `players.join`, `bindDevice` and
  every per-slot read are unchanged and the cabinet path is untouched with
  `input.test.enabled: false`.

`debugRows()` is the one new seam in the game-module contract, and it is
optional — a game without it simply shows no game section in the panel.

One thing to watch for Auction Blitz: it wants `total` per round, which is reset by `drink.beginRound()` — already there. Bloom wants per-frame ml deltas for growth; `rate * dt` gives that without a new field.

## Gates 6–7: Auction Blitz and Bloom

Both games were written against the contract as it stood after gate 5b. Three
things changed in shared code, none of them a workaround:

- **`rounds.js`** gained the optional `playAllRounds` flag. The majority-of-rounds
  early finish is a Tug of War rule; a points game (an auction with negative
  items, an arena game scored on survival) has to play out.
- **`drink.js`** gained `fatigueTracker(params)`, the sustained-flow rail as a
  reusable helper. Tug of War keeps its own inline copy, already tuned.
- **`audio.js`** gained the two games' palettes: `bidTick`, `sold`, `fold`,
  `void`, `eat`, `bump`, `dash`.

Auction Blitz reads `inputs[slot].drink.{effective, isDrinking, isDry,
remainingPct, rate}`; the bid is `∫ effective · fatigue`. Bloom reads the same
fields and grows by area (`r = √(r² + ml · growthAreaPerMl)`), so radius has a
natural diminishing return on top of fatigue. Neither touched `input.js`.
Vetoes in Auction live in the game module across rounds and reset on round 1
of a match, which `rounds.roundNumber()` already exposes.
