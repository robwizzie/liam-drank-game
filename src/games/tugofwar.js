// Tug of War. One rope, one knot, two sides. Drinking is the only way to pull.
// Brace (hold ACTION) to resist at the cost of contributing no pull.
// Dry players brace only, with a bonus: digging in.

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
        lean: 0, squash: 1, dustAt: 0, teamIndex: teams[p.team].length - 1,
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

function drawFigure(ctx, st, x, gY, ropeY, knotX) {
  const p = st.p;
  const toKnot = knotX > x ? 1 : -1;
  const isDry = !!st.dry;
  const lean = (st.lean * Math.PI) / 180;
  const sq = st.squash;

  ctx.save();
  ctx.translate(x, gY);
  ctx.rotate(lean);
  ctx.scale(1 / Math.sqrt(sq), sq);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const hipY = isDry ? -34 : -62;
  const torsoH = 74, torsoW = 64;
  const headY = hipY - torsoH - 36;

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
  ui.roundRect(ctx, -torsoW / 2, hipY - torsoH, torsoW, torsoH, 14); ctx.fill(); ctx.stroke();
  ui.text(ctx, String(p.n), 0, hipY - torsoH / 2 + 2, { size: 44, color: T.cream, stroke: true, align: 'center', baseline: 'middle' });

  // head: the identity shape
  ui.playerMark(ctx, p, 0, headY, 26, { numeral: false });

  // shoulder in local space → world, for the arms
  const shLocal = { x: toKnot * torsoW * 0.4, y: hipY - torsoH + 10 };
  ctx.restore();

  const c = Math.cos(lean), s = Math.sin(lean);
  const sx = shLocal.x / Math.sqrt(sq), sy = shLocal.y * sq;
  const shWorld = { x: x + sx * c - sy * s, y: gY + sx * s + sy * c };
  const gripX = x + toKnot * 70;
  ctx.strokeStyle = T.ink; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(shWorld.x, shWorld.y); ctx.lineTo(gripX, ropeY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shWorld.x - toKnot * 10, shWorld.y + 8); ctx.lineTo(gripX - toKnot * 22, ropeY + 4); ctx.stroke();
  // hands
  ctx.fillStyle = p.color;
  for (const hx of [gripX, gripX - toKnot * 22]) {
    ctx.beginPath(); ctx.arc(hx, ropeY + 2, 12, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = T.ink; ctx.stroke();
  }
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
