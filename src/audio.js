// Synthesised WebAudio. No asset files. Every player has a pitch identity.

import config from './config.js';

let ctx = null;
let master = null;
const drinkVoices = new Map();   // slot -> { osc, gain, lfo }

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = config.audio.masterGain;
  master.connect(ctx.destination);
}

export function ready() { return !!ctx && ctx.state === 'running'; }

function slotPitch(slot) {
  return config.audio.baseHz * Math.pow(config.audio.pitchStepPerPlayer, slot || 0);
}

// One-shot envelope helper. notes: [{ f, t, d, type, g }] relative to now.
function voice(notes, opts = {}) {
  if (!ready()) return;
  const now = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = n.type || opts.type || 'square';
    osc.frequency.setValueAtTime(n.f, now + n.t);
    if (n.f2) osc.frequency.exponentialRampToValueAtTime(n.f2, now + n.t + n.d);
    const peak = n.g ?? opts.gain ?? 0.5;
    g.gain.setValueAtTime(0.0001, now + n.t);
    g.gain.exponentialRampToValueAtTime(peak, now + n.t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
    osc.connect(g); g.connect(master);
    osc.start(now + n.t);
    osc.stop(now + n.t + n.d + 0.02);
  }
}

function noise(t, d, gain, filterHz) {
  if (!ready()) return;
  const now = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * d));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterHz;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, now + t);
  g.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(now + t);
}

export function play(name, opts = {}) {
  const slot = opts.slot ?? 0;
  const p = slotPitch(slot);
  switch (name) {
    case 'join':
      voice([{ f: p, t: 0, d: 0.08 }, { f: p * 1.5, t: 0.08, d: 0.14 }], { gain: 0.4 });
      break;
    case 'select':
      voice([{ f: 520, t: 0, d: 0.05, type: 'triangle' }], { gain: 0.35 });
      break;
    case 'tick':
      voice([{ f: 660, t: 0, d: 0.07, type: 'triangle', g: 0.5 }]);
      break;
    case 'tickHigh':
      voice([{ f: 880, t: 0, d: 0.06, type: 'triangle', g: 0.5 }]);
      break;
    case 'roundStart':
      voice([{ f: 440, t: 0, d: 0.08 }, { f: 660, t: 0.08, d: 0.08 }, { f: 880, t: 0.16, d: 0.3, type: 'sawtooth', g: 0.35 }], { gain: 0.5 });
      break;
    case 'impact':
      noise(0, 0.18, 0.7, 900);
      voice([{ f: 90, f2: 40, t: 0, d: 0.22, type: 'sine', g: 0.8 }]);
      break;
    case 'thud':
      voice([{ f: 120, f2: 50, t: 0, d: 0.15, type: 'sine', g: 0.6 }]);
      break;
    case 'dry':
      // a hollow "clunk" then a descending two-note; neutral, not alarming
      noise(0, 0.08, 0.4, 500);
      voice([{ f: p * 1.25, t: 0.05, d: 0.12, type: 'triangle', g: 0.45 }, { f: p * 0.75, t: 0.18, d: 0.28, type: 'triangle', g: 0.4 }]);
      break;
    case 'eliminated':
      voice([{ f: p * 2, f2: p * 0.5, t: 0, d: 0.4, type: 'sawtooth', g: 0.4 }]);
      noise(0, 0.25, 0.5, 1200);
      break;
    case 'win': {
      const base = 330;
      voice([
        { f: base, t: 0, d: 0.12 }, { f: base * 1.25, t: 0.12, d: 0.12 }, { f: base * 1.5, t: 0.24, d: 0.12 },
        { f: base * 2, t: 0.36, d: 0.6, type: 'sawtooth', g: 0.45 }, { f: base * 2.5, t: 0.36, d: 0.6, type: 'square', g: 0.2 },
      ], { gain: 0.5 });
      noise(0.36, 0.5, 0.35, 2500);
      break;
    }
    case 'veto':
      voice([{ f: 110, f2: 55, t: 0, d: 0.5, type: 'sawtooth', g: 0.7 }]);
      noise(0, 0.4, 0.8, 600);
      break;
    case 'refill':
      // glug glug glug, rising
      for (let i = 0; i < 4; i++) voice([{ f: 180 + i * 60, f2: 260 + i * 80, t: i * 0.09, d: 0.09, type: 'sine', g: 0.5 }]);
      break;
    case 'ready':
      voice([{ f: p * 2, t: 0, d: 0.06, type: 'triangle', g: 0.45 }, { f: p * 3, t: 0.07, d: 0.1, type: 'triangle', g: 0.45 }]);
      break;
    case 'creak':
      voice([{ f: 70 + Math.random() * 30, f2: 50, t: 0, d: 0.12, type: 'sawtooth', g: 0.12 }]);
      break;
    default:
      voice([{ f: p, t: 0, d: 0.1 }]);
  }
}

// Continuous tone while a player drinks. rate 0 stops it. pct = remaining fraction:
// pitch climbs as the cup empties, like a glass filling (in reverse — it's yours).
export function drinkTone(slot, rate, pct = 1) {
  if (!ready()) return;
  let v = drinkVoices.get(slot);
  const active = rate > 0;
  if (!v) {
    if (!active) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 7;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 6;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    const g = ctx.createGain(); g.gain.value = 0.0001;
    osc.connect(g); g.connect(master);
    osc.start(); lfo.start();
    v = { osc, gain: g, lfo };
    drinkVoices.set(slot, v);
  }
  const now = ctx.currentTime;
  const target = active ? config.audio.drinkToneGain * Math.min(1, rate / config.drink.syntheticRateMlPerSec) : 0.0001;
  v.gain.gain.cancelScheduledValues(now);
  v.gain.gain.setTargetAtTime(Math.max(0.0001, target), now, 0.05);
  const f = slotPitch(slot) * Math.pow(2, (1 - pct) * config.audio.drinkToneRiseOctaves);
  v.osc.frequency.setTargetAtTime(f, now, 0.08);
}

export function stopAllDrinkTones() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const v of drinkVoices.values()) v.gain.gain.setTargetAtTime(0.0001, now, 0.03);
}

export function update() { /* reserved for scheduled loops */ }
