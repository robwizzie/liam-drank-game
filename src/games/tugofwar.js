// Tug of War. One rope, one knot, two sides. Drinking is the only way to pull.
// Brace (hold ACTION) to resist at the cost of contributing no pull.
// Dry players brace only, with a bonus: digging in.
//
// Every figure holds its cup in the free hand. Hold DRINK and the cup comes up,
// the head tips back and the level drops — the button reads as a drink, not as
// a bar moving somewhere else on screen.

import config from '../config.js';
import * as canvas from '../canvas.js';
import * as ui from '../ui.js';
import * as fx from '../fx.js';
import * as audio from '../audio.js';
import * as rounds from '../rounds.js';

const T = config.theme;
let cfg = config.games.tugofwar;

let S = null;

function teamOf(i) { return i % 2 === 0 ? 'left' : 'right'; }

export default {
  id: 'tugofwar',
  name: 'Tug of War',
  tagline: 'Drink to pull. Brace to hold.',
  minPlayers: 2,
  maxPlayers: 8,
  defaultRounds: 3,

  init(playerList, gameCfg) {
    cfg = gameCfg || config.games.tugofwar;
    const teams = { left: [], right: [] };
    const roster = new Map();
    playerList.forEach((p, i) => {
      p.team = teamOf(i);
      teams[p.team].push(p);
      roster.set(p.slot, {
        p, drink: null, dry: false, fatigue: 0, drinkTime: 0, pull: 0, brace: 0, bracing: false,
        lean: 0, squash: 1, sip: 0, gulpAt: 0, dustAt: 0, teamIndex: teams[p.team].length - 1,
      });
    });
    const L = teams.left.length, R = teams.right.length;
    const big = Math.max(L, R), small = Math.max(1, Math.min(L, R));
    const hc = Math.pow(big / small, cfg.handicapExponent);
    S = {
      teams, roster,
      handicap: { left: L < R ? hc : 1, right: R < L ? hc : 1 },
      rope: { p: 0, v: 0, tension: 0, phase: 0 },
      time: 0,
      limit: cfg.roundTimeLimitSec ?? config.drink.targetCupPerRoundSec,
      over: false,
      creakAt: 0,
      lastTick: -1,
    };
  },

  update(dt, inputs) {
    if (!S) return;
    S.time += dt;
    const rope = S.rope;
    let pullL = 0, pullR = 0, braceL = 0, braceR = 0;
    const f = cfg.fatigue;

    for (const st of S.roster.values()) {
      const inp = inputs[st.p.slot];
      if (!inp) continue;
      const d = inp.drink;
      st.drink = d;
      st.dry = d.isDry;
      const bracing = d.isDry || inp.held('action');
      st.bracing = bracing;

      if (d.isDrinking) {
        st.drinkTime += dt;
        if (st.drinkTime > f.onsetSec) st.fatigue = Math.min(1, st.fatigue + f.riseRate * dt);
      } else {
        st.drinkTime = 0;
        st.fatigue = Math.max(0, st.fatigue - f.recoverRate * dt);
      }
      const hc = S.handicap[st.p.team];
      const forceMul = 1 - st.fatigue * (1 - f.floor);
      st.pull = bracing ? 0 : d.effective * cfg.pullForcePerMlSec * forceMul * hc;
      st.brace = bracing ? cfg.braceForce * (d.isDry ? cfg.dryBraceBonus : 1) * hc : 0;
      if (st.p.team === 'left') { pullL += st.pull; braceL += st.brace; } else { pullR += st.pull; braceR += st.brace; }

      if (!S.over) audio.drinkTone(st.p.slot, d.rate, d.remainingPct);
    }

    const net = pullR - pullL;
    const opposing = net > 0 ? braceL : braceR;
    const eff = Math.sign(net) * Math.max(0, Math.abs(net) - opposing);
    if (dt > 0 && !S.over) {
      const a = (eff - cfg.ropeDrag * rope.v) / cfg.ropeMass;
      rope.v += a * dt;
      rope.p += rope.v * dt;
      rope.phase += rope.v * dt;
    }
    rope.tension = Math.abs(net) + Math.min(opposing, Math.abs(net));
    const maxPull = config.drink.syntheticRateMlPerSec * cfg.pullForcePerMlSec;

    // visuals per player
    for (const st of S.roster.values()) {
      const dir = st.p.team === 'left' ? -1 : 1;
      const targetLean = st.bracing ? dir * cfg.lean.maxDeg * 0.25 : dir * cfg.lean.maxDeg * Math.min(1, st.pull / Math.max(0.001, maxPull));
      st.lean += (targetLean - st.lean) * Math.min(1, dt * 10);
      const targetSquash = st.bracing ? cfg.lean.braceSquash : 1;
      st.squash += (targetSquash - st.squash) * Math.min(1, dt * 12);
      // dust when this side is being dragged and this player is bracing
      const dragged = (st.p.team === 'left' && rope.v > 0.03) || (st.p.team === 'right' && rope.v < -0.03);
      if (st.bracing && dragged && S.time - st.dustAt > 0.09 && !S.over) {
        st.dustAt = S.time;
        const pos = figureX(st);
        fx.burst(pos, groundY(), { count: Math.min(8, 2 + Math.round(Math.abs(rope.v) * 20)), color: T.slate, speed: 180, life: 0.45, size: 9, dir: -Math.PI / 2 - dir * 0.9, spread: 1.2, gravity: 900 });
      }

      // the cup rises to the mouth while the drink button is down, and drops when it isn't
      const dp = cfg.drinkPose;
      const drinking = !!(st.drink && st.drink.isDrinking);
      st.sip += ((drinking ? 1 : 0) - st.sip) * (1 - Math.exp(-dt / dp.raiseSec));
      if (drinking && st.sip > 0.6 && S.time - st.gulpAt > dp.gulpEverySec && !S.over) {
        st.gulpAt = S.time;
        const fxx = figureX(st);
        const g = figureGeom(st, fxx, groundY());
        const toKnot = (canvas.safe().cx + rope.p * ropeHalfWidth()) > fxx ? 1 : -1;
        const r = g.toWorld(rimLocal(g, st, toKnot));
        fx.burst(r.x, r.y, { count: dp.gulpCount, color: st.p.color, speed: 130, life: 0.4, size: 8, dir: Math.PI / 2, spread: 1.1 });
      }
    }

    if (rope.tension > maxPull * 0.8 && S.time - S.creakAt > 0.35 + Math.random() * 0.5 && !S.over) {
      S.creakAt = S.time;
      audio.play('creak');
    }

    if (S.over) return;

    // timer ticks in the last 5 seconds
    const left = S.limit - S.time;
    const n = Math.ceil(left);
    if (left <= 5 && n !== S.lastTick) { S.lastTick = n; audio.play('tickHigh'); }

    if (Math.abs(rope.p) >= cfg.winThreshold) return finish(rope.p > 0 ? 'right' : 'left');
    if (left <= 0) return finish(rope.p > 0.02 ? 'right' : rope.p < -0.02 ? 'left' : null);
  },

  render(ctx) {
    if (!S) return;
    const safe = canvas.safe();
    const rope = S.rope;
    const gY = groundY();
    const ropeY = gY - 120;
    const halfW = ropeHalfWidth();
    const knotX = safe.cx + rope.p * halfW;

    ctx.fillStyle = T.cream;
    ctx.fillRect(0, 0, canvas.W, canvas.H);

    // ground strip
    ctx.fillStyle = T.bottle;
    ctx.fillRect(safe.x - 40, gY, safe.w + 80, 44);
    ctx.fillStyle = T.ink;
    ctx.fillRect(safe.x - 40, gY - 4, safe.w + 80, 8);
    // centre mark on the ground
    ctx.fillStyle = T.cream;
    ctx.fillRect(safe.cx - 5, gY + 8, 10, 28);

    // posts
    const postL = safe.cx - halfW * cfg.winThreshold;
    const postR = safe.cx + halfW * cfg.winThreshold;
    for (const px of [postL, postR]) {
      const out = px < safe.cx ? -1 : 1;
      ctx.fillStyle = T.ink;
      ctx.fillRect(px - 9, ropeY - 110, 18, gY - (ropeY - 110) + 4);
      ctx.fillStyle = T.brass; ctx.strokeStyle = T.ink; ctx.lineWidth = config.players.keylinePx; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(px, ropeY - 110); ctx.lineTo(px + out * 78, ropeY - 82); ctx.lineTo(px, ropeY - 54); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // rope with sag
    const maxT = config.drink.syntheticRateMlPerSec * cfg.pullForcePerMlSec * 2;
    const sag = cfg.ropeSagPx * (1 - Math.min(1, rope.tension / maxT));
    const x0 = postL - 60, x1 = postR + 60;
    const ropePath = () => {
      ctx.beginPath();
      ctx.moveTo(x0, ropeY);
      ctx.quadraticCurveTo((x0 + knotX) / 2, ropeY + sag, knotX, ropeY);
      ctx.quadraticCurveTo((knotX + x1) / 2, ropeY + sag, x1, ropeY);
    };
    ctx.lineCap = 'round';
    ropePath(); ctx.lineWidth = 34; ctx.strokeStyle = T.ink; ctx.stroke();
    ropePath(); ctx.lineWidth = 24; ctx.strokeStyle = T.bottle; ctx.stroke();
    ctx.save();
    ctx.setLineDash([22, 22]);
    ctx.lineDashOffset = -rope.phase * halfW;
    ropePath(); ctx.lineWidth = 8; ctx.strokeStyle = ui.mix(T.bottle, T.cream, 0.35); ctx.stroke();
    ctx.restore();

    // figures (behind the knot)
    for (const st of S.roster.values()) drawFigure(ctx, st, figureX(st), gY, ropeY, knotX);

    // knot
    ctx.save();
    ctx.translate(knotX, ropeY);
    const kr = 54;
    ctx.fillStyle = T.brass; ctx.strokeStyle = T.ink; ctx.lineWidth = config.players.keylinePx + 2;
    ui.roundRect(ctx, -kr, -kr * 0.72, kr * 2, kr * 1.44, 18); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 26 - 10, -22); ctx.lineTo(i * 26 + 10, 22); ctx.stroke(); }
    ctx.restore();

    // score pips + round + timer, top centre
    const sb = rounds.scoreboard();
    const wonL = Math.max(0, ...S.teams.left.map(p => (sb.find(b => b.slot === p.slot) || {}).roundsWon || 0));
    const wonR = Math.max(0, ...S.teams.right.map(p => (sb.find(b => b.slot === p.slot) || {}).roundsWon || 0));
    const need = Math.floor(rounds.totalRounds() / 2) + 1;
    const pipY = safe.y + 34;
    for (let i = 0; i < need; i++) {
      pip(ctx, safe.cx - 150 - i * 44, pipY, i < wonL);
      pip(ctx, safe.cx + 150 + i * 44, pipY, i < wonR);
    }
    ui.text(ctx, `ROUND ${rounds.roundNumber()}`, safe.cx, pipY + 14, { size: 'label', color: T.ink, align: 'center' });
    const left = Math.max(0, S.limit - S.time);
    const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
    const urgent = left <= 10;
    ui.text(ctx, `${mm}:${ss < 10 ? '0' : ''}${ss}`, safe.cx, pipY + 14 + T.type.big * 0.95, { size: 'big', color: urgent ? T.brass : T.ink, stroke: urgent, align: 'center' });

    // gauges, bottom, two columns
    drawGauges(ctx, safe, gY);
  },

  teardown() {
    S = null;
    audio.stopAllDrinkTones();
  },

  // Read by debug.js when the test panel is open. Optional on any game module.
  debugRows() {
    if (!S) return [];
    const rows = [...S.roster.values()].map(st => ({
      slot: st.p.slot,
      text: `fatigue ${st.fatigue.toFixed(2)}  pull ${st.pull.toFixed(1)}  brace ${st.brace.toFixed(1)}${st.bracing ? '  BRACING' : ''}`,
    }));
    rows.push({ text: `rope ${S.rope.p.toFixed(3)}  vel ${S.rope.v.toFixed(3)}  tension ${S.rope.tension.toFixed(1)}  handicap L${S.handicap.left.toFixed(2)} R${S.handicap.right.toFixed(2)}` });
    return rows;
  },

  matchSummary(board, playerList) {
    const pts = { left: 0, right: 0 };
    for (const b of board) { const p = playerList.find(q => q.slot === b.slot); if (p) pts[p.team] += b.points; }
    if (pts.left === pts.right) return { winners: playerList.map(p => p.slot), banner: 'DRAW' };
    const side = pts.left > pts.right ? 'left' : 'right';
    return { winners: playerList.filter(p => p.team === side).map(p => p.slot), banner: `${side.toUpperCase()} SIDE WINS` };
  },
};

