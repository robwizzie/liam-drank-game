// Gamepad + keyboard unification. Devices are keyed 'gp:<index>' or 'kb:<n>'.
// Players bind a device to a slot; games read by slot. The 'drink' action is
// readable here only by the drink backend and the launcher's join prompt.

import config from './config.js';

export const ACTIONS = ['drink', 'action', 'pause', 'up', 'down', 'left', 'right'];

const keysDown = new Set();
const keysLatched = new Set();   // keys pressed since the last poll, so a tap shorter than a frame still counts
let mappings = loadMappings();
const deviceStates = new Map();   // deviceKey -> { key, kind, id, index, cur:Set, prev:Set, x, y, slot }
const slotToDevice = new Map();   // slot -> deviceKey
let pauseCur = false, pausePrev = false;

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  keysDown.add(e.code);
  keysLatched.add(e.code);
  if (isGameKey(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keysDown.delete(e.code); });
window.addEventListener('blur', () => keysDown.clear());

const testCfg = config.input.test;
const testKeys = new Set(Object.values(testCfg.map));
let testOn = !!testCfg.enabled;
let driving = 0;   // which keyboard slot the test keys reach

function isGameKey(code) {
  if (config.input.pauseKeys.includes(code)) return true;
  if (testKeys.has(code) || testCfg.toggleKeys.includes(code) || testCfg.driveKeys.includes(code)) return true;
  return config.input.keyboard.some(k => Object.values(k).includes(code));
}

function isDown(code) { return keysDown.has(code) || keysLatched.has(code); }
function justTapped(code) { return keysLatched.has(code); }   // keydown ignores auto-repeat, so this is a rising edge

// The laptop test rig: which player the simple key set is driving right now.
export function test() {
  return { on: testOn, driving, map: testCfg.map, driveKeys: testCfg.driveKeys };
}

export function setTestDriving(n) {
  if (n >= 0 && n < config.input.keyboard.length) driving = n;
}

export function setTestMode(on) { testOn = !!on; }

// ---- mappings (same schema as gamepad-test.html) --------------------------

export function loadMappings() {
  try {
    const raw = localStorage.getItem(config.input.storageKey);
    if (!raw) return { version: 1, byId: {}, byIndex: {} };
    const s = JSON.parse(raw);
    return { version: 1, byId: s.byId || {}, byIndex: s.byIndex || {} };
  } catch (e) {
    return { version: 1, byId: {}, byIndex: {} };
  }
}

export function saveMappings(obj) {
  mappings = obj;
  localStorage.setItem(config.input.storageKey, JSON.stringify(obj));
}

function resolveMapping(gp) {
  if (mappings.byIndex[gp.index]) return mappings.byIndex[gp.index].actions;
  if (mappings.byId[gp.id]) return mappings.byId[gp.id].actions;
  if (gp.mapping === 'standard') return config.input.standardMapping;
  return null;
}

function bindingStrength(gp, b) {
  if (!b) return 0;
  if (b.type === 'button') {
    const btn = gp.buttons[b.index];
    if (!btn) return 0;
    return (btn.pressed || btn.value > 0.5) ? 1 : 0;
  }
  if (b.type === 'axis') {
    const v = gp.axes[b.index];
    if (v === undefined) return 0;
    const rest = b.rest ?? 0;
    if (Math.abs(rest) <= 0.2) {
      const d = b.sign * (v - rest);
      return d >= config.input.deadzone ? Math.min(1, d) : 0;
    }
    return Math.abs(v - b.value) <= config.input.hatTolerance ? 1 : 0;
  }
  return 0;
}

// ---- polling ---------------------------------------------------------------

function ensureDevice(key, kind, id, index) {
  let d = deviceStates.get(key);
  if (!d) {
    d = { key, kind, id, index, cur: new Set(), prev: new Set(), x: 0, y: 0, slot: null, mapped: true };
    deviceStates.set(key, d);
  }
  return d;
}

