// Button-hold backend — the live one. The cabinet's DRINK button IS the sensor:
// hold it and the cup pours at syntheticRateMlPerSec, ramped over rampSec so
// the start of a sip isn't instant.
//
// Knows nothing about cups, capacity, rounds or games. One question per frame:
// how many ml reached this player's mouth since the last frame?

import config from '../config.js';
import * as input from '../input.js';

const holdTime = new Map();   // slot -> seconds continuously held

export default {
  name: 'button-hold',

  start() { holdTime.clear(); },

  mlThisFrame(slot, dt) {
    const { syntheticRateMlPerSec, rampSec } = config.drink;
    if (input.held(slot, 'drink')) {
      const t = (holdTime.get(slot) || 0) + dt;
      holdTime.set(slot, t);
      const ramp = rampSec > 0 ? Math.min(1, t / rampSec) : 1;
      return syntheticRateMlPerSec * ramp * dt;
    }
    holdTime.set(slot, 0);
    return 0;
  },

  stop() { holdTime.clear(); },
};