function finish(side) {
  S.over = true;
  audio.stopAllDrinkTones();
  audio.play('impact');
  if (!side) return { winners: [], scores: {}, banner: 'DRAW' };
  const winners = S.teams[side].map(p => p.slot);
  const scores = {};
  for (const s of winners) scores[s] = 1;
  return { winners, scores, banner: `${side.toUpperCase()} SIDE WINS` };
}

function groundY() { return canvas.safe().cy + 150; }
function ropeHalfWidth() { return canvas.safe().w * 0.3; }

function figureX(st) {
  const safe = canvas.safe();
  const team = S.teams[st.p.team];
  const n = team.length;
  const dir = st.p.team === 'left' ? -1 : 1;
  const knotX = safe.cx + S.rope.p * ropeHalfWidth();
  const edge = dir < 0 ? safe.x + 60 : safe.right - 60;
  const room = Math.abs(edge - knotX) - cfg.figureGripPx;
  const spacing = n > 1 ? Math.max(40, Math.min(cfg.figureSpacingPx, room / (n - 1))) : 0;
  return knotX + dir * (cfg.figureGripPx + st.teamIndex * spacing);
}

function pip(ctx, x, y, filled) {
  ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = filled ? T.brass : T.cream; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = T.ink; ctx.stroke();
}

