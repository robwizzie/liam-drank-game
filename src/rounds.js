// Round lifecycle state machine. Owns a game module for a match:
// COUNTDOWN → PLAYING → ROUND_END → TOP_UP → (COUNTDOWN | MATCH_END)

import config from './config.js';
import * as canvas from './canvas.js';
import * as ui from './ui.js';
import * as fx from './fx.js';
import * as audio from './audio.js';
import * as drink from './drink.js';
import * as players from './players.js';

const T = config.theme;

let S = null;   // match state

export function active() { return !!S; }
export function phase() { return S ? S.phase : null; }
export function game() { return S ? S.game : null; }
export function roundNumber() { return S ? S.round + 1 : 0; }
export function totalRounds() { return S ? S.total : 0; }
export function timeInPhase() { return S ? S.t : 0; }

export function scoreboard() {
  if (!S) return [];
  return players.all().map(p => ({ slot: p.slot, points: S.points.get(p.slot) || 0, roundsWon: S.roundsWon.get(p.slot) || 0 }));
}

export function startMatch(gameModule, opts = {}) {
  const cfg = config.games[gameModule.id] || {};
  S = {
    game: gameModule,
    cfg,
    total: opts.rounds ?? cfg.rounds ?? gameModule.defaultRounds ?? 3,
    round: 0,
    points: new Map(),
    roundsWon: new Map(),
    phase: 'COUNTDOWN',
    t: 0,
    countdownLast: -1,
    result: null,
    matchResult: null,
    topup: null,
    waterMark: new Map(),   // slot -> floor(sessionTotal / threshold) at last TOP_UP
    onExit: opts.onExit || null,
    banner: { scale: 0 },
  };
  for (const p of players.all()) S.waterMark.set(p.slot, Math.floor(drink.state(p.slot).sessionTotal / config.drink.waterPromptEveryMl));
  beginRound();
}

function beginRound() {
  S.phase = 'COUNTDOWN';
  S.t = 0;
  S.countdownLast = -1;
  S.result = null;
  drink.beginRound();
  S.game.init(players.all(), S.cfg);
}

export function abort() {
  if (!S) return;
  S.game.teardown();
  audio.stopAllDrinkTones();
  const cb = S.onExit;
  S = null;
  if (cb) cb();
}

function setPhase(p) { S.phase = p; S.t = 0; }

export function update(dt, inputs) {
  if (!S) return;
  S.t += dt;
  switch (S.phase) {
    case 'COUNTDOWN': {
      const left = config.rounds.countdownSec - S.t;
      const n = Math.ceil(left);
      if (n !== S.countdownLast) {
        S.countdownLast = n;
        if (n > 0) { audio.play('tick'); S.banner.scale = 0; fx.tween(S.banner, { scale: 1 }, config.fx.tween.snapSec, fx.ease.outBack); }
      }
      if (left <= 0) {
        setPhase('PLAYING');
        audio.play('roundStart');
        S.banner.scale = 0; fx.tween(S.banner, { scale: 1 }, config.fx.tween.snapSec, fx.ease.outBack);
      }
      break;
    }
    case 'PLAYING': {
      for (const p of players.all()) {
        const d = drink.state(p.slot);
        if (d.justWentDry) {
          fx.callout(`${p.label} IS DRY`, { color: p.color, sub: 'digging in' });
          fx.shake(config.fx.shake.dryMag, config.fx.shake.dryDur);
          audio.play('dry', { slot: p.slot });
        }
      }
      const result = S.game.update(dt, inputs);
      if (result) endRound(result);
      break;
    }
    case 'ROUND_END': {
      S.game.update(0, inputs);   // let the game keep animating its win pose with zero dt
      if (S.t >= config.rounds.roundEndHoldSec) {
        if (matchDecided()) beginMatchEnd(); else beginTopUp(S.round + 1);
      }
      break;
    }
    case 'TOP_UP': updateTopUp(dt, inputs); break;
    case 'MATCH_END': {
      for (const p of players.all()) {
        if (inputs[p.slot] && inputs[p.slot].justPressed('action')) {
          // rematch: instant, via TOP UP so cups can be refilled
          S.points.clear(); S.roundsWon.clear(); S.matchResult = null;
          audio.play('select');
          beginTopUp(0);
          break;
        }
      }
      break;
    }
  }
}

function endRound(result) {
  S.result = result;
  for (const slot in result.scores || {}) S.points.set(Number(slot), (S.points.get(Number(slot)) || 0) + result.scores[slot]);
  for (const slot of result.winners || []) S.roundsWon.set(slot, (S.roundsWon.get(slot) || 0) + 1);
  setPhase('ROUND_END');
  audio.stopAllDrinkTones();
  audio.play('win');
  fx.shake(config.fx.shake.winMag, config.fx.shake.winDur);
  S.banner.scale = 0; fx.tween(S.banner, { scale: 1 }, config.fx.tween.snapSec * 1.4, fx.ease.outBack);
  const safe = canvas.safe();
  for (const slot of result.winners || []) {
    const p = players.get(slot);
    if (p) fx.burst(safe.cx + (Math.random() - 0.5) * safe.w * 0.5, safe.cy, { count: 40, color: p.color, speed: 700, life: 1.1, size: 16 });
  }
}

