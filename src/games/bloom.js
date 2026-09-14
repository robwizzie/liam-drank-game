// Bloom. An arena with thick walls and gaps that only small bodies fit
// through. Drinking grows you; bigger eats smaller on contact; you can never
// shrink. Dry players lock at their size — small-and-dry keeps every corridor,
// mid-size-and-dry is the trap. Score is time survived plus size, so hiding
// pays and so does hunting. ACTION is a short dash, and dry players keep it.
//
// The drink reads as a drink: a little cup at the body's shoulder tips while
// you pour, and the body swells with each gulp.

import config from '../config.js';
import * as canvas from '../canvas.js';
import * as ui from '../ui.js';
import * as fx from '../fx.js';
import * as audio from '../audio.js';
import * as drink from '../drink.js';
import * as rounds from '../rounds.js';

const T = config.theme;
let cfg = config.games.bloom;

let S = null;

const STRIP_H = 60;   // the quiet status strip above the arena

// ---- the arena, hand-authored ---------------------------------------------
// Coordinates are arena-local: (0,0) is the arena's top-left inside the safe
// area, the arena is safe.w wide and (safe.h - STRIP_H) tall. Gap widths come
// from config so retuning startRadius keeps the level honest.

function buildLevel(W, H) {
  const t = cfg.wallPx;
  const u = cfg.startRadius;
  const gs = 2 * u * cfg.gaps.smallRadii + cfg.gaps.clearPx;    // small gap width
  const gm = 2 * u * cfg.gaps.medRadii + cfg.gaps.clearPx;      // medium gap width
  const cw = 2 * u * cfg.gaps.corridorRadii;                    // corridor width
  const walls = [];
  const wall = (x, y, w, h) => walls.push({ x, y, w, h });

  // border
  wall(0, 0, W, t); wall(0, H - t, W, t); wall(0, 0, t, H); wall(W - t, 0, t, H);

  // LEFT POCKET — the small-and-dry home. Three small doors, one pillar inside.
  const px1 = 460, py0 = 300, py1 = 700;
  wall(0, py0, 340, t); wall(340 + gs, py0, px1 + t - (340 + gs), t);          // top, door near the right
  wall(0, py1 - t, 120, t); wall(120 + gs, py1 - t, px1 + t - (120 + gs), t);  // bottom, door near the left
  wall(px1, py0, t, 150); wall(px1, 150 + py0 + gs, t, py1 - (150 + py0 + gs));  // right, door in the middle
  wall(200, 470, 60, 60);

  // RIGHT LOOP — a corridor around a block. Two medium doors: left wall and bottom wall.
  const rx0 = 1150, rx1 = 1700, ry0 = 200, ry1 = 760;
  const doorY = (ry0 + ry1) / 2 - gm / 2;
  const doorX = 1400;
  wall(rx0, ry0, rx1 - rx0, t);                                                 // top
  wall(rx0, ry1 - t, doorX - rx0, t); wall(doorX + gm, ry1 - t, rx1 - (doorX + gm), t);   // bottom, door
  wall(rx0, ry0, t, doorY - ry0); wall(rx0, doorY + gm, t, ry1 - (doorY + gm));           // left, door
  wall(rx1 - t, ry0, t, ry1 - ry0);                                             // right
  wall(rx0 + t + cw, ry0 + t + cw, (rx1 - t - cw) - (rx0 + t + cw), (ry1 - t - cw) - (ry0 + t + cw));   // the block

  // CENTRE — open, with three slabs for cover and cornering
  wall(700, 150, t, 220);
  wall(620, 560, 300, t);
  wall(1000, 600, t, 200);

  const spawns = [
    { x: 300, y: 150 }, { x: 1450, y: 110 }, { x: 300, y: 820 }, { x: 1450, y: 840 },
    { x: 860, y: 300 }, { x: 860, y: 720 }, { x: 560, y: 470 }, { x: 1060, y: 440 },
  ];
  return { walls, spawns, W, H };
}