// Figure geometry, shared by the update pass (where particles need to know
// where a mouth is) and the render pass. Local space: feet at (0,0), up is
// negative y, before the lean rotation and brace squash are applied.
function figureGeom(st, x, gY) {
  const isDry = !!st.dry;
  const lean = (st.lean * Math.PI) / 180;
  const sq = st.squash;
  const hipY = isDry ? -34 : -62;
  const torsoH = 74, torsoW = 64;
  const neckY = hipY - torsoH;
  const headY = neckY - 36;
  const headR = 26;
  const c = Math.cos(lean), s = Math.sin(lean);
  return {
    isDry, lean, sq, hipY, torsoH, torsoW, neckY, headY, headR,
    toWorld(l) {
      const sx = l.x / Math.sqrt(sq), sy = l.y * sq;
      return { x: x + sx * c - sy * s, y: gY + sx * s + sy * c };
    },
  };
}

// How far the head has tipped back, in radians. Full sip = cfg.drinkPose.headTiltDeg.
function headAngle(st, toKnot) {
  return (-toKnot * cfg.drinkPose.headTiltDeg * Math.PI * st.sip) / 180;
}

// Where the cup is, in local space: down by the hip at rest, up BESIDE the head
// mid-sip — beside it, never over it, so the identity shape stays readable and
// the cup keeps its own silhouette against a same-coloured body.
// The whole drinking pose falls out of this one lerp; the hand follows the cup.
function cupCentreLocal(g, st, toKnot) {
  const dp = cfg.drinkPose;
  // a tipped cup is wider than its width: clear the head by its rotated extent,
  // or the far corner swings back over the identity shape at full tilt
  const a = cupAngle(st, toKnot);
  const halfW = (dp.cupW * Math.abs(Math.cos(a)) + dp.cupH * Math.abs(Math.sin(a))) * 0.5;
  const restX = -toKnot * (g.torsoW * 0.5 + dp.cupW * 0.62), restY = g.hipY - g.torsoH * 0.15;
  const sipX = -toKnot * (g.headR + halfW + dp.headClearPx), sipY = g.headY + dp.cupH * 0.05;
  const k = st.sip;
  return { x: restX + (sipX - restX) * k, y: restY + (sipY - restY) * k };
}

