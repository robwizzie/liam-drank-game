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
    test: {                 // laptop testing: one simple key set drives ONE player at a time. Turn OFF for the cabinet.
      enabled: true,        // false = the four keyboard layouts above are the only keyboard input
      toggleKeys: ['KeyT'], // flip test keys on/off at runtime; the cabinet layouts always keep working
      driveKeys: ['Digit1', 'Digit2', 'Digit3', 'Digit4'],  // pick which player the test keys drive
      map: {                // deliberately keys no cabinet layout uses, except the arrows (see below)
        drink: 'Space', action: 'ShiftLeft',
        up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
      },
      // The arrows collide with P2's cabinet layout. While test mode is on, a
      // key in `map` only reaches the player being driven, so P2 keeps , and .
      // but loses the arrows until you drive P2 or press the toggle key.
    },
    cabinet: {              // the arcade sticks, in the cabinet's own vocabulary (its controller layer's STANDARD_ARCADE_MAPPING)
      // Physical layout: W3C "standard" gamepad indices, exactly as the cabinet's controller code expects them.
      buttons: { a: 0, b: 1, x: 2, y: 3, l: 4, r: 5, lz: 6, rz: 7, coin: 8, start: 9, up: 12, down: 13, left: 14, right: 15 },
      stickAxes: { x: 0, y: 1 },   // left-stick fallback for the four directions, same as the cabinet layer
      // Which cabinet button does what in the games. Change a word here, nothing else moves.
      actions: { drink: 'a', action: 'b', pause: 'start' },
      assumeForAllPads: true,      // apply this layout to any pad with no saved gamepad-test.html binding, whatever mapping string it reports
      pollIntervalMs: 4,           // background edge polling, like the cabinet layer: a tap shorter than a frame still lands
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

  debug: {                      // the on-screen test panel; invisible until you ask for it
    toggleKeys: ['F1', 'Backquote'],  // show/hide the panel
    panelW: 1040,               // px, logical; wide enough for a full drink row plus its buttons
    rowH: 36,                   // px per row
    pad: 22,                    // inner padding
    rowFontPx: 24,              // row text; below the 28 px player-facing floor because nobody reads this from the couch
    fpsSmoothingHz: 4,          // how fast the fps readout settles; higher = twitchier
    btnW: 92,                   // px, the per-player FILL / EMPTY buttons
    btnWideW: 148,              // px, the FILL ALL / EMPTY ALL pair; their labels don't fit btnW
    btnH: 28,
    btnFontPx: 18,
    btnGap: 10,
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
      drinkPose: {              // the cup each figure holds, and what happens when the drink button goes down
        cupW: 46,               // px; wider = the cup reads from the back of the room, but crowds the torso
        cupH: 60,
        haloPx: 5,              // cream moat around the held cup so it separates from a same-coloured body
        headClearPx: 9,         // gap between the cup and the head silhouette at a full sip; 0 = they overlap
        raiseSec: 0.16,         // seconds for the cup to reach the mouth; higher = a lazier, more deliberate sip
        headTiltDeg: 28,        // how far the head tips back at a full sip; higher = more of a chug
        cupTiltDeg: 52,         // how far the cup tips toward the head at a full sip
        gulpEverySec: 0.22,     // seconds between gulp droplets while drinking; lower = messier drinker
        gulpCount: 2,           // droplets per gulp
      },
      figureSpacingPx: 150,     // gap between team-mates on the rope; compresses when the knot nears their post
      figureGripPx: 135,        // distance from the knot to the nearest figure
      lean: {
        maxDeg: 28,             // how far a pulling figure leans at full force
        braceSquash: 0.78,      // vertical scale of a bracing figure
      },
      ropeSagPx: 34,            // how far the rope droops at zero tension; 0 = always taut
    },

    auction: {
      rounds: 7,                // items on the block; every round is played, points decide
      bidTimeSec: 10,           // seconds of bidding per item; longer = more room to bluff, more drunk per round
      escalateSec: 3,           // the final stretch: ring goes brass, the card grows, ticks climb
      cardGrow: 1.1,            // how much the item card swells in the final stretch
      glassFullMl: 120,         // a bid glass reads full at this many ml; ≈ one uninterrupted button hold per round
      minBidMl: 1,              // a bid below this counts as no bid at all
      foldConsolation: 1,       // points for folding; the "sit this one out" score
      vetoHoldSec: 0.7,         // a dry player holds ACTION this long to spend a veto; a tap is a fold
      vetoesPerDry: 1,          // vetoes a player is handed the first time they go dry in a match
      values: [5, 10, 15, 20, 25, 30],   // item values, drawn uniformly once the dud / tab roll misses
      dudChance: 0.12,          // chance an item is worth nothing; higher = blind max-bidding punished more often
      tabChance: 0.12,          // chance the item is a bar tab that COSTS the winner; drawn from `tabs`
      tabs: [-10, -15, -20],
      firstRoundSafe: true,     // round 1 is never a dud or a tab so the room learns the game on a real item
      resolve: {
        voidGapSec: 0.5,        // seconds between each VOID stamp when vetoes fire
        soldDelaySec: 0.45,     // pause before the SOLD stamp lands
        holdSec: 0.9,           // how long SOLD sits before the round-end banner takes over
      },
      pour: {                   // the player's cup tipping into the bid glass
        cupW: 58,
        cupH: 76,
        tiltDeg: 62,            // how far the cup tips at a full pour
        raiseSec: 0.14,         // seconds for the cup to tip / right itself
        streamPx: 12,           // width of the pour stream
        splashEverySec: 0.07,   // seconds between splash droplets at the surface while pouring
      },
      fatigue: {                // sustained bidding counts for less: sip in bursts, don't chug the round
        onsetSec: 3,            // seconds of continuous drinking before the bid starts to shrink
        riseRate: 0.5,          // fatigue per second past onset; higher = faster punishment
        recoverRate: 0.8,       // fatigue shed per second off the button; higher = shorter breather
        floor: 0.4,             // minimum bid multiplier at full fatigue; 0 = chugging pours nothing
      },
    },

    bloom: {
      rounds: 3,                // every round is played, points decide
      roundTimeSec: 75,         // seconds per round; a round also ends when one player is left
      startRadius: 28,          // px; the gap sizes below are in units of this
      maxRadius: 150,           // px; growth caps here however much you drink
      growthAreaPerMl: 24,      // px² of body per ml; radius grows as the square root, so big players grow slower per sip
      speedMax: 520,            // px/sec at the start radius
      speedFalloffExp: 0.6,     // speed = speedMax · (startRadius / radius)^this; higher = size costs more speed
      accel: 9,                 // per-second approach to the wanted velocity; higher = twitchier, lower = weightier
      eatRatio: 1.2,            // you must be this many times the other's radius to eat them
      eatOverlap: 0.6,          // fraction of the small body's width that must be inside the big one before the bite lands; 0.5 = its centre crosses the edge
      eatGrowthFrac: 0.5,       // fraction of the eaten body's area the eater gains
      dash: {                   // the stick's second job: ACTION lunges. Dry players keep it.
        mul: 2.2,               // dash speed as a multiple of current speed
        sec: 0.18,              // dash duration
        cooldownSec: 1.6,       // seconds between dashes
      },
      wallPx: 28,               // wall thickness
      gaps: {                   // authored gap widths in start-radius units: the biggest body that fits through
        smallRadii: 1.3,        // the left pocket: a fresh player, a sip more, nothing bigger
        medRadii: 2.3,          // the right loop's doors
        corridorRadii: 2.6,     // the right loop's corridor
        clearPx: 8,             // extra slack on every gap so the fit is a squeeze, not a pixel fight
      },
      score: {
        eatPoints: 5,           // per body eaten
        survivalSecPerPoint: 5, // one point per this many seconds alive
        sizePoints: 10,         // points for a max-radius survivor at the bell, scaled by radius
      },
      fatigue: {                // sustained drinking grows less: the chug rail
        onsetSec: 3,
        riseRate: 0.5,
        recoverRate: 0.8,
        floor: 0.4,
      },
      ring: { gapPx: 12, widthPx: 10 },   // the fuel ring around each body
      cupIcon: { w: 32, h: 42, tiltDeg: 55, raiseSec: 0.16 },   // the little cup that tips at the body's shoulder while drinking
      bump: { minSpeed: 220, everySec: 0.25 },   // wall thumps: how hard you must hit, and how often it can sound
    },
  },
};