export default {
  id: 'bloom',
  name: 'Bloom',
  tagline: 'Grow. Eat. Get stuck.',
  minPlayers: 2,
  maxPlayers: 8,
  defaultRounds: 3,
  playAllRounds: true,

  init(playerList, gameCfg) {
    cfg = gameCfg || config.games.bloom;
    const safe = canvas.safe();
    const level = buildLevel(safe.w, safe.h - STRIP_H);
    const roster = new Map();
    playerList.forEach((p, i) => {
      const sp = level.spawns[i % level.spawns.length];
      roster.set(p.slot, {
        p, drink: null,
        x: sp.x, y: sp.y, vx: 0, vy: 0, r: cfg.startRadius,
        faceX: i % 2 === 0 ? 1 : -1, faceY: 0,
        alive: true, survived: 0, eats: 0, eatenBy: null,
        dashT: 0, dashCool: 0,
        fat: drink.fatigueTracker(cfg.fatigue),
        sip: 0, gulpAt: 0, bumpAt: 0,
        pop: 1,
      });
    });
    S = {
      level, roster,
      ox: safe.x, oy: safe.y + STRIP_H,   // arena origin in screen space
      time: 0,
      over: false,
      lastTick: -1,
    };
  },

  update(dt, inputs) {
    if (!S) return;
    S.time += dt;
    const lv = S.level;

    // ---- intent, growth, motion
    for (const st of S.roster.values()) {
      const inp = inputs[st.p.slot];
      if (!inp) continue;
      const d = inp.drink;
      st.drink = d;
      const drinking = d.isDrinking && !S.over;
      st.sip += ((drinking ? 1 : 0) - st.sip) * (dt > 0 ? 1 - Math.exp(-dt / cfg.cupIcon.raiseSec) : 0);
      if (!st.alive) { audio.drinkTone(st.p.slot, 0, 1); continue; }
      st.survived = S.time;
      if (S.over || dt <= 0) continue;

      // growth: area per ml, fatigue on sustained flow, capped. Dry → rate is 0 → locked.
      const mul = st.fat.update(dt, d.isDrinking);
      const gain = d.effective * mul * dt * cfg.growthAreaPerMl;
      if (gain > 0) {
        const before = st.r;
        st.r = Math.min(cfg.maxRadius, Math.sqrt(st.r * st.r + gain));
        if (st.r > before && S.time - st.gulpAt > 0.12) {
          st.gulpAt = S.time;
          const a = Math.random() * Math.PI * 2;
          fx.burst(sx(st.x) + Math.cos(a) * st.r, sy(st.y) + Math.sin(a) * st.r, { count: 2, color: st.p.color, speed: 90, life: 0.35, size: 7, dir: a, spread: 0.8, gravity: 0 });
        }
      }
      audio.drinkTone(st.p.slot, d.rate, d.remainingPct);

      // movement
      let ix = inp.x, iy = inp.y;
      const il = Math.hypot(ix, iy);
      if (il > 1) { ix /= il; iy /= il; }
      if (il > 0.2) { st.faceX = ix / il; st.faceY = iy / il; }
      const spd = speedFor(st.r);
      if (inp.justPressed('action') && st.dashCool <= 0) {
        st.dashT = cfg.dash.sec; st.dashCool = cfg.dash.cooldownSec;
        st.vx = st.faceX * spd * cfg.dash.mul; st.vy = st.faceY * spd * cfg.dash.mul;
        audio.play('dash', { slot: st.p.slot });
        fx.burst(sx(st.x) - st.faceX * st.r, sy(st.y) - st.faceY * st.r, { count: 8, color: st.p.color, speed: 260, life: 0.3, size: 8, dir: Math.atan2(-st.faceY, -st.faceX), spread: 0.9, gravity: 0 });
        st.pop = 0.86; fx.tween(st, { pop: 1 }, config.fx.tween.snapSec, fx.ease.outBack);
      }
      st.dashCool = Math.max(0, st.dashCool - dt);
      if (st.dashT > 0) st.dashT -= dt;
      else {
        const k = Math.min(1, dt * cfg.accel);
        st.vx += (ix * spd - st.vx) * k;
        st.vy += (iy * spd - st.vy) * k;
      }
      st.x += st.vx * dt;
      st.y += st.vy * dt;
    }

    if (S.over || dt <= 0) return;

    // ---- walls
    for (const st of S.roster.values()) {
      if (!st.alive) continue;
      let hit = 0;
      for (let pass = 0; pass < 2; pass++) for (const w of lv.walls) hit = Math.max(hit, pushOut(st, w));
      if (hit > 0) {
        const v = Math.hypot(st.vx, st.vy);
        if (v > cfg.bump.minSpeed && S.time - st.bumpAt > cfg.bump.everySec) {
          st.bumpAt = S.time;
          audio.play('bump');
          fx.burst(sx(st.x), sy(st.y), { count: 6, color: T.slate, speed: 140, life: 0.3, size: 7, gravity: 0 });
          st.pop = 0.9; fx.tween(st, { pop: 1 }, config.fx.tween.snapSec, fx.ease.outBack);
        }
      }
    }

    // ---- bodies: eat or bump
    const alive = [...S.roster.values()].filter(st => st.alive);
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const big = a.r >= b.r ? a : b, small = big === a ? b : a;
      if (big.r >= cfg.eatRatio * small.r) {
        // eatable: no shoving, the big body runs straight through until enough of the small one is inside
        if (dist < big.r + small.r * (1 - 2 * cfg.eatOverlap)) eat(big, small);
        continue;
      }
      const overlap = a.r + b.r - dist;
      if (overlap > 0) {
        const nx = dx / dist, ny = dy / dist;
        const ma = a.r * a.r, mb = b.r * b.r;
        const ka = mb / (ma + mb), kb = ma / (ma + mb);
        a.x -= nx * overlap * ka; a.y -= ny * overlap * ka;
        b.x += nx * overlap * kb; b.y += ny * overlap * kb;
      }
    }

    // ---- clock and the bell
    const left = cfg.roundTimeSec - S.time;
    const n = Math.ceil(left);
    if (left <= 5 && n !== S.lastTick && n > 0) { S.lastTick = n; audio.play('tickHigh'); }
    const standing = [...S.roster.values()].filter(st => st.alive);
    if (standing.length <= 1 && S.roster.size >= 2) return finish(standing[0] || null);
    if (left <= 0) return finish(null);
  },

  render(ctx) {
    if (!S) return;
    const safe = canvas.safe();
    const lv = S.level;
    ctx.fillStyle = T.cream;
    ctx.fillRect(0, 0, canvas.W, canvas.H);

    // walls: ink pass expanded by the keyline, then the bottle fill, so abutting
    // slabs merge into one silhouette with a single outline
    const kl = config.players.keylinePx;
    ctx.fillStyle = T.ink;
    for (const w of lv.walls) ctx.fillRect(sx(w.x) - kl, sy(w.y) - kl, w.w + kl * 2, w.h + kl * 2);
    ctx.fillStyle = T.bottle;
    for (const w of lv.walls) ctx.fillRect(sx(w.x), sy(w.y), w.w, w.h);

    // ghosts of the eaten, where they fell
    for (const st of S.roster.values()) {
      if (st.alive) continue;
      ctx.save(); ctx.globalAlpha = 0.35;
      ui.playerMark(ctx, st.p, sx(st.x), sy(st.y), st.r, { dry: true });
      ctx.restore();
    }

    // bodies, small drawn last so a body inside a gap stays readable
    const bodies = [...S.roster.values()].filter(st => st.alive).sort((a, b) => b.r - a.r);
    for (const st of bodies) drawBody(ctx, st);

    drawStrip(ctx, safe);
  },

  teardown() {
    S = null;
    audio.stopAllDrinkTones();
  },

  debugRows() {
    if (!S) return [];
    const rows = [...S.roster.values()].map(st => ({
      slot: st.p.slot,
      text: `r ${st.r.toFixed(1)}  at ${st.x.toFixed(0)},${st.y.toFixed(0)}  spd ${speedFor(st.r).toFixed(0)}  fatigue ${st.fat.value.toFixed(2)}  eats ${st.eats}  ${st.alive ? 'alive' : 'eaten by P' + (st.eatenBy + 1)} ${st.survived.toFixed(1)}s`,
    }));
    rows.push({ text: `time ${S.time.toFixed(1)} / ${cfg.roundTimeSec}  walls ${S.level.walls.length}` });
    return rows;
  },
};

