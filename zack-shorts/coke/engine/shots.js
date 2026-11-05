import * as THREE from 'three';
import { clamp, lerp, inv, seg, ease, track, ktrack, V, smooth } from './lib.js';
import { DATA } from './data.js';
import { buildCola, colaUpdate, setNight, toothPose, SURF, BASE, GH } from './cola.js';
import { buildStomachHalf, buildMucus, buildStudio } from './gastric.js';
import { buildMouth2, placeGlass, CONTACT } from './mouth2.js';

export const SHOTS = [];
export let END = 33.235;
const W = (i) => DATA.words[i].s;
let CO, GA, MU, ST, MO;

export async function setup({ renderer, env }) {
  CO = buildCola(env); window.__CO = CO; GA = buildStomachHalf(env); MU = buildMucus(env); ST = buildStudio(env); MO = buildMouth2(env);
  END = DATA.words[DATA.words.length - 1].e + 1.15;
  SHOTS.push({ t0: 0, t1: 3.4, run: shotA });
  SHOTS.push({ t0: 3.4, t1: W(24) - 0.05, run: shotB });
  SHOTS.push({ t0: W(24) - 0.05, t1: 7.75, run: shotRewind });
  SHOTS.push({ t0: 7.75, t1: W(30), run: shotC0 });
  SHOTS.push({ t0: W(30), t1: W(37) - 0.05, run: shotC1 });
  SHOTS.push({ t0: W(37) - 0.05, t1: W(46) - 0.07, run: shotC2 });
  SHOTS.push({ t0: W(46) - 0.07, t1: W(58) - 0.03, run: shotD, cuts: [15.2, 16.5] });
  SHOTS.push({ t0: W(58) - 0.03, t1: W(78) - 0.05, run: shotE });
  SHOTS.push({ t0: W(78) - 0.05, t1: W(94) - 0.05, run: shotF, cuts: [1, 2, 3, 4].map((k) => W(78) - 0.05 + k * BEAT) });
  SHOTS.push({ t0: W(94) - 0.05, t1: W(101) + 0.33, run: shotG, cuts: [W(99) - 0.1] });
  SHOTS.push({ t0: W(101) + 0.33, t1: 99, run: shotL });
}

function aim(cam, pos, look, fov = 50, roll = 0) {
  cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(look);
  if (roll) cam.rotateZ(roll);
  cam.fov = fov; cam.updateProjectionMatrix();
}
const inLiquid = (p) => Math.hypot(p.x, p.z) < 0.88 && p.y < SURF - 0.02 && p.y > BASE;
const shake = (t, amp, f = 40) => V(Math.sin(t * f) * amp, Math.cos(t * f * 1.3) * amp, 0);
const bump = (t, a, b, c, d) => seg(t, a, b, ease.inOut) * (1 - seg(t, c, d, ease.inOut));

// ---------------- SHOT A (0 - 3.4): one continuous take - foam macro -> orbit -> dive -> bubbles -> tooth settles ----------------
const camA = track([
  [0.0, [0.1, SURF - 0.04, 1.75]],    // 1. side macro through the glass: foam band, dark cola below, tooth touching
  [0.6, [-0.75, SURF - 0.1, 1.35]],   // 2. orbit left as the splash settles
  [1.05, [-0.55, SURF - 0.14, 0.7]],  // 3. under the surface
  [1.6, [-0.4, SURF - 0.75, 0.74]],   // 4. dive after the sinking tooth
  [2.3, [0.5, SURF - 1.05, 0.7]],     // 5. swing right through the bubble stream
  [3.0, [0.3, BASE + 0.65, 0.76]],    // 6. low, tooth at the bottom
  [3.4, [0.2, BASE + 0.55, 0.7]],
]);
const lookA = track([
  [0.0, [0.04, SURF + 0.1, 0.0]], [0.55, [0.06, SURF + 0.0, 0.0]], [1.0, [0.06, SURF - 0.5, 0.0]],
  [1.6, [0.08, SURF - 0.95, 0.0]], [2.3, [0.05, SURF - 1.3, 0.0]], [3.0, [0.02, BASE + 0.42, 0.0]], [3.4, [0.0, BASE + 0.4, 0.0]],
]);
const fovA = ktrack([[0, 34], [0.6, 40], [1.05, 60], [1.6, 62], [2.3, 62], [3.0, 58], [3.4, 52]]);
const rollA = ktrack([[0, 0], [0.6, -0.05], [1.2, 0.0], [2.3, 0.1], [3.0, 0], [3.4, 0]]);
function camAat(t) { return { pos: camA(t).add(shake(t, 0.006 * seg(t, 0.02, 0.1) * (1 - seg(t, 0.1, 0.4)))), look: lookA(t), fov: fovA(t), roll: rollA(t) }; }
function shotA(t, cam) {
  const S = CO; setNight(S, 0, null); S.clock.visible = false; S.pop.group.visible = false;
  const c = camAat(t); aim(cam, c.pos, c.look, c.fov, c.roll);
  S.scene.fog = inLiquid(c.pos) ? S.fog : null;
  colaUpdate(S, t, { camPos: c.pos, toothT: t });
  return { scene: S.scene, fx: { vignette: 0.28 }, exposure: 1.0, dof: { focus: cam.position.distanceTo(S.tooth.position), aperture: 0.004, maxblur: 0.008 } };
}

