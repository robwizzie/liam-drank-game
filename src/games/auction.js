// Auction Blitz. An item goes on the block; bidding is drinking. The bid
// glasses are the whole screen: every player's cup pours into a big glass in
// public, and the fullest glass when the timer runs out takes the item. Losing
// bids are drunk anyway. Fold for a consolation point. Dry players hold one
// VETO each: on a round they veto, the top bid is void and the next one wins.
//
// The pour is the drink: hold DRINK and your cup tips over your glass, the
// stream runs, the level climbs. Sustained pouring counts for less (fatigue),
// so the round is sipped in bursts rather than chugged.

import config from '../config.js';
import * as canvas from '../canvas.js';
import * as ui from '../ui.js';
import * as fx from '../fx.js';
import * as audio from '../audio.js';
import * as drink from '../drink.js';
import * as rounds from '../rounds.js';

const T = config.theme;
let cfg = config.games.auction;

let S = null;
const vetoes = new Map();     // slot -> vetoes left; lives for a match, cleared on round 1
const granted = new Set();    // slots already handed their vetoes this match

const ITEM_NAMES = ['GOLDEN TAP', 'TOP SHELF', 'HAPPY HOUR', 'THE JUKEBOX', 'LUCKY COASTER', 'LAST CALL', 'HOUSE ROUND', 'THE GOOD STOOL', 'BOTTOMLESS NUTS', 'VIP BOOTH'];
const DUD_NAMES = ['EMPTY KEG', 'FLAT PINT', 'WARM ONE', 'MYSTERY CAN'];
const TAB_NAMES = ['BAR TAB', 'BROKEN GLASS', 'THE CLEANUP', 'CAB HOME'];

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function makeItem(roundIdx) {
  const safe = cfg.firstRoundSafe && roundIdx === 0;
  const r = Math.random();
  if (!safe && r < cfg.dudChance) return { name: pick(DUD_NAMES), value: 0, kind: 'dud' };
  if (!safe && r < cfg.dudChance + cfg.tabChance) return { name: pick(TAB_NAMES), value: pick(cfg.tabs), kind: 'tab' };
  return { name: pick(ITEM_NAMES), value: pick(cfg.values), kind: 'item' };
}

