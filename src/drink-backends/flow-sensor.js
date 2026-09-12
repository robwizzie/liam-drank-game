// Flow-sensor backend (future). Same shape as button-hold.js.
// Expects a WebSocket that sends JSON messages: { "slot": 2, "ml": 3.1 }
// (or { "slot": 2, "pulses": 7 } with mlPerPulse set below). Messages are
// accumulated in a bucket per slot and drained once per frame, so the game
// never sees sensor timing.
//
// To switch the whole app to this backend, change ONE line in ../drink.js:
//   import backend from './drink-backends/flow-sensor.js';

const SENSOR_URL = 'ws://localhost:8765';   // move to config when the hardware exists
const ML_PER_PULSE = 2.25;                  // YF-S401-class sensors are ~5880 pulses/L; calibrate on the bench

const buckets = new Map();   // slot -> ml waiting to be drained
let socket = null;

export default {
  name: 'flow-sensor',

  start() {
    buckets.clear();
    try {
      socket = new WebSocket(SENSOR_URL);
      socket.onmessage = ev => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (typeof msg.slot !== 'number') return;
        const ml = typeof msg.ml === 'number' ? msg.ml : (typeof msg.pulses === 'number' ? msg.pulses * ML_PER_PULSE : 0);
        buckets.set(msg.slot, (buckets.get(msg.slot) || 0) + ml);
      };
      socket.onerror = () => {};
    } catch (e) {
      socket = null;
    }
  },

  mlThisFrame(slot) {
    const ml = buckets.get(slot) || 0;
    buckets.set(slot, 0);
    return ml;
  },

  stop() {
    if (socket) { try { socket.close(); } catch (e) { /* ignore */ } }
    socket = null;
    buckets.clear();
  },
};