// ---------------- SHOT B (3.4 - 7.05): the myth - a night passes, the tooth melts away ----------------
const camB = track([
  [3.4, [0.2, BASE + 0.55, 0.7]], [3.85, [0.0, 2.55, 7.3]],       // whip pull-back to the whole scene
  [4.8, [0.3, 0.9, 2.9]],                                          // push in on the tooth as it starts to melt
  [5.3, [0.0, 3.7, 5.6]],                                          // whip up to the racing clock
  [5.95, [0.2, 1.5, 4.3]],                                         // down to the empty glass
  [6.5, [0.0, 2.3, 6.6]], [7.05, [0.0, 2.5, 7.4]],
]);
const lookB = track([
  [3.4, [0.0, BASE + 0.4, 0]], [3.85, [0.0, 2.5, 0]], [4.8, [0.0, BASE + 0.42, 0]], [5.3, [0.0, 4.1, -1.0]], [5.95, [0.0, 1.3, 0]], [6.5, [0.0, 2.3, 0]], [7.05, [0, 2.5, 0]],
]);
const fovB = ktrack([[3.4, 52], [3.85, 42], [4.8, 40], [5.3, 42], [5.95, 40], [6.5, 42], [7.05, 42]]);
function shotB(t, cam, noPill = false) {
  const S = CO; S.clock.visible = true; S.clock.position.set(0, 4.1, -2.2); S.clock.scale.setScalar(0.85);
  const melt = smooth(clamp((t - 4.15) / 2.25));
  const night = seg(t, 3.55, 4.4) * (1 - seg(t, 5.95, 6.8));
  const hours = 9 + 12 * smooth(clamp((t - 3.6) / 3.1));
  setNight(S, night, hours);
  const pos = camB(t).add(shake(t, 0.01 * bump(t, 4.0, 4.1, 4.2, 4.6), 30)); aim(cam, pos, lookB(t), fovB(t), 0.05 * Math.sin(t * 1.3));
  S.scene.fog = inLiquid(pos) ? S.fog : null;
  const wob = melt > 0 && melt < 1 ? 0.03 * Math.sin(t * 22) * melt : 0;
  colaUpdate(S, t, { camPos: pos, toothT: t, melt: clamp(melt + wob) });
  const popK = bump(t, 6.3, 6.4, 6.7, 7.0);
  S.pop.group.visible = popK > 0; S.pop.update(t, V(0.0, BASE + 0.3, 0.1), 0.5, popK);
  const telops = noPill ? [] : [{ text: 'THE MYTH', x: 540, y: 1480, t0: 3.5, t1: 7.0, size: 88, pill: '#e5392a', color: '#ffffff' }];
  const mb = (t < 3.95 || (t > 5.0 && t < 5.5)) ? { n: 5, dt: 1 / 48 } : null;
  return { scene: S.scene, fx: { vignette: 0.3 }, exposure: 1.0, telops, mblur: mb, dof: { focus: cam.position.distanceTo(S.tooth.visible ? S.tooth.position : V(0, 1, 0)), aperture: 0.003, maxblur: 0.006 } };
}