// ---- rules -----------------------------------------------------------------

function speedFor(r) { return cfg.speedMax * Math.pow(cfg.startRadius / r, cfg.speedFalloffExp); }

function sx(x) { return S.ox + x; }
function sy(y) { return S.oy + y; }

// circle vs axis-aligned rect: push the body out, kill velocity into the wall.
// Returns how far it was pushed.
function pushOut(st, w) {
  const cx = Math.max(w.x, Math.min(st.x, w.x + w.w));
  const cy = Math.max(w.y, Math.min(st.y, w.y + w.h));
  let dx = st.x - cx, dy = st.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= st.r * st.r) return 0;
  if (d2 === 0) {
    // centre inside the slab: leave by the nearest face
    const l = st.x - w.x, r = w.x + w.w - st.x, t = st.y - w.y, b = w.y + w.h - st.y;
    const m = Math.min(l, r, t, b);
    if (m === l) { st.x = w.x - st.r; st.vx = Math.min(0, st.vx); }
    else if (m === r) { st.x = w.x + w.w + st.r; st.vx = Math.max(0, st.vx); }
    else if (m === t) { st.y = w.y - st.r; st.vy = Math.min(0, st.vy); }
    else { st.y = w.y + w.h + st.r; st.vy = Math.max(0, st.vy); }
    return st.r;
  }
  const d = Math.sqrt(d2);
  const push = st.r - d;
  dx /= d; dy /= d;
  st.x += dx * push; st.y += dy * push;
  const into = st.vx * dx + st.vy * dy;
  if (into < 0) { st.vx -= dx * into; st.vy -= dy * into; }
  return push;
}

