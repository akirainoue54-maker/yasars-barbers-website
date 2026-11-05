import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { DATA } from './data.js';
import { SHOTS, setup } from './shots.js';
import { drawOverlay } from './overlay.js';
import { GAINS } from './gains.js';

const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const out = document.createElement('canvas'); out.width = W; out.height = H;
const ctx = out.getContext('2d');
document.body.appendChild(out);

const camera = new THREE.PerspectiveCamera(55, W / H, 0.01, 200);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bokeh = new BokehPass(new THREE.Scene(), camera, { focus: 1, aperture: 0.002, maxblur: 0.008 });
composer.addPass(renderPass); composer.addPass(bokeh); composer.addPass(new OutputPass());

async function init() {
  await Promise.all([
    document.fonts.load('900 100px Montserrat'), document.fonts.load('800 100px Montserrat'),
    document.fonts.load('100px "Noto Color Emoji"', '👇'),
  ]);
  console.log('[log] fonts ok ' + performance.now().toFixed(0));
  await setup({ renderer, env, camera });
  console.log('[log] setup ok ' + performance.now().toFixed(0));
  // warm-up compile of every shot's scene
  for (const s of SHOTS) { const r = s.run(s.t0 + 0.01, camera); (r.parts || [r]).forEach((p) => renderer.compile(p.scene, camera)); }
  window.END = (await import('./shots.js')).END;
  window.SHOTSPAN = SHOTS.map((s) => [s.t0, Math.min(s.t1, window.END), s.cuts || []]);
  window.ready = true;
}

const gainOf = (idx, t) => { const g = GAINS[idx]; if (g == null) return 1; if (typeof g === 'number') return g; if (t <= g[0][0]) return g[0][1];
  for (let i = 1; i < g.length; i++) if (t <= g[i][0]) { const k = (t - g[i - 1][0]) / (g[i][0] - g[i - 1][0]); return g[i - 1][1] * (1 - k) + g[i][1] * k; } return g[g.length - 1][1]; };

window.renderFrame = (t) => {
  const shot = SHOTS.find((s) => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];
  const r = shot.run(t, camera);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  const gTot = (r.exposure ?? 1.0) * gainOf(SHOTS.indexOf(shot), t); renderer.toneMappingExposure = Math.max(1, gTot); const postMul = Math.min(1, gTot);
  const draw = (rr) => {
    renderPass.scene = rr.scene; bokeh.scene = rr.scene;
    const d = rr.dof || { focus: 1, aperture: 0, maxblur: 0 };
    bokeh.enabled = d.aperture > 0;
    bokeh.uniforms.focus.value = d.focus; bokeh.uniforms.aperture.value = d.aperture; bokeh.uniforms.maxblur.value = d.maxblur ?? 0.01;
    composer.render();
  };
  ctx.save(); ctx.clearRect(0, 0, W, H);
  if (r.parts) { // split screen: each part is rendered full-frame, its centre band is drawn into its half
    const gain = gainOf(SHOTS.indexOf(shot), t);
    r.parts.forEach((p, i) => {
      p.setup(camera); camera.updateProjectionMatrix();
      renderer.toneMappingExposure = Math.max(1, (p.exposure ?? 1) * gain); draw(p);
      ctx.drawImage(renderer.domElement, 0, 480, W, 960, 0, i * 960, W, 960);
    });
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12; ctx.fillRect(0, 956, W, 8); ctx.shadowColor = 'transparent';
  } else if (r.mblur) { // average sub-frames across the shutter for fast camera moves
    const n = r.mblur.n;
    for (let i = 0; i < n; i++) { const ts = t + (i / (n - 1) - 0.5) * r.mblur.dt; const rr = shot.run(ts, camera); camera.updateProjectionMatrix(); draw(rr); ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(renderer.domElement, 0, 0); }
    ctx.globalAlpha = 1; shot.run(t, camera);
  } else { draw(r); ctx.drawImage(renderer.domElement, 0, 0); }
  if (postMul < 0.999) { const v = Math.round(postMul * 255); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  drawOverlay(ctx, t, r, DATA, renderer.domElement);
  return out.toDataURL('image/jpeg', 0.93);
};

init().catch((e) => { console.error('INIT FAILED', e.stack || e); });