// ---------------- REWIND (7.05 - 7.75): the myth plays backwards ----------------
function shotRewind(t, cam) {
  const t0 = W(24) - 0.05, t1 = 7.75;
  const r = shotB(lerp(6.6, 4.3, inv(t0, t1, t)), cam, true);
  return { ...r, mblur: null, fx: { ...(r.fx || {}), rewind: 1 }, dof: { ...r.dof, aperture: 0 } };
}

// ---------------- C0 (7.75 - 9.4): "Coke's acid ..." - the glass, tooth intact, Coke pH ~2.5 ----------------
function colaWide(t, cam, a, b, k) {
  const pos = V(lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)); aim(cam, pos, V(0, lerp(1.3, 1.1, k), 0), 40, 0.02 * Math.sin(t * 0.8));
  return pos;
}
function shotC0(t, cam) {
  const S = CO; S.clock.visible = false; S.pop.group.visible = false; setNight(S, 0, null);
  const k = ease.inOut(inv(7.75, W(30), t)); const pos = colaWide(t, cam, [0.35, 1.9, 6.6], [-0.1, 1.35, 5.2], k);
  S.scene.fog = null; colaUpdate(S, t, { camPos: pos, toothT: 3.4 + (t - 7.75) });
  const telops = [{ text: 'Coke pH ~2.5', x: 540, y: 470, t0: 7.78, size: 150, color: '#ffe03a' }];
  return { scene: S.scene, fx: { vignette: 0.3, flash: (1 - seg(t, 7.75, 7.85)) * 0.5 }, exposure: 1.0, telops, dof: { focus: cam.position.distanceTo(V(0, 1.3, 0)), aperture: 0.002, maxblur: 0.004 } };
}

// ---------------- C1 (9.4 - 11.4): glass | stomach, split screen ----------------
function shotC1(t, cam) {
  const S = CO; S.clock.visible = false; S.pop.group.visible = false; setNight(S, 0, null); S.scene.fog = null;
  const k = inv(W(30), W(37), t);
  const posTop = V(0.2 * Math.sin(k * 2), 1.4, 8.8 - 0.4 * k); const posBot = V(0.0, 0.25, 8.6 - 0.3 * k);
  colaUpdate(S, t, { camPos: posTop, toothT: 3.4 + (t - 7.75) }); GA.update(t);
  const telops = [
    { text: 'Coke pH ~2.5', x: 540, y: 240, t0: W(30) - 0.02, size: 118, color: '#ffe03a' },
    { text: 'Stomach pH 1.5–3.5', x: 540, y: 1105, t0: W(36), size: 92, color: '#d8ff3a' },
    { text: 'LOWER pH = STRONGER ACID', x: 540, y: 960, t0: W(36) + 0.35, size: 44, pill: '#ffffff', color: '#111111', noPop: false },
  ];
  return {
    fx: { vignette: 0.28, flash: (1 - seg(t, W(30), W(30) + 0.1)) * 0.7 }, telops,
    parts: [
      { scene: S.scene, exposure: 1.0, dof: { focus: 7.9, aperture: 0.0015, maxblur: 0.003 }, setup: (c) => aim(c, posTop, V(0, 1.35, 0), 40, 0) },
      { scene: GA.scene, exposure: 1.0, dof: { focus: 8.3, aperture: 0.0, maxblur: 0 }, setup: (c) => aim(c, posBot, V(0, 0.4, 0), 38, 0) },
    ],
  };
}

