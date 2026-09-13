// Shared drawing primitives for the Enamel Sign direction: type with ink
// strokes, the fuel gauge (ring / bar / segment, three states), badges, and
// the player mark. Every game draws identity through here so it stays consistent.

import config from './config.js';

const T = config.theme;

// ---- type ------------------------------------------------------------------
export function font(size, family = 'display') {
  const px = typeof size === 'number' ? size : T.type[size];
  return `${family === 'display' ? '' : '900 '}${px}px ${family === 'display' ? T.display : T.label}`;
}

export function text(ctx, str, x, y, opts = {}) {
  const size = opts.size || 'label';
  const px = typeof size === 'number' ? size : T.type[size];
  const family = opts.family || (size === 'small' ? 'label' : 'display');
  ctx.font = font(px, family);
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = (typeof size === 'number' ? Math.max(2, px * 0.05) : T.strokePx[size]) * 2;
    ctx.strokeStyle = opts.strokeColor || T.ink;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = opts.color || T.ink;
  ctx.fillText(str, x, y);
}

export function measure(ctx, str, size = 'label', family) {
  const px = typeof size === 'number' ? size : T.type[size];
  ctx.font = font(px, family || (size === 'small' ? 'label' : 'display'));
  return ctx.measureText(str).width;
}

// ---- shapes ----------------------------------------------------------------
// Draws the identity shape path centred on (0,0) with "radius" r. Caller fills/strokes.
export function shapePath(ctx, shape, r) {
  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8);
      break;
    case 'triangle':
      ctx.moveTo(0, -r * 1.05); ctx.lineTo(r * 1.05, r * 0.8); ctx.lineTo(-r * 1.05, r * 0.8); ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(0, -r * 1.15); ctx.lineTo(r * 1.0, 0); ctx.lineTo(0, r * 1.15); ctx.lineTo(-r * 1.0, 0); ctx.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = Math.cos(a) * r * 1.05, py = Math.sin(a) * r * 1.05; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath();
      break;
    case 'star':
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 === 0 ? r * 1.2 : r * 0.55; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath();
      break;
    case 'heart':
      ctx.moveTo(0, r * 1.0);
      ctx.bezierCurveTo(-r * 1.3, r * 0.1, -r * 1.0, -r * 1.1, 0, -r * 0.4);
      ctx.bezierCurveTo(r * 1.0, -r * 1.1, r * 1.3, r * 0.1, 0, r * 1.0);
      ctx.closePath();
      break;
    case 'ring':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(r * 0.5, 0);
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2, true);
      break;
    default:
      ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
}

// The player mark: identity shape in identity colour with an ink keyline and
// the numeral punched in cream. Used by every game and every screen.
export function playerMark(ctx, player, x, y, r, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  shapePath(ctx, player.shape, r);
  ctx.fillStyle = opts.dry ? T.cream : player.color;
  ctx.fill();
  ctx.lineWidth = opts.keyline ?? config.players.keylinePx;
  ctx.strokeStyle = opts.dry ? T.slate : T.ink;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (opts.numeral !== false) {
    const dy = player.shape === 'triangle' ? r * 0.28 : player.shape === 'heart' ? -r * 0.05 : 0;
    text(ctx, String(player.n), 0, dy, { size: Math.round(r * 1.15), color: opts.dry ? T.slate : T.cream, stroke: !opts.dry, align: 'center', baseline: 'middle' });
  }
  ctx.restore();
}

// ---- gauge -----------------------------------------------------------------
// Three states: normal (solid identity), low (<20%: pulses), dry (outline + DRY badge).
// kind: 'bar' (horizontal), 'segment' (vertical block), 'ring' (around a mark).
export function gauge(ctx, g) {
  const { kind, pct, color, isDry, t = 0 } = g;
  const low = !isDry && pct < T.lowPct;
  const pulse = low ? 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * T.lowPulseHz) : 0;
  const fill = isDry ? null : (low ? mix(color, T.cream, pulse * 0.55) : color);
  const key = isDry ? T.slate : T.ink;
  const kl = T.gaugeKeylinePx;

  if (kind === 'bar' || kind === 'segment') {
    const { x, y, w, h } = g;
    ctx.save();
    ctx.fillStyle = isDry ? T.cream : T.creamDeep;
    ctx.fillRect(x, y, w, h);
    if (fill) {
      ctx.fillStyle = fill;
      if (kind === 'bar') ctx.fillRect(x, y, w * pct, h);
      else ctx.fillRect(x, y + h * (1 - pct), w, h * pct);
      ctx.fillStyle = T.foam;
      ctx.globalAlpha = 0.55;
      if (kind === 'bar') ctx.fillRect(x, y, w * pct, kl);
      else ctx.fillRect(x, y + h * (1 - pct), w, kl);
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = kl; ctx.strokeStyle = key; ctx.lineJoin = 'round';
    ctx.strokeRect(x, y, w, h);
    if (isDry) badge(ctx, 'DRY', x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }

  if (kind === 'ring') {
    const { x, y, r } = g;
    const width = g.width ?? kl * 2.2;
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineWidth = width + kl;
    ctx.strokeStyle = key;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = width - kl * 0.5;
    ctx.strokeStyle = isDry ? T.cream : T.creamDeep;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    if (fill && pct > 0) {
      ctx.strokeStyle = fill;
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); ctx.stroke();
    }
    if (isDry) badge(ctx, 'DRY', x, y + r + width);
    ctx.restore();
  }
}