function eat(big, small) {
  small.alive = false;
  small.eatenBy = big.p.slot;
  small.survived = S.time;
  big.eats += 1;
  big.r = Math.min(cfg.maxRadius, Math.sqrt(big.r * big.r + cfg.eatGrowthFrac * small.r * small.r));
  big.pop = 1.25; fx.tween(big, { pop: 1 }, config.fx.tween.snapSec * 1.6, fx.ease.outElastic);
  audio.play('eat', { slot: big.p.slot });
  audio.play('eliminated', { slot: small.p.slot });
  fx.shake(config.fx.shake.winMag * 0.6, config.fx.shake.winDur * 0.6);
  fx.burst(sx(small.x), sy(small.y), { count: 36, color: small.p.color, speed: 520, life: 0.8, size: 12 });
  fx.callout(`${big.p.label} EATS ${small.p.label}`, { color: big.p.color });
}

function roundScores() {
  const sc = cfg.score;
  const scores = {};
  for (const st of S.roster.values()) {
    let pts = st.eats * sc.eatPoints + Math.floor(st.survived / sc.survivalSecPerPoint);
    if (st.alive) pts += Math.round((st.r / cfg.maxRadius) * sc.sizePoints);
    scores[st.p.slot] = pts;
  }
  return scores;
}

function finish(lastStanding) {
  S.over = true;
  audio.stopAllDrinkTones();
  for (const st of S.roster.values()) if (st.alive) st.survived = S.time;
  const scores = roundScores();
  const top = Math.max(...Object.values(scores));
  const winners = Object.keys(scores).filter(s => scores[s] === top).map(Number);
  let banner;
  if (lastStanding) { audio.play('impact'); banner = `${lastStanding.p.label} LAST STANDING`; }
  else { audio.play('thud'); banner = 'TIME'; }
  return { winners, scores, banner };
}

// ---- drawing ---------------------------------------------------------------

function drawBody(ctx, st) {
  const p = st.p;
  const d = st.drink;
  const x = sx(st.x), y = sy(st.y);
  const r = st.r * st.pop;

  // dash cooldown: a brass tick under the body while it recharges
  if (st.dashCool > 0) {
    const k = 1 - st.dashCool / cfg.dash.cooldownSec;
    ctx.fillStyle = T.creamDeep;
    ctx.fillRect(x - r * 0.6, y + r + cfg.ring.gapPx + cfg.ring.widthPx + 10, r * 1.2, 8);
    ctx.fillStyle = T.brass;
    ctx.fillRect(x - r * 0.6, y + r + cfg.ring.gapPx + cfg.ring.widthPx + 10, r * 1.2 * k, 8);
  }

  // the fuel ring around the body
  if (d) ui.gauge(ctx, { kind: 'ring', x, y, r: r + cfg.ring.gapPx, width: cfg.ring.widthPx, pct: d.remainingPct, color: p.color, isDry: d.isDry, t: S.time });

  // the body: the identity shape at the body's size
  ui.playerMark(ctx, p, x, y, r);

  // the little cup at the shoulder, tipping while pouring
  const ci = cfg.cupIcon;
  const k = st.sip;
  const side = st.faceX >= 0 ? -1 : 1;   // the cup hand is the trailing side
  const cx = x + side * (r + cfg.ring.gapPx + cfg.ring.widthPx + ci.w * 0.55);
  const cy = y - r * 0.55 - k * ci.h * 0.35;
  const angle = -side * (ci.tiltDeg * Math.PI / 180) * k;
  ui.cupAt(ctx, cx, cy, ci.w, ci.h, angle, { pct: d ? d.remainingPct : 1, color: p.color, isDry: !!(d && d.isDry), t: S.time, showBadge: false, halo: 4 });
}

function drawStrip(ctx, safe) {
  const y = safe.y + STRIP_H * 0.5;
  const left = Math.max(0, cfg.roundTimeSec - S.time);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  const urgent = left <= 10 && !S.over;
  ui.text(ctx, `${mm}:${ss < 10 ? '0' : ''}${ss}`, safe.x + 4, y + T.type.big * 0.36, { size: 'big', color: urgent ? T.brass : T.ink, stroke: urgent });
  ui.text(ctx, `ROUND ${rounds.roundNumber()} / ${rounds.totalRounds()}`, safe.x + 200, y + T.type.small * 0.36, { size: 'small', color: T.slate });

  // one entry per player: mark, seconds alive, and a cross once eaten
  let x = safe.x + 420;
  for (const st of S.roster.values()) {
    ui.playerMark(ctx, st.p, x, y, 18, { dry: !st.alive });
    const secs = `${Math.floor(st.survived)}s`;
    ui.text(ctx, st.alive ? secs : `✕ ${secs}`, x + 28, y + T.type.small * 0.36, { size: 'small', color: st.alive ? T.ink : T.slate });
    x += 130;
  }
  ui.text(ctx, 'stick = move    ACTION = dash    drink = grow', safe.right - 4, y + T.type.small * 0.36, { size: 'small', color: T.slate, align: 'right' });
}