function matchDecided() {
  const played = S.round + 1;
  if (played >= S.total) return true;
  // early finish: someone has a majority of rounds
  const need = Math.floor(S.total / 2) + 1;
  for (const v of S.roundsWon.values()) if (v >= need) return true;
  return false;
}

function beginTopUp(nextRound) {
  setPhase('TOP_UP');
  audio.stopAllDrinkTones();
  S.topup = { nextRound, confirmed: new Set(), hold: new Map(), refilled: new Set(), water: new Set(), allAt: null };
  for (const p of players.all()) {
    const mark = Math.floor(drink.state(p.slot).sessionTotal / config.drink.waterPromptEveryMl);
    if (mark > (S.waterMark.get(p.slot) || 0)) { S.topup.water.add(p.slot); S.waterMark.set(p.slot, mark); }
  }
}

function updateTopUp(dt, inputs) {
  const tu = S.topup;
  for (const p of players.all()) {
    const inp = inputs[p.slot];
    if (!inp || tu.confirmed.has(p.slot)) continue;
    if (inp.held('action')) {
      const h = (tu.hold.get(p.slot) || 0) + dt;
      tu.hold.set(p.slot, h);
      if (h >= config.rounds.refillHoldSec) {
        drink.refill(p.slot);
        tu.refilled.add(p.slot);
        tu.confirmed.add(p.slot);
        audio.play('refill', { slot: p.slot });
        audio.play('ready', { slot: p.slot });
      }
    } else if (tu.hold.has(p.slot)) {
      // released before the refill threshold: ready as-is (dry by choice is first-class)
      tu.hold.delete(p.slot);
      tu.confirmed.add(p.slot);
      audio.play('ready', { slot: p.slot });
    }
  }
  const all = players.all();
  if (all.length && all.every(p => tu.confirmed.has(p.slot))) {
    if (tu.allAt === null) tu.allAt = S.t;
    if (S.t - tu.allAt >= config.rounds.topUpAutoStartSec) {
      S.round = tu.nextRound;
      beginRound();
    }
  }
}

function beginMatchEnd() {
  setPhase('MATCH_END');
  const board = scoreboard();
  let summary;
  if (S.game.matchSummary) summary = S.game.matchSummary(board, players.all());
  else {
    const top = Math.max(...board.map(b => b.points));
    const winners = board.filter(b => b.points === top).map(b => b.slot);
    summary = { winners, banner: winners.length === 1 ? players.get(winners[0]).label + ' WINS' : winners.length === board.length ? 'DRAW' : winners.map(s => players.get(s).label).join(' ') + ' WIN' };
  }
  S.matchResult = summary;
  audio.play('win');
  fx.shake(config.fx.shake.winMag, config.fx.shake.winDur);
  S.banner.scale = 0; fx.tween(S.banner, { scale: 1 }, config.fx.tween.snapSec * 1.6, fx.ease.outElastic);
  const safe = canvas.safe();
  for (let i = 0; i < 3; i++) for (const slot of summary.winners) {
    const p = players.get(slot);
    fx.burst(safe.x + Math.random() * safe.w, safe.y + safe.h * 0.3, { count: 30, color: p.color, speed: 600, life: 1.4, size: 18 });
  }
}

// ---- render ----------------------------------------------------------------
export function render(ctx, w, h) {
  if (!S) return;
  S.game.render(ctx, w, h);
  const safe = canvas.safe();
  switch (S.phase) {
    case 'COUNTDOWN': {
      const n = Math.max(1, Math.ceil(config.rounds.countdownSec - S.t));
      ctx.save();
      ctx.translate(safe.cx, safe.y + safe.h * 0.34);
      ctx.scale(S.banner.scale, S.banner.scale);
      ui.text(ctx, `ROUND ${S.round + 1}`, 0, -T.type.hero * 0.5, { size: 'big', color: T.ink, align: 'center', baseline: 'middle' });
      ui.text(ctx, String(n), 0, T.type.hero * 0.1, { size: 'hero', color: T.brass, stroke: true, align: 'center', baseline: 'middle' });
      ctx.restore();
      break;
    }
    case 'PLAYING': {
      if (S.t < 0.9) {
        const k = 1 - S.t / 0.9;
        ctx.save(); ctx.globalAlpha = Math.min(1, k * 2);
        ctx.translate(safe.cx, safe.y + safe.h * 0.34); ctx.scale(S.banner.scale, S.banner.scale);
        ui.text(ctx, 'GO', 0, T.type.hero * 0.1, { size: 'hero', color: T.brass, stroke: true, align: 'center', baseline: 'middle' });
        ctx.restore();
      }
      break;
    }
    case 'ROUND_END': {
      const r = S.result;
      ctx.save();
      ctx.translate(safe.cx, safe.y + safe.h * 0.3);
      ctx.scale(S.banner.scale, S.banner.scale);
      const color = r.winners && r.winners.length === 1 ? players.get(r.winners[0]).color : T.brass;
      ui.text(ctx, r.banner || 'ROUND OVER', 0, 0, { size: r.banner && r.banner.length > 9 ? 'title' : 'hero', color, stroke: true, align: 'center', baseline: 'middle' });
      ctx.restore();
      break;
    }
    case 'TOP_UP': renderTopUp(ctx, safe); break;
    case 'MATCH_END': renderMatchEnd(ctx, safe); break;
  }
}