function valueText(v) { return v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'; }

export default {
  id: 'auction',
  name: 'Auction Blitz',
  tagline: 'Every bid is a drink.',
  minPlayers: 2,
  maxPlayers: 8,
  defaultRounds: 7,
  playAllRounds: true,

  init(playerList, gameCfg) {
    cfg = gameCfg || config.games.auction;
    if (rounds.roundNumber() <= 1) { vetoes.clear(); granted.clear(); }
    const roster = new Map();
    playerList.forEach((p, i) => {
      roster.set(p.slot, {
        p, drink: null, col: i,
        bid: 0, folded: false, vetoArmed: false, voided: false, sold: false,
        hold: 0, holdSpent: false,
        fat: drink.fatigueTracker(cfg.fatigue),
        pour: 0, splashAt: 0, glassPop: 1,
        badge: { scale: 0 },
      });
    });
    S = {
      roster,
      order: playerList.map(p => p.slot),
      item: makeItem(rounds.roundNumber() - 1),
      time: 0,
      phase: 'BID',       // BID → RESOLVE
      rt: 0,              // time in RESOLVE
      events: [],
      lastTick: -1,
      card: { scale: 1 },
      winner: null,
      result: null,
    };
  },

  update(dt, inputs) {
    if (!S) return;
    S.time += dt;

    for (const st of S.roster.values()) {
      const inp = inputs[st.p.slot];
      if (!inp) continue;
      const d = inp.drink;
      st.drink = d;
      // the first time a player is dry in a match, they are handed their vetoes
      if (d.isDry && !granted.has(st.p.slot)) { granted.add(st.p.slot); vetoes.set(st.p.slot, cfg.vetoesPerDry); }

      const pouring = S.phase === 'BID' && !st.folded && d.isDrinking;
      st.pour += ((pouring ? 1 : 0) - st.pour) * (dt > 0 ? 1 - Math.exp(-dt / cfg.pour.raiseSec) : 0);
      if (S.phase === 'BID') {
        const mul = st.fat.update(dt, d.isDrinking);
        if (!st.folded) st.bid += d.effective * mul * dt;
        if (pouring && S.time - st.splashAt > cfg.pour.splashEverySec) {
          st.splashAt = S.time;
          const g = glassGeom(st);
          const surf = g.y + g.h * (1 - Math.min(1, st.bid / cfg.glassFullMl));
          fx.burst(g.x + g.w / 2, surf, { count: 2, color: st.p.color, speed: 160, life: 0.35, size: 8, dir: -Math.PI / 2, spread: 1.6, gravity: 1100 });
        }
        if (!d.isDry) audio.drinkTone(st.p.slot, d.rate, d.remainingPct);
        handleAction(st, inp, d, dt);
      }
    }

    if (S.phase === 'BID') {
      const left = cfg.bidTimeSec - S.time;
      const n = Math.ceil(left);
      if (left <= cfg.escalateSec && n !== S.lastTick && n > 0) {
        S.lastTick = n;
        audio.play('bidTick', { step: cfg.escalateSec - n });
        S.card.scale = cfg.cardGrow * 0.96;
        fx.tween(S.card, { scale: cfg.cardGrow }, config.fx.tween.snapSec, fx.ease.outBack);
      }
      if (left <= 0) beginResolve();
      return;
    }

    // RESOLVE: stamps land on a schedule, then the result goes back to rounds
    if (dt > 0) {
      S.rt += dt;
      while (S.events.length && S.rt >= S.events[0].at) S.events.shift().fn();
    }
    if (S.result && S.rt >= S.finishAt) { const r = S.result; S.result = null; return r; }
  },

  render(ctx) {
    if (!S) return;
    const safe = canvas.safe();
    ctx.fillStyle = T.cream;
    ctx.fillRect(0, 0, canvas.W, canvas.H);

    drawScores(ctx, safe);
    ui.text(ctx, `ROUND ${rounds.roundNumber()} / ${rounds.totalRounds()}`, safe.right - 20, safe.y + T.type.label * 1.05, { size: 'label', color: T.ink, align: 'right' });
    drawCard(ctx, safe);
    drawTimer(ctx, safe);
    for (const st of S.roster.values()) drawGlass(ctx, st);

    // the prompt line; while a veto is armed it carries the one thing everyone needs to know
    const armed = [...S.roster.values()].some(st => st.vetoArmed) && S.phase === 'BID';
    if (armed) {
      ui.badge(ctx, 'VETO ARMED  ·  THE TOP BID IS VOID', safe.cx, safe.bottom - T.type.small * 0.85, { bg: T.ink, size: T.type.small });
    } else {
      const veto = [...S.roster.values()].some(st => st.drink && st.drink.isDry && (vetoes.get(st.p.slot) || 0) > 0);
      const prompt = veto
        ? 'hold DRINK = bid      tap ACTION = fold +1      dry: hold ACTION = VETO'
        : 'hold DRINK = bid      tap ACTION = fold +1';
      ui.text(ctx, prompt, safe.cx, safe.bottom - T.type.small * 0.4, { size: 'small', color: T.ink, align: 'center' });
    }
  },

  teardown() {
    S = null;
    audio.stopAllDrinkTones();
  },

  debugRows() {
    if (!S) return [];
    const rows = [...S.roster.values()].map(st => ({
      slot: st.p.slot,
      text: `bid ${st.bid.toFixed(1)} ml  fatigue ${st.fat.value.toFixed(2)}  ${st.folded ? 'FOLD ' : ''}${st.vetoArmed ? 'VETO-ARMED ' : ''}${st.voided ? 'VOID ' : ''}${st.sold ? 'SOLD ' : ''}vetoes ${vetoes.get(st.p.slot) || 0}`,
    }));
    rows.push({ text: `${S.phase}  item ${S.item.name} ${valueText(S.item.value)}  t ${S.time.toFixed(1)} / ${cfg.bidTimeSec}` });
    return rows;
  },
};

// ---- actions ---------------------------------------------------------------

function handleAction(st, inp, d, dt) {
  const left = vetoes.get(st.p.slot) || 0;
  if (inp.justPressed('action')) { st.hold = 0; st.holdSpent = false; }
  if (inp.held('action')) {
    st.hold += dt;
    if (!st.holdSpent && d.isDry && left > 0 && !st.vetoArmed && st.hold >= cfg.vetoHoldSec) {
      st.holdSpent = true;
      armVeto(st);
    }
  }
  if (inp.justReleased('action')) {
    if (!st.holdSpent && !st.folded) fold(st);
    st.hold = 0; st.holdSpent = false;
  }
}

function fold(st) {
  st.folded = true;
  audio.play('fold', { slot: st.p.slot });
  st.glassPop = 0.92;
  fx.tween(st, { glassPop: 1 }, config.fx.tween.snapSec, fx.ease.outBack);
  const g = glassGeom(st);
  fx.burst(g.x + g.w / 2, g.y, { count: 10, color: T.slate, speed: 200, life: 0.4, size: 8, gravity: 900 });
}

function armVeto(st) {
  st.vetoArmed = true;
  vetoes.set(st.p.slot, (vetoes.get(st.p.slot) || 0) - 1);
  audio.play('veto');
  fx.shake(config.fx.shake.winMag, config.fx.shake.winDur);
  fx.callout(`${st.p.label} VETO`, { color: st.p.color, sub: 'the top bid this round is void' });
  const safe = canvas.safe();
  fx.burst(safe.cx, safe.y + safe.h * 0.28, { count: 50, color: T.ink, speed: 700, life: 0.9, size: 14 });
}

// ---- resolution ------------------------------------------------------------

function beginResolve() {
  S.phase = 'RESOLVE';
  S.rt = 0;
  audio.stopAllDrinkTones();
  const live = [...S.roster.values()].filter(st => !st.folded && st.bid >= cfg.minBidMl).sort((a, b) => b.bid - a.bid);
  const vetoCount = [...S.roster.values()].filter(st => st.vetoArmed).length;
  const r = cfg.resolve;
  let at = 0;
  for (let i = 0; i < vetoCount && live.length; i++) {
    const victim = live.shift();
    at += r.voidGapSec;
    S.events.push({ at, fn: () => voidGlass(victim) });
  }
  const winner = live[0] || null;
  at += r.soldDelaySec;
  S.events.push({ at, fn: () => sell(winner) });
  S.finishAt = at + r.holdSec;
}

function voidGlass(st) {
  st.voided = true;
  audio.play('void');
  fx.shake(config.fx.shake.winMag * 0.7, config.fx.shake.winDur * 0.7);
  st.badge.scale = 0; fx.tween(st.badge, { scale: 1 }, config.fx.tween.snapSec, fx.ease.outBack);
  const g = glassGeom(st);
  fx.burst(g.x + g.w / 2, g.y + g.h * 0.5, { count: 30, color: T.slate, speed: 500, life: 0.7, size: 12 });
}

function sell(winner) {
  const item = S.item;
  const scores = {};
  for (const st of S.roster.values()) if (st.folded) scores[st.p.slot] = cfg.foldConsolation;
  let banner, winners = [];
  if (winner) {
    winner.sold = true;
    S.winner = winner;
    scores[winner.p.slot] = (scores[winner.p.slot] || 0) + item.value;
    audio.play('sold');
    fx.shake(config.fx.shake.winMag, config.fx.shake.winDur);
    winner.badge.scale = 0; fx.tween(winner.badge, { scale: 1 }, config.fx.tween.snapSec * 1.3, fx.ease.outBack);
    const g = glassGeom(winner);
    fx.burst(g.x + g.w / 2, g.y + g.h * 0.4, { count: 45, color: item.value >= 0 ? winner.p.color : T.slate, speed: 650, life: 1, size: 14 });
    if (item.kind === 'item') { winners = [winner.p.slot]; banner = `${winner.p.label} ${valueText(item.value)}`; }
    else if (item.kind === 'dud') banner = `${winner.p.label} WINS A DUD`;
    else banner = `${winner.p.label} PAYS ${valueText(item.value)}`;
  } else {
    audio.play('thud');
    banner = 'NO SALE';
  }
  S.result = { winners, scores, banner };
}

// ---- layout ----------------------------------------------------------------

function cardRect() {
  const safe = canvas.safe();
  const w = 520, h = 226;
  return { x: safe.cx - w / 2, y: safe.y + 8, w, h };
}
function glassTop() { return cardRect().y + cardRect().h + 62; }
function glassFloor() { return canvas.safe().bottom - 205; }

function glassGeom(st) {
  const safe = canvas.safe();
  const n = S.order.length;
  // columns cluster toward the centre: a two-player auction is a face-off, not two corners
  const colW = Math.min(380, (safe.w - 40) / n);
  const areaX = safe.cx - (colW * n) / 2;
  const w = Math.min(210, colW * 0.62);
  const cx = areaX + colW * (st.col + 0.5);
  const y = glassTop();
  return { x: cx - w / 2, y, w, h: glassFloor() - y, cx, colW };
}

// ---- drawing ---------------------------------------------------------------

function drawScores(ctx, safe) {
  const sb = rounds.scoreboard();
  let x = safe.x + 20;
  const y = safe.y + 30;
  for (const st of S.roster.values()) {
    const b = sb.find(q => q.slot === st.p.slot);
    const pts = b ? b.points : 0;
    ui.playerMark(ctx, st.p, x + 22, y, 20);
    ui.text(ctx, String(pts), x + 52, y + T.type.label * 0.36, { size: 'label', color: T.ink });
    x += 60 + Math.max(50, ui.measure(ctx, String(pts), 'label') + 20);
  }
}

function drawCard(ctx, safe) {
  const c = cardRect();
  const item = S.item;
  const sc = S.card.scale;
  ctx.save();
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  ctx.scale(sc, sc);
  ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
  const escalating = S.phase === 'BID' && cfg.bidTimeSec - S.time <= cfg.escalateSec;
  ui.plate(ctx, c.x, c.y, c.w, c.h, { fill: item.kind === 'item' ? T.cream : T.creamDeep, shadow: escalating ? 14 : 8, radius: 16, stroke: escalating ? T.brass : T.ink, keyline: escalating ? 10 : config.players.keylinePx });
  ui.text(ctx, item.name, c.x + c.w / 2, c.y + T.type.label * 1.2, { size: 'label', color: item.kind === 'item' ? T.ink : T.slate, align: 'center' });
  const vColor = item.kind === 'item' ? T.brass : item.kind === 'dud' ? T.slate : T.ink;
  ui.text(ctx, valueText(item.value), c.x + c.w / 2, c.y + c.h - 30, { size: 'title', color: vColor, stroke: item.kind === 'item', align: 'center' });
  if (item.kind !== 'item') ui.badge(ctx, item.kind === 'dud' ? 'DUD' : 'YOU PAY', c.x + c.w - 60, c.y + 30, { bg: item.kind === 'dud' ? T.slate : T.ink, size: 22 });
  ctx.restore();
}

function drawTimer(ctx, safe) {
  const c = cardRect();
  const cx = c.x + c.w + 110, cy = c.y + c.h / 2;
  const left = S.phase === 'BID' ? Math.max(0, cfg.bidTimeSec - S.time) : 0;
  const escalating = left <= cfg.escalateSec && S.phase === 'BID';
  const pct = left / cfg.bidTimeSec;
  ui.gauge(ctx, { kind: 'ring', x: cx, y: cy, r: 64, width: 18, pct, color: escalating ? T.brass : T.bottle, isDry: false, t: S.time });
  const label = S.phase !== 'BID' ? '0' : escalating ? left.toFixed(1) : String(Math.ceil(left));
  ui.text(ctx, label, cx, cy, { size: escalating ? 'big' : 'label', color: escalating ? T.brass : T.ink, stroke: escalating, align: 'center', baseline: 'middle' });
}

function drawGlass(ctx, st) {
  const g = glassGeom(st);
  const p = st.p;
  const d = st.drink;
  const pct = Math.min(1, st.bid / cfg.glassFullMl);
  const dead = st.folded || st.voided;
  const live = [...S.roster.values()].filter(q => !q.folded && !q.voided && q.bid >= cfg.minBidMl);
  const top = live.length ? Math.max(...live.map(q => q.bid)) : 0;
  const leading = !dead && st.bid >= cfg.minBidMl && st.bid >= top;

  ctx.save();
  ctx.translate(g.cx, g.y + g.h);
  ctx.scale(st.glassPop, st.glassPop);
  ctx.translate(-g.cx, -(g.y + g.h));
  ui.cup(ctx, g.x, g.y, g.w, g.h, { pct, color: dead ? T.slate : p.color, ready: st.folded, t: S.time, showBadge: false });
  ctx.restore();

  // the bid, riding the surface
  const surf = g.y + g.h * (1 - pct);
  if (st.bid >= cfg.minBidMl || pct > 0) {
    const ty = Math.max(g.y + T.type.big * 1.1, surf - 14);
    ui.text(ctx, String(Math.round(st.bid)), g.cx, ty, { size: 'big', color: dead ? T.slate : leading ? T.brass : T.ink, stroke: leading && !dead, align: 'center' });
  }

  // stamps
  const stamp = st.sold ? 'SOLD' : st.voided ? 'VOID' : null;
  if (stamp) {
    ctx.save();
    ctx.translate(g.cx, g.y + g.h * 0.64);
    ctx.scale(st.badge.scale, st.badge.scale);
    ctx.rotate(-0.12);
    ui.badge(ctx, stamp, 0, 0, { bg: st.sold ? T.brass : T.ink, color: st.sold ? T.ink : T.cream, size: T.type.label });
    ctx.restore();
  }
  if (st.folded && !stamp) ui.badge(ctx, 'FOLD', g.cx, g.y + g.h * 0.64, { bg: T.slate, size: T.type.label });

  // the player's own cup, tipping over the glass rim while they pour
  const pr = cfg.pour;
  const dir = st.col % 2 === 0 ? 1 : -1;   // alternate sides so neighbouring cups don't kiss
  const restX = g.cx + dir * (g.w * 0.5 + pr.cupW * 0.35), restY = g.y - pr.cupH * 0.55;
  const pourX = g.cx + dir * (g.w * 0.22), pourY = g.y - pr.cupH * 0.7;
  const k = st.pour;
  const cx = restX + (pourX - restX) * k, cy = restY + (pourY - restY) * k;
  const angle = -dir * (pr.tiltDeg * Math.PI / 180) * k;
  if (k > 0.55 && !dead) {
    // the stream: from the low corner of the tipped rim, straight down into the glass
    const lx = -dir * pr.cupW * 0.5, ly = -pr.cupH * 0.5;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const rimX = cx + lx * ca - ly * sa, rimY = cy + lx * sa + ly * ca;
    ctx.save();
    ctx.strokeStyle = p.color; ctx.lineWidth = pr.streamPx * Math.min(1, (k - 0.55) / 0.45); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rimX, rimY); ctx.lineTo(rimX, Math.max(rimY, surf + 4)); ctx.stroke();
    ctx.restore();
  }
  ui.cupAt(ctx, cx, cy, pr.cupW, pr.cupH, angle, { pct: d ? d.remainingPct : 1, color: p.color, isDry: !!(d && d.isDry), t: S.time, showBadge: false, halo: 4 });

  // under the glass: mark, fuel gauge, status
  const under = g.y + g.h;
  ui.playerMark(ctx, p, g.cx, under + 44, 26);
  const gw = Math.min(g.w, g.colW - 24);
  if (d) ui.gauge(ctx, { kind: 'bar', x: g.cx - gw / 2, y: under + 84, w: gw, h: 30, pct: d.remainingPct, color: p.color, isDry: d.isDry, t: S.time });
  const left = vetoes.get(p.slot) || 0;
  let status = '';
  if (st.folded) status = `FOLD  +${cfg.foldConsolation}`;
  else if (st.vetoArmed) status = 'VETO';
  else if (d && d.isDry) status = left > 0 ? `VETO ×${left} READY` : 'DRY';
  else if (st.bid >= cfg.minBidMl) status = 'BID';
  if (status) ui.text(ctx, status, g.cx, under + 84 + 30 + T.type.small * 1.3, { size: 'small', color: st.vetoArmed ? T.ink : T.slate, align: 'center' });
}