export function badge(ctx, str, cx, cy, opts = {}) {
  const px = opts.size ?? T.type.small;
  ctx.save();
  ctx.font = font(px, 'label');
  const w = ctx.measureText(str).width + px * 0.9;
  const h = px * 1.4;
  ctx.fillStyle = opts.bg ?? T.slate;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, px * 0.25);
  ctx.fill();
  text(ctx, str, cx, cy + px * 0.05, { size: px, family: 'label', color: opts.color ?? T.cream, align: 'center', baseline: 'middle' });
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// A keylined panel in the sign style: flat fill, ink outline, hard offset shadow.
export function plate(ctx, x, y, w, h, opts = {}) {
  const r = opts.radius ?? 10;
  const off = opts.shadow ?? 8;
  ctx.save();
  ctx.fillStyle = T.ink;
  roundRect(ctx, x + off, y + off, w, h, r); ctx.fill();
  ctx.fillStyle = opts.fill ?? T.cream;
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.lineWidth = opts.keyline ?? config.players.keylinePx;
  ctx.strokeStyle = opts.stroke ?? T.ink;
  roundRect(ctx, x, y, w, h, r); ctx.stroke();
  ctx.restore();
}

// A cup silhouette (for TOP UP and the launcher). pct fills it. ready drops a coaster on top.
export function cup(ctx, x, y, w, h, opts = {}) {
  const { pct = 1, color = T.slate, isDry = false, ready = false, t = 0 } = opts;
  const taper = w * 0.12;
  ctx.save();
  // body path (tapered tumbler)
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - taper, y + h);
    ctx.lineTo(x + taper, y + h);
    ctx.closePath();
  };
  body(); ctx.fillStyle = isDry ? T.cream : T.creamDeep; ctx.fill();
  if (!isDry && pct > 0) {
    const low = pct < T.lowPct;
    const pulse = low ? 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * T.lowPulseHz) : 0;
    ctx.save(); body(); ctx.clip();
    ctx.fillStyle = low ? mix(color, T.cream, pulse * 0.55) : color;
    const top = y + h * (1 - pct);
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = T.foam; ctx.globalAlpha = 0.6;
    ctx.fillRect(x, top, w, T.gaugeKeylinePx);
    ctx.restore();
  }
  body(); ctx.lineWidth = T.gaugeKeylinePx; ctx.lineJoin = 'round';
  ctx.strokeStyle = isDry ? T.slate : T.ink; ctx.stroke();
  if (ready) {
    // coaster
    ctx.fillStyle = T.brass;
    roundRect(ctx, x - w * 0.12, y - h * 0.09, w * 1.24, h * 0.13, 6); ctx.fill();
    ctx.strokeStyle = T.ink; ctx.lineWidth = config.players.keylinePx; ctx.stroke();
  }
  if (isDry) badge(ctx, 'DRY', x + w / 2, y + h * 0.5);
  ctx.restore();
}

// ---- colour maths ----------------------------------------------------------
const hexCache = new Map();
function hexToRgb(hex) {
  let v = hexCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(hex, v);
  }
  return v;
}
const mixCache = new Map();
export function mix(a, b, k) {
  const q = Math.round(k * 20) / 20;
  const key = a + b + q;
  let out = mixCache.get(key);
  if (!out) {
    const A = hexToRgb(a), B = hexToRgb(b);
    out = `rgb(${Math.round(A[0] + (B[0] - A[0]) * q)},${Math.round(A[1] + (B[1] - A[1]) * q)},${Math.round(A[2] + (B[2] - A[2]) * q)})`;
    mixCache.set(key, out);
  }
  return out;
}