function dim(ctx, w, h) {
  ctx.fillStyle = T.cream;
  ctx.globalAlpha = 0.93;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

function renderTopUp(ctx, safe) {
  dim(ctx, canvas.W, canvas.H);
  const tu = S.topup;
  const all = players.all();
  ui.text(ctx, 'TOP UP', safe.cx, safe.y + T.type.title * 0.95, { size: 'title', color: T.ink, align: 'center' });

  const n = all.length;
  const cupW = Math.min(150, (safe.w * 0.8) / n - 30);
  const cupH = cupW * 1.35;
  const gap = Math.min(60, cupW * 0.45);
  const totalW = n * cupW + (n - 1) * gap;
  const x0 = safe.cx - totalW / 2;
  const cy = safe.cy - cupH * 0.15;
  all.forEach((p, i) => {
    const x = x0 + i * (cupW + gap);
    const d = drink.state(p.slot);
    const hold = tu.hold.get(p.slot) || 0;
    let pct = d.remainingPct;
    // refill preview while holding
    if (!tu.confirmed.has(p.slot) && hold > 0) pct = Math.max(pct, Math.min(1, hold / config.rounds.refillHoldSec));
    ui.playerMark(ctx, p, x + cupW / 2, cy - cupH * 0.35, cupW * 0.28);
    ui.cup(ctx, x, cy, cupW, cupH, { pct, color: p.color, isDry: d.isDry && !(hold > 0), ready: tu.confirmed.has(p.slot), t: S.t });
    const under = cy + cupH + T.type.label * 1.2;
    if (tu.confirmed.has(p.slot)) ui.text(ctx, 'READY', x + cupW / 2, under, { size: 'label', color: T.ink, align: 'center' });
    else if (hold > 0) ui.text(ctx, 'FILLING', x + cupW / 2, under, { size: 'label', color: T.brass, stroke: true, align: 'center' });
    ui.text(ctx, players.capacityLabel(p), x + cupW / 2, under + T.type.small * 1.4, { size: 'small', color: T.slate, align: 'center' });
  });

  const hintY = safe.bottom - T.type.small * 4.6;
  ui.text(ctx, 'tap ACTION = ready as you are      hold ACTION = refill', safe.cx, hintY, { size: 'small', color: T.ink, align: 'center' });

  let wy = hintY + T.type.small * 1.8;
  for (const p of all) {
    if (!tu.water.has(p.slot)) continue;
    const litres = (drink.state(p.slot).sessionTotal / 1000).toFixed(1);
    ui.text(ctx, `${p.label} · ${litres} L tonight. Water round? It'd be a good one.`, safe.cx, wy, { size: 'small', color: T.slate, align: 'center' });
    wy += T.type.small * 1.4;
  }

  // round score strip
  const sb = scoreboard();
  const strip = sb.map(b => `${players.get(b.slot).label} ${b.points}`).join('   ');
  ui.text(ctx, `next: round ${tu.nextRound + 1} of ${S.total}    ${strip}`, safe.cx, safe.y + T.type.title * 1.7, { size: 'small', color: T.slate, align: 'center' });
}

function renderMatchEnd(ctx, safe) {
  dim(ctx, canvas.W, canvas.H);
  const r = S.matchResult;
  ctx.save();
  ctx.translate(safe.cx, safe.y + safe.h * 0.28);
  ctx.scale(S.banner.scale, S.banner.scale);
  const color = r.winners.length === 1 ? players.get(r.winners[0]).color : T.brass;
  ui.text(ctx, r.banner, 0, 0, { size: r.banner.length > 9 ? 'title' : 'hero', color, stroke: true, align: 'center', baseline: 'middle' });
  ctx.restore();

  const sb = scoreboard().sort((a, b) => b.points - a.points);
  const rowH = T.type.big * 1.25;
  let y = safe.y + safe.h * 0.5;
  for (const b of sb) {
    const p = players.get(b.slot);
    ui.playerMark(ctx, p, safe.cx - 220, y, T.type.big * 0.42);
    ui.text(ctx, p.label, safe.cx - 150, y + T.type.big * 0.35, { size: 'big', color: T.ink });
    ui.text(ctx, String(b.points), safe.cx + 220, y + T.type.big * 0.35, { size: 'big', color: r.winners.includes(b.slot) ? T.brass : T.ink, stroke: r.winners.includes(b.slot), align: 'right' });
    y += rowH;
    if (y > safe.bottom - rowH * 1.5) break;
  }
  ui.text(ctx, 'ACTION = play again      PAUSE = menu', safe.cx, safe.bottom - T.type.small, { size: 'small', color: T.ink, align: 'center' });
}
