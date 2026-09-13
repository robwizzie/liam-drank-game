// Game select + player registration. Bands, not cards. Press DRINK to join.

import config from './config.js';
import * as canvas from './canvas.js';
import * as ui from './ui.js';
import * as fx from './fx.js';
import * as audio from './audio.js';
import * as input from './input.js';
import * as players from './players.js';
import * as drink from './drink.js';
import games from './games/index.js';

const T = config.theme;

let selected = 0;
let t = 0;
let onStart = null;
const bandAnim = games.map(() => ({ k: 0 }));
const cupAnim = [];
for (let i = 0; i < config.players.maxPlayers; i++) cupAnim.push({ pop: 1 });

export function init(startCallback) {
  onStart = startCallback;
  t = 0;
  bandAnim.forEach((b, i) => { b.k = i === selected ? 1 : 0; });
}

export function update(dt) {
  t += dt;
  // join
  for (const key of input.unboundJustPressed('drink')) {
    const p = players.join(key);
    if (p) {
      drink.setCapacity(p.slot, p.capacityMl);
      audio.play('join', { slot: p.slot });
      cupAnim[p.slot].pop = 0;
      fx.tween(cupAnim[p.slot], { pop: 1 }, config.fx.tween.snapSec * 1.5, fx.ease.outBack);
      const pos = cupPos(p.slot);
      fx.burst(pos.x + pos.w / 2, pos.y + pos.h / 2, { count: 24, color: p.color, speed: 500, life: 0.7, size: 12 });
    }
  }
  const all = players.all();
  const game = games[selected];
  for (const p of all) {
    if (input.justPressed(p.slot, 'up') || input.justPressed(p.slot, 'down')) {
      const dir = input.justPressed(p.slot, 'down') ? 1 : -1;
      selected = (selected + dir + games.length) % games.length;
      audio.play('select');
      bandAnim.forEach((b, i) => fx.tween(b, { k: i === selected ? 1 : 0 }, config.fx.tween.snapSec, fx.ease.outBack));
    }
    if (input.justPressed(p.slot, 'left') || input.justPressed(p.slot, 'right')) {
      players.cycleCapacity(p.slot, input.justPressed(p.slot, 'right') ? 1 : -1);
      drink.setCapacity(p.slot, p.capacityMl);
      audio.play('tickHigh');
      cupAnim[p.slot].pop = 0.85;
      fx.tween(cupAnim[p.slot], { pop: 1 }, config.fx.tween.snapSec, fx.ease.outBack);
    }
    if (input.justPressed(p.slot, 'action') && all.length >= game.minPlayers && all.length <= game.maxPlayers) {
      audio.play('roundStart');
      if (onStart) onStart(game);
      return;
    }
  }
}

function cupPos(slot) {
  const safe = canvas.safe();
  const n = config.players.maxPlayers;
  const w = 110, h = 140, gap = 48;
  const total = n * w + (n - 1) * gap;
  const x0 = safe.cx - total / 2;
  return { x: x0 + slot * (w + gap), y: safe.bottom - h - T.type.small * 3.2, w, h };
}

