// Logical resolution, letterbox scaling, safe-area rect.
// Everything else renders in logical units and never reads window.innerWidth.

import config from './config.js';

export const W = config.display.width;
export const H = config.display.height;

let canvas = null;
let scale = 1;
let offX = 0;
let offY = 0;
let dpr = 1;

export function attach(el) {
  canvas = el;
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  scale = Math.min(cw / W, ch / H);
  offX = (cw - W * scale) / 2;
  offY = (ch - H * scale) / 2;
}

export function begin(ctx, letterboxColor) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = letterboxColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
}

export function end(ctx) {
  ctx.restore();
}

const safeRect = (() => {
  const f = config.display.safeArea;
  const w = W * f, h = H * f;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h, cx: W / 2, cy: H / 2, right: (W + w) / 2, bottom: (H + h) / 2 };
})();

export function safe() { return safeRect; }

export function toLogical(clientX, clientY) {
  return { x: (clientX - offX) / scale, y: (clientY - offY) / scale };
}
