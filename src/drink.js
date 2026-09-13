// The drink interface every game reads. Owns cup volume, the diminishing
// curve, rate smoothing and the dry clamp. The backend only reports ml.
//
// Swap the backend by changing this ONE import line:
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

export function setCapacity(slot, ml) {
  const s = ensure(slot);
  // capacity change outside a round refills to the new size
  s.remaining = ml;
  recompute(s);
}