// How far the cup has tipped toward the head. Sits on the far side of the body
// from the rope, so a positive (clockwise) tip points the rim back at the face.
function cupAngle(st, toKnot) {
  return (toKnot * cfg.drinkPose.cupTiltDeg * Math.PI * st.sip) / 180;
}

// The rim — where the drink leaves the cup, and where gulp droplets come from.
function rimLocal(g, st, toKnot) {
  const c = cupCentreLocal(g, st, toKnot);
  const a = cupAngle(st, toKnot);
  const r = cfg.drinkPose.cupH * 0.5;
  return { x: c.x + Math.sin(a) * r, y: c.y - Math.cos(a) * r };
}

// The gripping hand: at the base of the cup along the cup's own axis, so it
// straddles the rim rather than floating inside the glass.
function cupHandLocal(g, st, toKnot) {
  const c = cupCentreLocal(g, st, toKnot);
  const a = cupAngle(st, toKnot);
  const lift = cfg.drinkPose.cupH * 0.5;
  return { x: c.x - Math.sin(a) * lift, y: c.y + Math.cos(a) * lift };
}

function drawFigure(ctx, st, x, gY, ropeY, knotX) {
  const p = st.p;
  const d = st.drink;
  const toKnot = knotX > x ? 1 : -1;
  const g = figureGeom(st, x, gY);
  const { isDry, sq, hipY, torsoH, torsoW, neckY, headY } = g;
  const dp = cfg.drinkPose;

  ctx.save();
  ctx.translate(x, gY);
  ctx.rotate(g.lean);
  ctx.scale(1 / Math.sqrt(sq), sq);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // legs
  ctx.strokeStyle = T.ink; ctx.lineWidth = 16;
  const stance = st.bracing ? 34 : 22;
  ctx.beginPath();
  if (isDry) { ctx.moveTo(0, hipY); ctx.lineTo(toKnot * 46, -6); ctx.moveTo(0, hipY); ctx.lineTo(toKnot * 18, -6); }
  else { ctx.moveTo(0, hipY); ctx.lineTo(-stance, 0); ctx.moveTo(0, hipY); ctx.lineTo(stance, 0); }
  ctx.stroke();
  // feet
  ctx.lineWidth = 12;
  ctx.beginPath();
  if (isDry) { ctx.moveTo(toKnot * 46, -4); ctx.lineTo(toKnot * 66, -4); }
  else { ctx.moveTo(-stance - 14, 0); ctx.lineTo(-stance + 8, 0); ctx.moveTo(stance - 8, 0); ctx.lineTo(stance + 14, 0); }
  ctx.stroke();

  // torso
  ctx.fillStyle = p.color; ctx.strokeStyle = T.ink; ctx.lineWidth = config.players.keylinePx;
  ui.roundRect(ctx, -torsoW / 2, neckY, torsoW, torsoH, 14); ctx.fill(); ctx.stroke();
  ui.text(ctx, String(p.n), 0, hipY - torsoH / 2 + 2, { size: 44, color: T.cream, stroke: true, align: 'center', baseline: 'middle' });

  // head: the identity shape, tipping back off the neck as the cup comes up
  ctx.save();
  ctx.translate(0, neckY);
  ctx.rotate(headAngle(st, toKnot));
  ui.playerMark(ctx, p, 0, headY - neckY, 26, { numeral: false });
  ctx.restore();
  ctx.restore();

  // arms are drawn in world space so the rope hand can reach the rope
  const shRope = g.toWorld({ x: toKnot * torsoW * 0.4, y: neckY + 10 });
  const shCup = g.toWorld({ x: -toKnot * torsoW * 0.34, y: neckY + 12 });
  const hand = g.toWorld(cupHandLocal(g, st, toKnot));
  const cupC = g.toWorld(cupCentreLocal(g, st, toKnot));
  const gripX = x + toKnot * 70;

  // rope arm — one hand on the rope, always
  ctx.strokeStyle = T.ink; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(shRope.x, shRope.y); ctx.lineTo(gripX, ropeY); ctx.stroke();
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(gripX, ropeY + 2, 12, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = T.ink; ctx.stroke();

  // cup arm — the elbow swings out at rest and tucks in as the cup comes up
  ctx.strokeStyle = T.ink; ctx.lineWidth = 14;
  const ex = (shCup.x + hand.x) / 2 - toKnot * 30 * (1 - st.sip * 0.7);
  const ey = (shCup.y + hand.y) / 2 + 22;
  ctx.beginPath(); ctx.moveTo(shCup.x, shCup.y); ctx.quadraticCurveTo(ex, ey, hand.x, hand.y); ctx.stroke();

  // the gripping hand, under the glass — the cup's halo trims it to the rim
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(hand.x, hand.y, 12, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = T.ink; ctx.stroke();

  // the cup itself, tipping toward the head, level dropping as it empties
  ui.cupAt(ctx, cupC.x, cupC.y, dp.cupW, dp.cupH, cupAngle(st, toKnot) + g.lean, {
    pct: d ? d.remainingPct : 1, color: p.color, isDry: !!(d && d.isDry), t: S.time, showBadge: false, halo: dp.haloPx,
  });
}

function drawGauges(ctx, safe, gY) {
  const top = gY + 90;
  const rowH = 40, gap = 16;
  const colW = safe.w / 2 - 80;
  const barW = colW - 110;
  for (const side of ['left', 'right']) {
    const team = S.teams[side];
    team.forEach((p, i) => {
      const st = S.roster.get(p.slot);
      const y = top + i * (rowH + gap);
      const d = st.drink;
      if (!d) return;
      if (side === 'left') {
        const x = safe.x + 20;
        ui.playerMark(ctx, p, x + 30, y + rowH / 2, 24);
        ui.gauge(ctx, { kind: 'bar', x: x + 80, y, w: barW, h: rowH, pct: d.remainingPct, color: p.color, isDry: d.isDry, t: S.time });
      } else {
        const x = safe.right - 20;
        ui.playerMark(ctx, p, x - 30, y + rowH / 2, 24);
        ui.gauge(ctx, { kind: 'bar', x: x - 80 - barW, y, w: barW, h: rowH, pct: d.remainingPct, color: p.color, isDry: d.isDry, t: S.time });
      }
      if (st.bracing && !d.isDry) ui.badge(ctx, 'BRACE', side === 'left' ? safe.x + 20 + 80 + barW / 2 : safe.right - 20 - 80 - barW / 2, y + rowH / 2, { bg: T.ink, size: 22 });
    });
  }
}
