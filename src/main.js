// Boot: canvas, rAF loop, screen switching, global pause.

import config from './config.js';
import * as canvas from './canvas.js';
import * as input from './input.js';
import * as drink from './drink.js';
import * as players from './players.js';
import * as rounds from './rounds.js';
import * as fx from './fx.js';
import * as audio from './audio.js';
import * as ui from './ui.js';
import * as launcher from './launcher.js';

const T = config.theme;
const el = document.getElementById('game');
const ctx = el.getContext('2d', { alpha: false });
canvas.attach(el);

let screen = 'launcher';
let paused = false;
let pauseSel = 0;   // 0 resume, 1 quit
let last = performance.now();

// The per-frame inputs handed to games and rounds. One object per slot,
// reused every frame. The 'drink' action is deliberately not reachable here.
const inputs = [];
for (let slot = 0; slot < config.players.maxPlayers; slot++) {
  const guard = a => { if (a === 'drink') throw new Error('games must read inputs[slot].drink, not the drink button'); return a; };
  inputs.push({
    slot,
    x: 0, y: 0,
    held: a => input.held(slot, guard(a)),
    justPressed: a => input.justPressed(slot, guard(a)),
    justReleased: a => input.justReleased(slot, guard(a)),
    drink: null,
  });
}

function refreshInputs() {
  for (const p of players.all()) {
    const i = inputs[p.slot];
    const ax = input.axis(p.slot);
    i.x = ax.x; i.y = ax.y;
    i.drink = drink.state(p.slot);
  }
}

function startGame(game) {
  screen = 'rounds';
  rounds.startMatch(game, { onExit: () => { screen = 'launcher'; launcher.init(startGame); } });
}

// first user gesture unlocks audio
for (const ev of ['keydown', 'pointerdown']) window.addEventListener(ev, () => audio.unlock(), { once: false });

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > config.display.maxDt) dt = config.display.maxDt;

  input.poll();
  if (input.anyDeviceJustPressed('drink') || input.anyDeviceJustPressed('action')) audio.unlock();

  if (input.pauseJustPressed()) {
    paused = !paused;
    pauseSel = 0;
    audio.play(paused ? 'thud' : 'select');
    if (paused) audio.stopAllDrinkTones();
  }

  if (!paused) {
    drink.update(dt);
    refreshInputs();
    if (screen === 'launcher') launcher.update(dt);
    else rounds.update(dt, inputs);
    fx.update(dt);
  } else {
    updatePauseMenu();
  }
  audio.update(dt);

  canvas.begin(ctx, T.ink);
  ctx.save();
  fx.applyShake(ctx);
  if (screen === 'launcher') launcher.render(ctx, canvas.W, canvas.H);
  else rounds.render(ctx, canvas.W, canvas.H);
  fx.render(ctx);
  ctx.restore();
  if (paused) renderPause(ctx);
  canvas.end(ctx);

  requestAnimationFrame(frame);
}

function updatePauseMenu() {
  const opts = screen === 'rounds' ? 2 : 1;
  if (input.anyJustPressed('up') !== null || input.anyJustPressed('down') !== null) {
    pauseSel = (pauseSel + 1) % opts;
    audio.play('select');
  }
  if (input.anyJustPressed('action') !== null) {
    if (pauseSel === 0) { paused = false; audio.play('select'); }
    else { paused = false; rounds.abort(); audio.play('thud'); }
  }
}

function renderPause(ctx) {
  const safe = canvas.safe();
  ctx.fillStyle = T.ink;
  ctx.globalAlpha = 0.72;
  ctx.fillRect(0, 0, canvas.W, canvas.H);
  ctx.globalAlpha = 1;
  ui.text(ctx, 'PAUSED', safe.cx, safe.cy - T.type.title * 0.4, { size: 'title', color: T.cream, stroke: true, align: 'center', baseline: 'middle' });
  const items = screen === 'rounds' ? ['RESUME', 'QUIT TO CABINET'] : ['RESUME'];
  items.forEach((s, i) => {
    const y = safe.cy + T.type.big * (0.6 + i * 1.2);
    const sel = i === pauseSel;
    ui.text(ctx, s, safe.cx, y, { size: 'big', color: sel ? T.brass : T.cream, stroke: sel, align: 'center', baseline: 'middle' });
    if (sel) {
      ctx.fillStyle = T.brass;
      ctx.beginPath(); ctx.moveTo(safe.cx - 320, y - 20); ctx.lineTo(safe.cx - 280, y); ctx.lineTo(safe.cx - 320, y + 20); ctx.closePath(); ctx.fill();
    }
  });
  ui.text(ctx, 'PAUSE = resume    ▴ ▾ = choose    ACTION = confirm', safe.cx, safe.bottom - T.type.small, { size: 'small', color: T.cream, align: 'center' });
}

async function boot() {
  try { await document.fonts.load(`40px "Alfa Slab One"`); } catch (e) { /* fall back to Impact stack */ }
  drink.start();
  launcher.init(startGame);
  last = performance.now();
  requestAnimationFrame(frame);
}

boot();
