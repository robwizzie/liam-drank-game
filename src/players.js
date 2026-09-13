// Registration, slot → colour/shape, cup capacity. Pure state; no drawing.

import config from './config.js';
import * as input from './input.js';

const roster = new Map();   // slot -> Player

export function all() {
  return [...roster.values()].sort((a, b) => a.slot - b.slot);
}

export function get(slot) { return roster.get(slot) || null; }

export function count() { return roster.size; }

export function join(deviceKey) {
  for (const p of roster.values()) if (p.device.key === deviceKey) return p;
  let slot = -1;
  for (let i = 0; i < config.players.maxPlayers; i++) if (!roster.has(i)) { slot = i; break; }
  if (slot < 0) return null;
  const dev = input.devices().find(d => d.key === deviceKey);
  if (!dev) return null;
  const preset = config.drink.defaultPreset;
  const p = {
    slot,
    label: 'P' + (slot + 1),
    color: config.players.colors[slot],
    colorName: config.players.names[slot],
    shape: config.players.shapes[slot],
    n: slot + 1,
    capacityMl: config.drink.cupPresets[preset],
    capacityPreset: preset,
    device: { key: dev.key, kind: dev.kind, id: dev.id, index: dev.index },
    team: null,
  };
  roster.set(slot, p);
  input.bindDevice(deviceKey, slot);
  return p;
}

export function leave(slot) {
  if (!roster.has(slot)) return;
  roster.delete(slot);
  input.unbindSlot(slot);
}

export function presetKeys() {
  return [...Object.keys(config.drink.cupPresets), 'custom'];
}

// Cycle the capacity preset by ±1. 'custom' steps in customStepMl.
export function cycleCapacity(slot, dir) {
  const p = roster.get(slot);
  if (!p) return;
  const keys = presetKeys();
  const i = keys.indexOf(p.capacityPreset);
  if (p.capacityPreset === 'custom') {
    const next = p.capacityMl + dir * config.drink.customStepMl;
    if (next > config.drink.customMaxMl) { p.capacityPreset = keys[0]; p.capacityMl = config.drink.cupPresets[keys[0]]; return; }
    if (next < config.drink.customStepMl) { p.capacityPreset = keys[keys.length - 2]; p.capacityMl = config.drink.cupPresets[p.capacityPreset]; return; }
    p.capacityMl = next;
    return;
  }
  const j = (i + dir + keys.length) % keys.length;
  p.capacityPreset = keys[j];
  if (keys[j] === 'custom') p.capacityMl = dir > 0 ? config.drink.cupPresets[keys[keys.length - 2]] + config.drink.customStepMl : config.drink.customMaxMl;
  else p.capacityMl = config.drink.cupPresets[keys[j]];
}

export function capacityLabel(p) {
  return p.capacityPreset === 'custom' ? p.capacityMl + ' ml' : p.capacityPreset;
}