export function render(ctx) {
  const safe = canvas.safe();
  ctx.fillStyle = T.cream;
  ctx.fillRect(0, 0, canvas.W, canvas.H);

  // sign header
  ui.text(ctx, 'THE CABINET', safe.x + 30, safe.y + T.type.big * 0.95, { size: 'big', color: T.ink });
  ctx.fillStyle = T.ink;
  ctx.fillRect(safe.x + 30, safe.y + T.type.big * 1.25, 320, 6);

  // bands
  const bh = config.launcher.bandHeight;
  const gap = 26;
  let y = safe.y + T.type.big * 1.9;
  games.forEach((g, i) => {
    const k = bandAnim[i].k;
    const sc = 1 + (config.launcher.selectedScale - 1) * k;
    const w = safe.w * 0.92 * sc;
    const x = safe.cx - w / 2;
    ui.plate(ctx, x, y, w, bh * sc, { fill: ui.mix(T.cream, T.bottle, k), shadow: 8 + 6 * k, radius: 14 });
    const textColor = k > 0.5 ? T.cream : T.ink;
    ui.text(ctx, g.name.toUpperCase(), x + 54, y + bh * sc * 0.5 + T.type.big * 0.36, { size: 'big', color: textColor });
    ui.text(ctx, g.tagline, x + w - 54, y + bh * sc * 0.5 + T.type.label * 0.36, { size: 'label', color: k > 0.5 ? T.brass : T.slate, align: 'right', family: 'label' });
    if (k > 0.5) {
      // brass marker on the selected band
      ctx.save();
      ctx.translate(x - 4, y + bh * sc / 2);
      ctx.fillStyle = T.brass; ctx.strokeStyle = T.ink; ctx.lineWidth = config.players.keylinePx;
      ctx.beginPath(); ctx.moveTo(-40, -34); ctx.lineTo(10, 0); ctx.lineTo(-40, 34); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    y += bh * sc + gap;
  });

  // cups
  const all = players.all();
  const game = games[selected];
  for (let s = 0; s < config.players.maxPlayers; s++) {
    const pos = cupPos(s);
    const p = players.get(s);
    if (!p) {
      ctx.save();
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = T.slate; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y); ctx.lineTo(pos.x + pos.w, pos.y); ctx.lineTo(pos.x + pos.w * 0.88, pos.y + pos.h); ctx.lineTo(pos.x + pos.w * 0.12, pos.y + pos.h); ctx.closePath();
      ctx.stroke();
      ctx.restore();
      continue;
    }
    const a = cupAnim[s].pop;
    ctx.save();
    ctx.translate(pos.x + pos.w / 2, pos.y + pos.h);
    ctx.scale(a, a);
    ctx.translate(-(pos.x + pos.w / 2), -(pos.y + pos.h));
    ui.cup(ctx, pos.x, pos.y, pos.w, pos.h, { pct: 1, color: p.color, t });
    ui.playerMark(ctx, p, pos.x + pos.w / 2, pos.y - 46, 34);
    ctx.restore();
    ui.text(ctx, players.capacityLabel(p), pos.x + pos.w / 2, pos.y + pos.h + T.type.small * 1.3, { size: 'small', color: T.ink, align: 'center' });
  }

  const promptY = safe.bottom - T.type.small * 0.4;
  const can = all.length >= game.minPlayers && all.length <= game.maxPlayers;
  const blink = Math.sin(t * 5) > 0;
  const prompt = all.length === 0
    ? 'PRESS DRINK TO JOIN'
    : can ? `PRESS ACTION TO START ${game.name.toUpperCase()}       DRINK = join     ◂ ▸ = cup size     ▴ ▾ = game`
      : `${game.name.toUpperCase()} NEEDS ${game.minPlayers}–${game.maxPlayers} PLAYERS       DRINK = join     ◂ ▸ = cup size`;
  ui.text(ctx, prompt, safe.cx, promptY, { size: 'small', color: all.length === 0 && !blink ? T.slate : T.ink, align: 'center' });

  // keyboard hint — under the header rule, where there is room for the whole
  // legend. Shows whichever key set is actually live.
  const tm = input.test();
  const hint = tm.on
    ? `TEST KEYS · driving P${tm.driving + 1} · space drink · shift brace · arrows menu · 1-4 switch player · T cabinet keys · F1 panel`
    : 'keys  P1 Q E WASD · P2 , . arrows · P3 U O IJKL · P4 num7 num9 8456 · Esc pause';
  ui.text(ctx, hint, safe.x + 30, safe.y + T.type.big * 1.25 + T.type.small * 1.15, { size: 'small', color: tm.on ? T.bottle : T.slate });
}
