// 2D overlay: post effects, number telops, word captions, end CTA.
const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const outBack = (x) => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const FONT = 'Montserrat';
const YELLOW = '#ffe03a';

let scan = null;
function scanlines() {
  if (scan) return scan;
  scan = document.createElement('canvas'); scan.width = W; scan.height = H;
  const g = scan.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
  return scan;
}
let tmp = null;

function strokeText(ctx, text, x, y, size, fill, stroke = 14, align = 'center') {
  ctx.font = `900 ${size}px ${FONT}, "Noto Color Emoji"`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  ctx.lineWidth = stroke; ctx.strokeStyle = '#000'; ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

export function drawOverlay(ctx, t, r, DATA, glCanvas) {
  const fx = r.fx || {};
  // ---- rewind / VHS ----
  if (fx.rewind > 0) {
    const k = fx.rewind;
    if (!tmp) { tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; }
    const g = tmp.getContext('2d'); g.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.55 * k; ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(tmp, 14 * k, 0); ctx.drawImage(tmp, -14 * k, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // tearing bands
    const band = ((t * 2300) % (H + 400)) - 200;
    for (let i = 0; i < 3; i++) {
      const y = (band + i * 610) % H, hh = 40 + i * 25;
      ctx.drawImage(tmp, 0, y, W, hh, (i % 2 ? 30 : -30) * k, y, W, hh);
    }
    ctx.fillStyle = `rgba(40,60,120,${0.18 * k})`; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = k; ctx.drawImage(scanlines(), 0, 0); ctx.globalAlpha = 1;
    // noise specks
    for (let i = 0; i < 160; i++) {
      const h = Math.sin(i * 91.7 + Math.floor(t * 30) * 13.1) * 43758.5; const x = (h - Math.floor(h)) * W;
      const h2 = Math.sin(i * 57.3 + Math.floor(t * 30) * 7.7) * 12345.6; const y = (h2 - Math.floor(h2)) * H;
      ctx.fillStyle = `rgba(255,255,255,${0.5 * k})`; ctx.fillRect(x, y, 3 + (i % 5) * 4, 2);
    }
    // ◀◀ icon
    ctx.globalAlpha = k;
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
    const ix = 90, iy = 170;
    for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.moveTo(ix + j * 62 + 60, iy - 38); ctx.lineTo(ix + j * 62, iy); ctx.lineTo(ix + j * 62 + 60, iy + 38); ctx.closePath(); ctx.fill(); }
    ctx.font = `800 64px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('REWIND', ix + 160, iy + 3);
    ctx.shadowColor = 'transparent'; ctx.globalAlpha = 1;
    ctx.restore();
  }
  // ---- grade: soft vignette ----
  const vg = ctx.createRadialGradient(W / 2, H * 0.47, H * 0.32, W / 2, H * 0.5, H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(20,0,0,${fx.vignette ?? 0.32})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (fx.flash > 0 && !window.__NOFLASH) { ctx.fillStyle = `rgba(255,250,240,${clamp(fx.flash)})`; ctx.fillRect(0, 0, W, H); }
  if (fx.tint) { ctx.fillStyle = fx.tint; ctx.fillRect(0, 0, W, H); }

  // ---- telops (numbers / labels) ----
  for (let tp of r.telops || []) {
    const lt = t - tp.t0; if (lt < 0 || (tp.t1 && t > tp.t1)) continue;
    { ctx.font = `900 ${tp.size}px ${FONT}`; const mw = ctx.measureText(tp.text).width + (tp.pill ? tp.size * 0.9 : 0); if (mw > 960) tp = { ...tp, size: tp.size * 960 / mw }; }
    const out = tp.t1 ? clamp((tp.t1 - t) / 0.12) : 1;
    const s = (tp.noPop ? 1 : outBack(clamp(lt / 0.22))) * (0.92 + 0.08 * out);
    ctx.save(); ctx.translate(tp.x, tp.y); ctx.rotate((tp.rot || 0) + 0.02 * Math.sin(lt * 6)); ctx.scale(s, s); ctx.globalAlpha = out;
    if (tp.pill) {
      ctx.font = `900 ${tp.size}px ${FONT}`; const w = ctx.measureText(tp.text).width + tp.size * 0.9, h = tp.size * 1.35;
      ctx.fillStyle = tp.pill; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.stroke();
      strokeText(ctx, tp.text, 0, 4, tp.size, tp.color || '#fff', 0.01);
    } else {
      strokeText(ctx, tp.text, 0, 0, tp.size, tp.color || YELLOW, tp.size * 0.16);
    }
    if (tp.sub) { let ss = Math.max(44, tp.size * 0.36); ctx.font = `900 ${ss}px ${FONT}`; const sw = ctx.measureText(tp.sub).width; if (sw > 900) ss *= 900 / sw; strokeText(ctx, tp.sub, 0, tp.size * 0.9, ss, '#fff', 10); }
    ctx.restore();
  }

  // ---- captions ----
  if (!r.hideCaptions) {
    const c = DATA.captions.find((c) => t >= c.s && t < c.e);
    if (c) {
      const lt = t - c.s; const s = 0.9 + 0.1 * outBack(clamp(lt / 0.1));
      const size = 92, y = H * 0.665;
      ctx.save(); ctx.translate(W / 2, y); ctx.scale(s, s);
      ctx.font = `900 ${size}px ${FONT}`;
      const parts = c.words.map((w) => ({ ...w, width: ctx.measureText(w.w).width }));
      const space = size * 0.28; let total = parts.reduce((a, p) => a + p.width, 0) + space * (parts.length - 1);
      let scale = total > W * 0.9 ? (W * 0.9) / total : 1; ctx.scale(scale, scale);
      let x = -total / 2;
      for (const p of parts) { strokeText(ctx, p.w, x + p.width / 2, 0, size, p.hl ? YELLOW : '#ffffff', 16); x += p.width + space; }
      ctx.restore();
    }
  }
  // ---- end call-to-action ----
  if (r.cta) {
    const lt = t - r.cta; const s = outBack(clamp(lt / 0.2));
    ctx.save(); ctx.translate(W / 2, H * 0.64); ctx.scale(s, s);
    strokeText(ctx, 'DID YOUR PARENTS', 0, -62, 84, '#ffffff', 15);
    strokeText(ctx, 'TELL YOU THIS TOO?', 0, 40, 84, YELLOW, 15);
    ctx.font = `150px "Noto Color Emoji"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const bob = 14 * Math.sin(lt * 9);
    ctx.fillText('👇', 0, 200 + bob);
    ctx.restore();
  }
}