export function poll() {
  const seen = new Set();
  pausePrev = pauseCur;
  pauseCur = false;

  // test rig: toggle, and pick who the simple key set drives
  for (const k of testCfg.toggleKeys) if (justTapped(k)) testOn = !testOn;
  if (testOn) testCfg.driveKeys.forEach((code, n) => { if (justTapped(code)) driving = n; });

  // keyboard virtual devices
  config.input.keyboard.forEach((map, n) => {
    const key = 'kb:' + n;
    seen.add(key);
    const d = ensureDevice(key, 'keyboard', 'Keyboard ' + (n + 1), n);
    swap(d);
    const driven = testOn && n === driving;
    for (const a of ACTIONS) {
      const code = map[a];
      // a cabinet key that the test rig has claimed only reaches the driven player
      if (!code || (testOn && testKeys.has(code) && !driven)) continue;
      if (isDown(code)) d.cur.add(a);
    }
    if (driven) for (const a of ACTIONS) { const code = testCfg.map[a]; if (code && isDown(code)) d.cur.add(a); }
    d.x = (d.cur.has('right') ? 1 : 0) - (d.cur.has('left') ? 1 : 0);
    d.y = (d.cur.has('down') ? 1 : 0) - (d.cur.has('up') ? 1 : 0);
  });
  for (const k of config.input.pauseKeys) if (isDown(k)) pauseCur = true;
  keysLatched.clear();

  // gamepads
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < pads.length; i++) {
    const gp = pads[i];
    if (!gp) continue;
    const key = 'gp:' + gp.index;
    seen.add(key);
    const d = ensureDevice(key, 'gamepad', gp.id, gp.index);
    swap(d);
    const map = resolveMapping(gp);
    d.mapped = !!map;
    if (!map) continue;
    let x = 0, y = 0;
    for (const a of ACTIONS) {
      const s = bindingStrength(gp, map[a]);
      if (s > 0) d.cur.add(a);
      if (a === 'left') x -= s; else if (a === 'right') x += s;
      else if (a === 'up') y -= s; else if (a === 'down') y += s;
    }
    d.x = Math.max(-1, Math.min(1, x));
    d.y = Math.max(-1, Math.min(1, y));
    if (d.cur.has('pause')) pauseCur = true;
  }

  // drop vanished devices, unbinding their slot
  for (const [key, d] of deviceStates) {
    if (!seen.has(key)) {
      if (d.slot !== null) slotToDevice.delete(d.slot);
      deviceStates.delete(key);
    }
  }
}

function swap(d) {
  const t = d.prev; d.prev = d.cur; d.cur = t; d.cur.clear();
}

// ---- device management -----------------------------------------------------

export function devices() {
  return [...deviceStates.values()].map(d => ({ key: d.key, kind: d.kind, id: d.id, index: d.index, slot: d.slot, mapped: d.mapped }));
}

export function bindDevice(deviceKey, slot) {
  const d = deviceStates.get(deviceKey);
  if (!d) return false;
  d.slot = slot;
  slotToDevice.set(slot, deviceKey);
  return true;
}

export function unbindSlot(slot) {
  const key = slotToDevice.get(slot);
  if (key && deviceStates.has(key)) deviceStates.get(key).slot = null;
  slotToDevice.delete(slot);
}

export function deviceForSlot(slot) {
  const key = slotToDevice.get(slot);
  return key ? deviceStates.get(key) : null;
}

// Unbound devices whose `action` was just pressed this frame — the join prompt.
export function unboundJustPressed(action) {
  const out = [];
  for (const d of deviceStates.values()) {
    if (d.slot === null && d.cur.has(action) && !d.prev.has(action)) out.push(d.key);
  }
  return out;
}

// ---- per-slot reads --------------------------------------------------------

export function held(slot, action) {
  const d = deviceForSlot(slot);
  return !!d && d.cur.has(action);
}

export function justPressed(slot, action) {
  const d = deviceForSlot(slot);
  return !!d && d.cur.has(action) && !d.prev.has(action);
}

export function justReleased(slot, action) {
  const d = deviceForSlot(slot);
  return !!d && !d.cur.has(action) && d.prev.has(action);
}

const zeroAxis = { x: 0, y: 0 };
export function axis(slot) {
  const d = deviceForSlot(slot);
  return d ? d : zeroAxis;   // exposes .x and .y
}

export function anyJustPressed(action) {
  for (const [slot] of slotToDevice) if (justPressed(slot, action)) return slot;
  return null;
}

export function anyDeviceJustPressed(action) {
  for (const d of deviceStates.values()) if (d.cur.has(action) && !d.prev.has(action)) return true;
  return false;
}

// Global pause: any device, bound or not, plus the keyboard pause keys.
export function pauseJustPressed() {
  return pauseCur && !pausePrev;
}