// ---------------- C2 (11.4 - 13.6): the fact - a whole night passes, the tooth is still there ----------------
function shotC2(t, cam) {
  const S = CO; S.clock.visible = true; S.clock.position.set(0, 4.1, -2.2); S.clock.scale.setScalar(0.85); S.pop.group.visible = false;
  const t0 = W(37) - 0.05, t1 = W(46) - 0.07; const k = inv(t0, t1, t);
  const night = Math.sin(Math.PI * smooth(clamp(inv(t0, t1 - 0.2, t)))) ;
  const hours = 9 + 11 * smooth(clamp(inv(t0, t1 - 0.3, t)));
  setNight(S, clamp(night * 1.15), hours);
  const pos = track([[t0, [0.0, 2.2, 7.0]], [W(40), [0.15, 1.2, 4.6]], [t1, [0.35, BASE + 0.8, 2.4]]])(t);
  const look = track([[t0, [0, 2.5, 0]], [W(40), [0, 0.9, 0]], [t1, [0.0, BASE + 0.4, 0]]])(t);
  aim(cam, pos, look, ktrack([[t0, 42], [t1, 34]])(t), 0.02 * Math.sin(t * 1.1));
  S.scene.fog = inLiquid(pos) ? S.fog : null;
  colaUpdate(S, t, { camPos: pos, toothT: 3.4 + (t - 7.75), wear: 0.04 });
  const telops = [
    { text: 'THE FACT', x: 540, y: 1480, t0: t0 + 0.05, size: 88, pill: '#22b25a', color: '#ffffff' },
    { text: 'STILL INTACT', x: 540, y: 470, t0: W(40) + 0.05, size: 124, color: '#ffffff' },
  ];
  return { scene: S.scene, fx: { vignette: 0.3, flash: (1 - seg(t, t0, t0 + 0.1)) * 0.6 }, exposure: 1.0, telops, dof: { focus: cam.position.distanceTo(V(0, BASE + 0.4, 0)), aperture: 0.003, maxblur: 0.006 } };
}

// ---------------- D (13.6 - 18.1): DAY 1 -> DAY 3 -> DAY 7 on a locked camera ----------------
function shotD(t, cam) {
  const t0 = W(46) - 0.07, t3 = 15.2, t7 = 16.5, t1 = W(58) - 0.03;
  const day = t < t3 ? 1 : t < t7 ? 3 : 7;
  const wear = day === 1 ? lerp(0.0, 0.14, inv(t0, t3, t)) : day === 3 ? lerp(0.42, 0.62, inv(t3, t7, t)) : lerp(0.84, 1.0, inv(t7, t1, t));
  ST.tooth.userData.setWear(wear); ST.tooth.rotation.set(0.12, -0.5 + 0.02 * Math.sin(t * 0.8), 0);
  const sparkK = day === 1 ? 0.95 : day === 3 ? 0.4 : 0;
  ST.spark.position.set(-0.26, 0.78, 0.55); ST.spark.scale.setScalar(0.3 + 0.12 * Math.sin(t * 7)); ST.spark.material.opacity = sparkK * (0.75 + 0.25 * Math.sin(t * 7));
  const pull = lerp(1.0, 0.95, inv(t0, t1, t));
  aim(cam, V(0, 0.8, 4.5 * pull), V(0, 0.3, 0), 30, 0);
  const tn = day === 1 ? t0 : day === 3 ? t3 : t7;
  const telops = [
    { text: 'DAY 1', x: 540, y: 430, t0: t0 + 0.02, t1: t3, size: 190, color: '#ffe03a' },
    { text: 'DAY 3', x: 540, y: 430, t0: t3, t1: t7, size: 190, color: '#ffe03a' },
    { text: 'DAY 7', x: 540, y: 430, t0: t7, t1: t1 + 0.05, size: 190, color: '#ffe03a', sub: 'SURFACE DULL, NOT GONE' },
  ];
  return { scene: ST.scene, fx: { vignette: 0.22, flash: (1 - seg(t, tn, tn + 0.1)) * (day === 1 ? 0.5 : 0.8) }, exposure: 1.0, telops, dof: { focus: 2.8, aperture: 0.0, maxblur: 0 } };
}

