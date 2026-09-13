// Every tunable constant in the project. Grouped by system.
// Each line: what it does, and what raising it feels like.
// No numeric literal lives anywhere else except 0, 1, 2, 0.5 and π-family maths.

export default {
  display: {
    width: 1920,            // logical width; all layout maths uses this, the canvas letterboxes to fit
    height: 1080,           // logical height
    safeArea: 0.90,         // fraction of the frame that holds critical UI; lower = more margin for panels that crop
    maxDt: 0.05,            // seconds; clamp for a stalled frame so physics can't explode after a tab switch
  },

  input: {
    storageKey: 'cabinet.gamepadMappings.v1', // localStorage key; must match gamepad-test.html
    deadzone: 0.5,          // axis deflection that counts as pushed; higher = stick has to go further
    hatTolerance: 0.35,     // how close a hat-style axis must be to its captured value; wider = more forgiving encoders
    pauseKeys: ['Escape', 'KeyP'],            // keyboard keys that toggle global pause from any state
    keyboard: [             // four virtual keyboard players, by e.code
      { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', drink: 'KeyQ', action: 'KeyE' },
      { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', drink: 'Comma', action: 'Period' },
      { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', drink: 'KeyU', action: 'KeyO' },
      { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', drink: 'Numpad7', action: 'Numpad9' },
    ],
    standardMapping: {      // W3C "standard" layout fallback when a pad reports mapping === 'standard' and has no saved binding
      drink: { type: 'button', index: 0 },
      action: { type: 'button', index: 1 },
      pause: { type: 'button', index: 9 },
      up: { type: 'button', index: 12 },
      down: { type: 'button', index: 13 },
      left: { type: 'button', index: 14 },
      right: { type: 'button', index: 15 },
    },
  },

  drink: {
    syntheticRateMlPerSec: 12,  // button-hold backend: ml/sec while held; a 16oz cup is ~40 s of holding, ~80 s sipped in bursts
    rampSec: 0.25,              // button-hold backend: seconds to reach full synthetic rate; higher = mushier start
    rateSmoothingSec: 0.12,     // low-pass on the rising rate; higher = calmer needle, laggier feel
    rateReleaseSec: 0.03,       // how fast the rate falls when flow stops; higher = pauses between sips register later
    rateFloorMlPerSec: 0.5,     // below this the rate reads 0 and isDrinking is false
    cupPresets: {               // declared capacities in ml; the sensor can never know the cup is empty, this can
      '12oz': 355,
      '16oz': 473,
      'pint': 568,
    },
    defaultPreset: '16oz',      // what a fresh player gets before they touch the cup selector
    customStepMl: 50,           // ml per tick when choosing a custom capacity
    customMaxMl: 1500,          // ceiling on custom capacity
    targetCupPerRoundSec: 90,   // TARGET: one average cup lasts about one round. Round lengths derive from this. Tune on night one.
    diminish: {                 // curve applied to raw rate → `effective`; matters with real sensors more than the button
      kneeMlPerSec: 30,         // below this, effective == rate; above it returns diminish
      exponent: 0.6,            // < 1 flattens the top end; lower = chugging pays even less
    },
    waterPromptEveryMl: 1000,   // every N ml of sessionTotal, TOP UP shows the water invitation once; lower = more often
  },

  players: {
    maxPlayers: 8,
    colors:  ['#FF4D2E', '#2EB8FF', '#FFD23F', '#9B5CFF', '#19D3A2', '#FF9F1C', '#FF4FA3', '#D6F0FF'],
    names:   ['Vermilion', 'Sky', 'Yolk', 'Violet', 'Mint', 'Tangerine', 'Bubblegum', 'Ice'],
    shapes:  ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star', 'heart', 'ring'],
    keylinePx: 6,               // ink outline on every identity-coloured shape; thicker = chunkier silhouettes
  },

  rounds: {
    countdownSec: 3,            // seconds of 3-2-1 before PLAYING; lower = snappier restarts
    roundEndHoldSec: 2.5,       // seconds the winner banner holds before TOP UP
    refillHoldSec: 0.6,         // hold ACTION this long in TOP UP to refill; longer = fewer accidental refills
    topUpAutoStartSec: 0.5,     // pause after the last confirm before the countdown, so the last press doesn't feel abrupt
  },

  fx: {
    shake: {
      dryMag: 6,                // px of shake when someone goes dry
      dryDur: 0.25,             // seconds
      winMag: 22,               // px of shake on a round win
      winDur: 0.55,
      decay: 0.85,              // per-frame magnitude multiplier; lower = shake dies faster
    },
    particles: {
      poolSize: 800,            // preallocated particles; never allocate per frame
      gravity: 1400,            // px/sec²; higher = dust falls faster
    },
    callout: {
      holdSec: 1.6,             // how long a callout banner stays
      slamSec: 0.18,            // seconds for the slam-in; lower = harder hit
    },
    tween: {
      snapSec: 0.22,            // default snappy tween
    },
  },

  audio: {
    masterGain: 0.35,           // overall loudness 0..1
    baseHz: 220,                // player 1's identity pitch; each slot is pitchStep higher
    pitchStepPerPlayer: 1.06,   // multiplier per slot; 1.06 ≈ a semitone
    drinkToneGain: 0.16,        // loudness of the continuous drinking tone
    drinkToneRiseOctaves: 0.6,  // how far the drink tone climbs as the cup empties; higher = more like a filling glass
  },

  theme: {                      // Direction A — Enamel Sign (docs/DESIGN.md)
    cream: '#F4E9D2',           // ground
    ink: '#1A1614',             // every keyline, all type
    bottle: '#1F5E45',          // rope, walls, structural panels
    brass: '#D9A441',           // timer, winner, the one accent per screen
    slate: '#6B7680',           // quiet UI, dry outlines, DRY badge, water line
    foam: '#FFFFFF',            // highlight edge on gauge fills, cup rims
    creamDeep: '#E6D9BC',       // a slightly darker cream for wells and sunk panels
    display: '"Alfa Slab One", Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
    label: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
    type: { hero: 260, title: 120, big: 72, label: 40, small: 28 },   // px, logical; 28 is the floor
    strokePx: { hero: 10, title: 7, big: 5, label: 3, small: 2 },     // ink outline outside display type
    lowPct: 0.2,                // gauge pulses below this fraction
    lowPulseHz: 2,              // pulse speed of a low gauge
    gaugeKeylinePx: 6,
  },

  launcher: {
    bandHeight: 150,            // px; height of each game band
    selectedScale: 1.06,        // the chosen band grows this much
  },

  games: {
    tugofwar: {
      rounds: 3,                // best of N (first to majority)
      roundTimeLimitSec: 90,    // overrides drink.targetCupPerRoundSec if set; whoever holds the rope at time-out wins
      pullForcePerMlSec: 0.5,   // force per ml/sec of `effective` rate; higher = faster rope. One uncontested fresh drinker ≈ 8 s to win
      ropeMass: 18,             // inertia; higher = weightier, slower to reverse (response time ≈ mass/drag seconds)
      ropeDrag: 30,             // velocity damping; higher = slower top speed. Fresh uncontested puller ≈ 5 s to win, ≈ 12 s against a dry bracer
      braceForce: 2.5,          // resistance a bracing player adds against being dragged; two bracers nearly hold one fresh puller
      dryBraceBonus: 1.4,       // multiplier on braceForce for a dry player "digging in"
      winThreshold: 1.0,        // rope position (0 = centre) that ends the round; the posts sit here
      handicapExponent: 0.85,   // force multiplier for the smaller team = (big/small)^this; 1.0 = fully fair, 0 = none
      fatigue: {                // sustained drinking → diminishing pull. Sip in bursts, don't chug.
        onsetSec: 2.5,          // seconds of continuous drinking before fatigue starts to bite
        riseRate: 0.45,         // fatigue per second once past onset; higher = faster punishment
        recoverRate: 0.7,       // fatigue shed per second while not drinking; higher = shorter breather needed
        floor: 0.35,            // minimum force multiplier at full fatigue; 0 = chugging does nothing at all
      },
      figureSpacingPx: 150,     // gap between team-mates on the rope; compresses when the knot nears their post
      figureGripPx: 135,        // distance from the knot to the nearest figure
      lean: {
        maxDeg: 28,             // how far a pulling figure leans at full force
        braceSquash: 0.78,      // vertical scale of a bracing figure
      },
      ropeSagPx: 34,            // how far the rope droops at zero tension; 0 = always taut
    },
  },
};
