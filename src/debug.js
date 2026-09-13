// The on-screen test panel. Laptop diagnostics only: which drink source is
// live, what every cup is doing this frame, whatever the running game wants to
// show, and buttons to fill or empty a cup without playing through to TOP UP.
//
// Invisible until asked for (config.debug.toggleKeys). Never drawn on the
// cabinet unless someone opens it, and it draws last so it sits over pause too.

import config from './config.js';
import * as canvas from './canvas.js';
import * as ui from './ui.js';
import * as drink from './drink.js';
import * as players from './players.js';
import * as input from './input.js';
import * as rounds from './rounds.js';

const T = config.theme;
const D = config.debug;

let open = false;
let fps = 0;
let hit = [];   // clickable rects, rebuilt every render

window.addEventListener('keydown', e => {
  if (e.repeat || !D.toggleKeys.includes(e.code)) return;
  open = !open;
  e.preventDefault();
});

window.addEventListener('pointerdown', e => {
  if (!open) return;
  const p = canvas.toLogical(e.clientX, e.clientY);
  for (const b of hit) {
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { b.onPress(); e.preventDefault(); return; }
  }
});

export function isOpen() { return open; }

export function update(dt) {
  if (dt > 0) fps += (1 / dt - fps) * Math.min(1, dt * D.fpsSmoothingHz);
}

// 'Backquote' and 'ShiftLeft' mean nothing to someone reading a hint line.
const KEY_LABELS = { Backquote: '`', Space: 'space', ShiftLeft: 'shift', ShiftRight: 'shift', Escape: 'esc' };
function keyLabel(code) {
  return KEY_LABELS[code] || code.replace(/^(Key|Digit|Numpad|Arrow)/, '').toLowerCase() || code;
}

function row(ctx, str, x, y, color = T.ink) {
  ui.text(ctx, str, x, y, { size: D.rowFontPx, family: 'label', color });
}

function button(ctx, label, x, y, onPress, w = D.btnW) {
  ctx.save();
  ctx.fillStyle = T.brass;
  ui.roundRect(ctx, x, y, w, D.btnH, 6); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = T.ink;
  ui.roundRect(ctx, x, y, w, D.btnH, 6); ctx.stroke();
  ctx.restore();
  ui.text(ctx, label, x + w / 2, y + D.btnH / 2, { size: D.btnFontPx, family: 'label', color: T.ink, align: 'center', baseline: 'middle' });
  hit.push({ x, y, w, h: D.btnH, onPress });
}

export function render(ctx) {
  hit = [];
  if (!open) return;

  const safe = canvas.safe();
  const all = players.all();
  const game = rounds.active() ? rounds.game() : null;
  const gameRows = game && game.debugRows ? game.debugRows() : [];
  const tm = input.test();

  const headerRows = 3;
  const footerRows = gameRows.length ? gameRows.length + 1 : 0;
  const totalRows = headerRows + Math.max(1, all.length) + footerRows + 2;   // +2: FILL/EMPTY ALL and the key legend
  const w = D.panelW;
  const h = D.pad * 2 + totalRows * D.rowH;
  const x = safe.x;
  const y = safe.y;

  ui.plate(ctx, x, y, w, h, { fill: T.cream, shadow: 10, radius: 12 });

  const lx = x + D.pad;
  let ly = y + D.pad + D.rowFontPx;

  ui.text(ctx, 'TEST PANEL', lx, ly, { size: D.rowFontPx, family: 'label', color: T.ink });
  ui.text(ctx, `${D.toggleKeys.map(keyLabel).join(' / ')} to close`, x + w - D.pad, ly, { size: D.rowFontPx, family: 'label', color: T.slate, align: 'right' });
  ly += D.rowH;

  row(ctx, `drink source: ${drink.backend.name}   ·   ${Math.round(fps)} fps   ·   ${rounds.active() ? rounds.phase() : 'LAUNCHER'}`, lx, ly);
  ly += D.rowH;

  const driving = tm.on ? `driving P${tm.driving + 1}` : 'off — cabinet layouts only';
  row(ctx, `test keys: ${driving}`, lx, ly, tm.on ? T.bottle : T.slate);
  ly += D.rowH;

  if (!all.length) {
    row(ctx, 'no players — press SPACE (or DRINK) to join', lx, ly, T.slate);
    ly += D.rowH;
  }

  const btnX2 = x + w - D.pad - D.btnW;
  const btnX1 = btnX2 - D.btnW - D.btnGap;
  for (const p of all) {
    const d = drink.state(p.slot);
    const cap = p.capacityMl;
    const pct = Math.round(d.remainingPct * 100);
    const flag = d.isDry ? '  DRY' : d.isDrinking ? '  DRINKING' : '';
    ui.playerMark(ctx, p, lx + 14, ly - D.rowFontPx * 0.35, 15, { keyline: 3 });
    row(ctx, `P${p.n}  ${d.rate.toFixed(1)} ml/s  eff ${d.effective.toFixed(1)}  ${Math.round(d.remaining)}/${cap} ml  ${pct}%${flag}`, lx + 38, ly);
    const by = ly - D.rowFontPx * 0.8;
    button(ctx, 'FILL', btnX1, by, () => drink.setRemaining(p.slot, cap));
    button(ctx, 'EMPTY', btnX2, by, () => drink.setRemaining(p.slot, 0));
    ly += D.rowH;
  }

  if (gameRows.length) {
    row(ctx, (game.name || 'GAME').toUpperCase(), lx, ly, T.slate);
    ly += D.rowH;
    for (const r of gameRows) {
      const p = r.slot === undefined ? null : players.get(r.slot);
      row(ctx, p ? `P${p.n}  ${r.text}` : r.text, lx + 38, ly, p ? p.color : T.ink);
      ly += D.rowH;
    }
  }

  const ay = ly - D.rowFontPx * 0.8;
  const wideX2 = x + w - D.pad - D.btnWideW;
  const wideX1 = wideX2 - D.btnWideW - D.btnGap;
  button(ctx, 'FILL ALL', wideX1, ay, () => { for (const p of players.all()) drink.setRemaining(p.slot, p.capacityMl); }, D.btnWideW);
  button(ctx, 'EMPTY ALL', wideX2, ay, () => { for (const p of players.all()) drink.setRemaining(p.slot, 0); }, D.btnWideW);
  ly += D.rowH;

  row(ctx, 'space drink · shift brace · arrows menu · 1-4 switch player · T cabinet keys', lx, ly, T.slate);
}
