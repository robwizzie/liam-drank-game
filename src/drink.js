// The drink interface every game reads. Owns cup volume, the diminishing
// curve, rate smoothing and the dry clamp. The backend only reports ml.
//
// TODAY the source is the cabinet's DRINK button: hold it and the cup pours.
// There is no flow sensor yet, and nothing above this file knows the difference
// — swap the source by changing this ONE import line:
import backend from './drink-backends/button-hold.js';
// import backend from './drink-backends/flow-sensor.js';

import config from './config.js';
import * as players from './players.js';

export { backend };

const states = new Map();   // slot -> DrinkState (mutable, reused every frame)

function fresh(slot) {
  return {
    slot,
    rate: 0,            // ml/sec now, 0 when dry
    effective: 0,       // rate after the diminishing curve; games use this for force
    total: 0,           // ml this round
    remaining: 0,       // ml left in the cup
    remainingPct: 0,    // 0..1
    isDrinking: false,
    isDry: true,
    sessionTotal: 0,    // ml since app start
    justWentDry: false, // true for exactly one frame
    _smoothRate: 0,
  };
}

export function ensure(slot) {
  let s = states.get(slot);
  if (!s) {
    s = fresh(slot);
    const p = players.get(slot);
    s.remaining = p ? p.capacityMl : 0;
    states.set(slot, s);
    recompute(s);
  }
  return s;
}

export function state(slot) { return ensure(slot); }

export function forget(slot) { states.delete(slot); }

export function start() { backend.start(); }

// Sustained-flow fatigue: the shared "chugging pays less" rail. A game keeps
// one tracker per player and multiplies that player's drink effect by `mul`.
// Past `onsetSec` of continuous drinking the multiplier slides toward `floor`;
// off the button it recovers. Tug of War carries its own copy of this curve.
export function fatigueTracker(params) {
  const f = { value: 0, drinkTime: 0, mul: 1 };
  f.update = (dt, drinking) => {
    if (drinking) {
      f.drinkTime += dt;
      if (f.drinkTime > params.onsetSec) f.value = Math.min(1, f.value + params.riseRate * dt);
    } else {
      f.drinkTime = 0;
      f.value = Math.max(0, f.value - params.recoverRate * dt);
    }
    f.mul = 1 - f.value * (1 - params.floor);
    return f.mul;
  };
  return f;
}

export function diminish(rate, params = config.drink.diminish) {
  const { kneeMlPerSec, exponent } = params;
  if (rate <= kneeMlPerSec) return rate;
  return kneeMlPerSec * Math.pow(rate / kneeMlPerSec, exponent);
}

function recompute(s) {
  const p = players.get(s.slot);
  const cap = p ? p.capacityMl : 0;
  s.remainingPct = cap > 0 ? Math.max(0, Math.min(1, s.remaining / cap)) : 0;
  s.isDry = s.remaining <= 0;
}

export function update(dt) {
  const smooth = config.drink.rateSmoothingSec;
  const k = smooth > 0 ? 1 - Math.exp(-dt / smooth) : 1;
  for (const p of players.all()) {
    const s = ensure(p.slot);
    const wasDry = s.isDry;
    let ml = wasDry ? 0 : backend.mlThisFrame(p.slot, dt);
    if (ml < 0) ml = 0;
    if (ml > s.remaining) ml = s.remaining;
    s.remaining -= ml;
    s.total += ml;
    s.sessionTotal += ml;
    const raw = dt > 0 ? ml / dt : 0;
    // smooth the rise, but let the fall be fast so a pause between sips reads as a pause
    if (raw > 0) s._smoothRate += (raw - s._smoothRate) * k;
    else s._smoothRate *= Math.exp(-dt / config.drink.rateReleaseSec);
    recompute(s);
    s.rate = s.isDry ? 0 : s._smoothRate;
    if (s.rate < config.drink.rateFloorMlPerSec) s.rate = 0;
    s.effective = diminish(s.rate);
    s.isDrinking = s.rate > 0;
    s.justWentDry = !wasDry && s.isDry;
    if (s.isDry) s._smoothRate = 0;
  }
}

// New round: zero the round total. Does NOT refill.
export function beginRound() {
  for (const s of states.values()) { s.total = 0; s.justWentDry = false; }
}

// TOP UP only.
export function refill(slot) {
  const s = ensure(slot);
  const p = players.get(slot);
  s.remaining = p ? p.capacityMl : 0;
  s._smoothRate = 0;
  recompute(s);
  s.rate = 0; s.effective = 0; s.isDrinking = false; s.justWentDry = false;
}

// Debug / tools only — the test panel's FILL and EMPTY buttons. Games and
// rounds.js must go through refill() so the TOP UP rules stay the only way a
// cup gets fuller during a match.
export function setRemaining(slot, ml) {
  const s = ensure(slot);
  const p = players.get(slot);
  const cap = p ? p.capacityMl : 0;
  s.remaining = Math.max(0, Math.min(cap, ml));
  s._smoothRate = 0;
  recompute(s);
  s.rate = 0; s.effective = 0; s.isDrinking = false; s.justWentDry = false;
}

export function setCapacity(slot, ml) {
  const s = ensure(slot);
  // capacity change outside a round refills to the new size
  s.remaining = ml;
  recompute(s);
}