// ---------------- E (18.1 - 24.7): x-ray stomach wall - acid rains on a thick mucus layer that is rebuilt ----------------
const camE = track([
  [W(58) - 0.03, [-2.6, 0.9, 8.2]], [19.6, [0.6, 1.4, 7.4]], [21.4, [-0.9, 0.3, 6.0]], [22.7, [1.2, -0.4, 5.2]], [23.9, [0.0, 0.3, 7.0]], [24.7, [0.0, 0.2, 7.8]],
]);
const lookE = track([
  [W(58) - 0.03, [-1.0, 0.3, 0]], [19.6, [0.2, 0.7, 0]], [21.4, [-0.9, 0.0, 0]], [22.7, [1.1, -0.7, 0]], [23.9, [0, 0, 0]], [24.7, [0, 0, 0]],
]);
function shotE(t, cam) {
  MU.update(t);
  const t0 = W(58) - 0.03;
  aim(cam, camE(t), lookE(t), ktrack([[t0, 42], [21.4, 38], [22.7, 36], [24.7, 42]])(t), 0.03 * Math.sin(t * 0.7));
  const telops = [
    { text: 'ACID pH ~1.5', x: 540, y: 470, t0: W(63) - 0.1, t1: W(68), size: 104, pill: '#c8f020', color: '#101810' },
    { text: 'MUCUS SHIELD', x: 540, y: 470, t0: W(70) - 0.05, t1: W(76) - 0.05, size: 118, color: '#9ff0ff', sub: 'ACID STOPS HERE' },
    { text: 'REBUILT CONSTANTLY', x: 540, y: 470, t0: W(76) - 0.05, size: 92, color: '#ffffff' },
  ];
  return { scene: MU.scene, fx: { vignette: 0.26, flash: (1 - seg(t, t0, t0 + 0.1)) * 0.6 }, exposure: 1.0, telops, dof: { focus: cam.position.distanceTo(lookE(t)), aperture: 0.0015, maxblur: 0.004 } };
}

// ---------------- F (24.7 - 29.4): sipping all day - the glass keeps touching the teeth ----------------
const SIPS = [
  { pos: [-0.55, -0.2, 1.7], look: [0, -0.1, 0.3], fov: 38, label: '8 AM' },
  { pos: [0.6, -0.1, 1.45], look: [0, -0.1, 0.3], fov: 34, label: '11 AM' },
  { pos: [0.1, 0.55, 1.5], look: [0, -0.1, 0.3], fov: 38, label: '2 PM' },
  { pos: [-0.65, -0.15, 1.35], look: [0, -0.1, 0.3], fov: 34, label: '5 PM' },
  { pos: [0.0, 0.0, 2.1], look: [0, -0.06, 0.3], fov: 40, label: '8 PM' },
];
const BEAT = 0.95;
function mouthLights(S) { S.fill.position.set(1.2, 0.3, 1.8); }
function shotF(t, cam) {
  const S = MO; const t0 = W(78) - 0.05;
  const b = clamp(Math.floor((t - t0) / BEAT), 0, 4), tb = t0 + b * BEAT, u = (t - tb) / BEAT;
  const p = smooth(clamp(u / 0.36)) * (1 - smooth(clamp((u - 0.7) / 0.28)));
  placeGlass(S.cola, p, -lerp(0.2, 0.62, p), V(0.5, -0.95, 1.1));
  S.cola.userData.setLevel(1 - 0.05 * b); S.water.visible = false;
  let stain = 0; for (let i = 0; i < 5; i++) stain += 0.17 * smooth(clamp((t - (t0 + i * BEAT + 0.34)) / 0.2)); S.setStain(Math.min(stain, 0.95));
  S.colaDrops.mesh.visible = true; S.colaDrops.update(t - (tb + 0.34), CONTACT.clone().add(V(0, 0.03, 0.05)), { speed: 1.2, gravity: 3.4 });
  S.waterDrops.mesh.visible = false; S.stars.group.visible = false;
  S.upper.position.y = 0.11; S.lower.position.y = -0.15;
  const c = SIPS[b]; const drift = 1 - 0.06 * u;
  const pos = V(c.pos[0] * drift, c.pos[1], c.pos[2] * drift); aim(cam, pos, V(...c.look), c.fov, 0.03 * Math.sin(t * 2 + b));
  const telops = [{ text: c.label, x: 540, y: 250, t0: tb + 0.02, t1: tb + BEAT, size: 104, pill: '#1b1b22', color: '#ffe03a' }];
  return { scene: S.scene, fx: { vignette: 0.3, flash: (1 - seg(t, tb, tb + 0.07)) * 0.55 }, exposure: 1.0, telops, dof: { focus: cam.position.distanceTo(V(0, -0.1, 0.3)), aperture: 0.004, maxblur: 0.008 } };
}

