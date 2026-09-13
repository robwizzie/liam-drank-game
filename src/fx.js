// Screen shake, pooled particles, tweens/easing, callout banners.
// Nothing here allocates per frame once the pools are warm.

import config from './config.js';
import * as canvas from './canvas.js';
import * as ui from './ui.js';

// ---- easing ----------------------------------------------------------------
export const ease = {
  linear: t => t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  outBack: t => { const c = 1.70158, d = c + 1; return 1 + d * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
};

// ---- shake -----------------------------------------------------------------
let shakeMag = 0, shakeTime = 0, shakeX = 0, shakeY = 0;

export function shake(magnitude, seconds) {
  shakeMag = Math.max(shakeMag, magnitude);
  shakeTime = Math.max(shakeTime, seconds);
}

export function applyShake(ctx) {
  if (shakeMag > 0.5) ctx.translate(shakeX, shakeY);
}

// ---- particles -------------------------------------------------------------
const pool = [];
for (let i = 0; i < config.fx.particles.poolSize; i++) {
  pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '#000', gravity: 0, shape: 0 });
}
let poolCursor = 0;

export function burst(x, y, opts = {}) {
  const count = opts.count ?? 20;
  const speed = opts.speed ?? 400;
  const life = opts.life ?? 0.6;
  const size = opts.size ?? 10;
  const color = opts.color ?? config.theme.ink;
  const gravity = opts.gravity ?? config.fx.particles.gravity;
  const spread = opts.spread ?? Math.PI * 2;
  const dir = opts.dir ?? -Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const p = pool[poolCursor];
    poolCursor = (poolCursor + 1) % pool.length;
    const a = dir + (Math.random() - 0.5) * spread;
    const s = speed * (0.4 + Math.random() * 0.8);
    p.alive = true; p.x = x; p.y = y;
    p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
    p.maxLife = p.life = life * (0.6 + Math.random() * 0.6);
    p.size = size * (0.6 + Math.random() * 0.8);
    p.color = color; p.gravity = gravity; p.shape = Math.random() < 0.5 ? 0 : 1;
  }
}

// ---- tweens ----------------------------------------------------------------
const tweens = [];

export function tween(obj, props, seconds, easing = ease.outBack, onDone = null) {
  // cancel any tween already driving the same props on this object
  for (const t of tweens) if (t.obj === obj) for (const k in props) if (k in t.to) delete t.to[k];
  const from = {};
  for (const k in props) from[k] = obj[k];
  const t = { obj, from, to: { ...props }, t: 0, dur: Math.max(0.0001, seconds), easing, onDone, done: false };
  tweens.push(t);
  return t;
}

// ---- callouts --------------------------------------------------------------
const callouts = [];   // { text, sub, color, t, hold, scale }

export function callout(text, opts = {}) {
  callouts.push({
    text, sub: opts.sub || '', color: opts.color || config.theme.ink,
    t: 0, hold: opts.seconds ?? config.fx.callout.holdSec, y: opts.y ?? null,
  });
}

// ---- update ----------------------------------------------------------------
export function update(dt) {
  if (shakeTime > 0) {
    shakeTime -= dt;
    shakeX = (Math.random() * 2 - 1) * shakeMag;
    shakeY = (Math.random() * 2 - 1) * shakeMag;
    shakeMag *= config.fx.shake.decay;
    if (shakeTime <= 0) { shakeMag = 0; shakeX = 0; shakeY = 0; }
  }
  for (const p of pool) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = tweens.length - 1; i >= 0; i--) {
    const t = tweens[i];
    t.t += dt;
    const k = Math.min(1, t.t / t.dur);
    const e = t.easing(k);
    for (const key in t.to) t.obj[key] = t.from[key] + (t.to[key] - t.from[key]) * e;
    if (k >= 1) { tweens.splice(i, 1); t.done = true; if (t.onDone) t.onDone(); }
  }
  for (let i = callouts.length - 1; i >= 0; i--) {
    const c = callouts[i];
    c.t += dt;
    if (c.t > c.hold) callouts.splice(i, 1);
  }
}

// ---- render ----------------------------------------------------------------
export function render(ctx) {
  for (const p of pool) {
    if (!p.alive) continue;
    const k = p.life / p.maxLife;
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.fillStyle = p.color;
    const s = p.size * (0.5 + 0.5 * k);
    if (p.shape === 0) ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  const safe = canvas.safe();
  for (let i = 0; i < callouts.length; i++) {
    const c = callouts[i];
    const slam = config.fx.callout.slamSec;
    const inK = Math.min(1, c.t / slam);
    const outK = Math.max(0, (c.t - (c.hold - slam)) / slam);
    const scale = ease.outBack(inK) * (1 - ease.outQuad(outK) * 0.3);
    const alpha = 1 - outK;
    const y = c.y ?? safe.y + safe.h * 0.28 + i * config.theme.type.title * 1.1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(safe.cx, y);
    ctx.scale(scale, scale);
    ui.text(ctx, c.text, 0, 0, { size: 'title', color: c.color, stroke: true, align: 'center', baseline: 'middle' });
    if (c.sub) ui.text(ctx, c.sub, 0, config.theme.type.title * 0.75, { size: 'label', color: config.theme.ink, align: 'center', baseline: 'middle' });
    ctx.restore();
  }
}