// ---------------- G (29.4 - 32.4): drink it quickly, then rinse with water ----------------
function shotG(t, cam) {
  const S = MO; const tg = W(94) - 0.05, tw = W(99) - 0.1;
  const gulp = t < tw; S.upper.position.y = 0.11; S.lower.position.y = -0.15;
  S.stars.group.visible = false; S.waterDrops.mesh.visible = false;
  if (gulp) {
    const u = inv(tg, tw, t); const p = smooth(clamp(u / 0.18)) * (1 - smooth(clamp((u - 0.82) / 0.16)));
    const L = 1 - 0.85 * smooth(clamp((u - 0.18) / 0.5));
    placeGlass(S.cola, p, -lerp(0.3, 1.0, smooth(clamp((u - 0.1) / 0.5))), V(0.5, -0.95, 1.1)); S.cola.userData.setLevel(L); S.water.visible = false;
    S.setStain(0.85 + 0.1 * smooth(clamp((u - 0.2) / 0.4)));
    S.colaDrops.mesh.visible = true; S.colaDrops.update((t - tg) % 0.35, CONTACT.clone().add(V(0.05, 0.02, 0.1)), { speed: 0.7, gravity: 3.6 });
    const pos = V(lerp(0.7, 0.35, u), -0.05, lerp(1.7, 1.4, u)); aim(cam, pos, V(0, -0.1, 0.3), 38, -0.04 * Math.sin(u * 3));
  } else {
    const u = inv(tw, W(101) + 0.33, t); const p = smooth(clamp(u / 0.22)); S.cola.visible = false;
    placeGlass(S.water, p, -lerp(0.4, 1.0, smooth(clamp((u - 0.1) / 0.5))), V(-0.5, -0.95, 1.1)); S.water.userData.setLevel(1 - 0.35 * smooth(clamp((u - 0.2) / 0.6)));
    S.setStain(0.95 * (1 - smooth(clamp((u - 0.25) / 0.45))));
    S.waterDrops.mesh.visible = true; S.waterDrops.update(((t - tw) * 1.0) % 0.45, CONTACT.clone().add(V(-0.05, 0.05, 0.1)), { speed: 0.9, gravity: 3.2 });
    S.colaDrops.mesh.visible = false;
    const sk = seg(t, tw + 0.75, tw + 1.0); S.stars.group.visible = sk > 0; S.stars.update(t, V(0, -0.05, 0.4), 0.42, sk);
    const pos = V(lerp(0.4, 0.1, u), -0.08, lerp(1.5, 1.25, u)); aim(cam, pos, V(0, -0.08, 0.3), 36, 0);
  }
  if (gulp) S.cola.visible = S.cola.visible; else S.cola.visible = false;
  const telops = [];
  return { scene: S.scene, fx: { vignette: 0.28, flash: (1 - seg(t, gulp ? tg : tw, (gulp ? tg : tw) + 0.08)) * 0.6 }, exposure: 1.0, telops, dof: { focus: cam.position.distanceTo(V(0, -0.08, 0.3)), aperture: 0.004, maxblur: 0.008 } };
}

// ---------------- L (32.4 - END): loop - back to the glass; the tooth falls into the exact pose of frame 0 ----------------
function shotL(t, cam) {
  const S = CO; S.clock.visible = false; S.pop.group.visible = false; setNight(S, 0, null);
  const t0 = W(101) + 0.33; const k = ease.out(inv(t0, END, t));
  const a = camAat(0); const off = V(0.0, 0.1, 0.55).multiplyScalar(1 - k);
  const pos = a.pos.clone().add(off); const look = a.look.clone().add(V(0, 0.18, 0).multiplyScalar(1 - k));
  aim(cam, pos, look, lerp(52, a.fov, k), lerp(0.08, 0, k));
  S.scene.fog = null; colaUpdate(S, t, { camPos: pos, toothT: t - END });
  return { scene: S.scene, fx: { vignette: 0.28, flash: (1 - seg(t, t0, t0 + 0.12)) * 0.8 }, exposure: 1.0, cta: END - 1.0, hideCaptions: t >= END - 1.0, dof: { focus: cam.position.distanceTo(S.tooth.position), aperture: 0.004, maxblur: 0.008 } };
}
