import * as THREE from 'three';
import { clamp, lerp, inv, seg, ease, track, ktrack, V, smooth } from './lib.js';
import { buildMouth } from './set_mouth.js';
import { buildStomach, waveAcid, squeezeCavity, ACID_Y, RY } from './set_stomach.js';
import { DATA } from './data.js';
import { buildBelly } from './set_belly.js';
import { buildXray, buildGut } from './set_xray.js';
import { buildToilet, waveWater, WATER_Y } from './set_toilet.js';
import { makeSplitSeed, makeSeed } from './melon.js';
import { Droplets, Sparkles, glow } from './fx.js';
const W = (i) => DATA.words[i].s;

export const SHOTS = [];
export let END = 33.2;
let M, ST, BE, XR, GU, TO, SPLIT, CRUMBS, KSPARK, KGLOW, JUICE; // sets

export async function setup({ renderer, env }) {
  M = buildMouth(); M.scene.environment = env; M.scene.environmentIntensity = 0.55;
  ST = buildStomach(); ST.scene.environment = env; ST.scene.environmentIntensity = 0.45;
  BE = buildBelly(); BE.scene.environment = env; BE.scene.environmentIntensity = 0.5;
  XR = buildXray(); GU = buildGut(); GU.scene.environment = env; GU.scene.environmentIntensity = 0.6;
  TO = buildToilet(); TO.scene.environment = env; TO.scene.environmentIntensity = 0.8;
  // extras living in the mouth set for the ending
  SPLIT = makeSplitSeed(0.105); M.scene.add(SPLIT.group); SPLIT.group.visible = false;
  CRUMBS = new Droplets(26, new THREE.MeshPhysicalMaterial({ color: 0x2a1a10, roughness: 0.35, clearcoat: 1 }), { size: 0.0035, seed: 44 }); M.scene.add(CRUMBS.mesh);
  JUICE = new Droplets(90, new THREE.MeshPhysicalMaterial({ color: 0xff3048, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.85 }), { size: 0.012, seed: 45 }); M.scene.add(JUICE.mesh);
  KSPARK = new Sparkles(22, '#ffd76a', { seed: 46, size: 0.022, star: true }); M.scene.add(KSPARK.group);
  KGLOW = glow('#ffd080', 0.5); KGLOW.material.opacity = 0; M.scene.add(KGLOW);
  { // navel position on the torso surface
    const rc = new THREE.Raycaster(V(0, 0.02, 3), V(0, 0, -1)); const h = rc.intersectObject(BE.torso)[0]; if (h) BE.navel.copy(h.point); }
  END = DATA.words[DATA.words.length - 1].e + 1.15; // narration end + CTA second
  SHOTS.push({ t0: 0, t1: 3.3, run: shotA });
  SHOTS.push({ t0: 3.3, t1: 5.55, run: shotB1 });
  SHOTS.push({ t0: 5.55, t1: W(24), run: shotB2 });
  SHOTS.push({ t0: W(24), t1: 8.78, run: shotRewind });
  SHOTS.push({ t0: 8.78, t1: W(51), run: shotC });
  SHOTS.push({ t0: W(51), t1: W(61), run: shotD12 });
  SHOTS.push({ t0: W(61), t1: W(66), run: shotD3 });
  SHOTS.push({ t0: W(66), t1: W(79), run: shotD45 });
  SHOTS.push({ t0: W(79), t1: W(88), run: shotD6 });
  SHOTS.push({ t0: W(88), t1: 99, run: shotE });
}

function aim(cam, pos, look, fov = 55, roll = 0) {
  cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(look);
  if (roll) cam.rotateZ(roll);
  cam.fov = fov; cam.updateProjectionMatrix();
}
function basis(dy, ref) {
  const y = dy.clone().normalize(); const z = ref.clone().sub(y.clone().multiplyScalar(ref.dot(y))).normalize();
  const x = y.clone().cross(z); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const shake = (t, amp, f = 40) => V(Math.sin(t * f) * amp, Math.cos(t * f * 1.3) * amp, 0);

// ---------------- SHOT A: bite -> tongue -> gulp -> down the throat (one continuous take) ----------------
const sliceQ = basis(V(0.9, -0.25, 0.85), V(0.05, 0.25, -1));
const seedPathA = track([[0, [0.0, -0.03, 0.4]], [0.78, [-0.01, -0.03, 0.17]]]);
const camPosA = track([[0, [0, 0.0, -0.62]], [0.72, [0, -0.01, -0.42]], [1.05, [0, 0.03, -0.48]], [1.55, [0, 0.14, -0.55]], [2.3, [0, 0.02, -1.55]], [2.68, [0, -0.32, -2.42]]]);
const camLookA = track([[0, [0.02, -0.08, 2]], [0.72, [0.02, -0.12, 2]], [1.05, [0.0, -0.1, 1.5]], [1.55, [0, -0.25, -1.4]], [2.3, [0, -0.3, -2.4]], [2.68, [0, -1.6, -2.85]]]);
function shotA(t, cam) {
  const S = M;
  // jaw: open, chomp at 0.72-0.88, reopen
  const close = seg(t, 0.68, 0.84, ease.in) * (1 - seg(t, 1.0, 1.35));
  S.lower.position.y = -0.2 + 0.31 * close; S.lower.rotation.x = -0.05 * (1 - close);
  S.upper.position.y = 0.16 - 0.06 * close;
  // slice: pushes in, then pulls away after the bite
  const inn = seg(t, 0, 0.78, ease.inOutSine), away = seg(t, 0.95, 1.6, ease.in);
  S.slice.quaternion.copy(sliceQ);
  { const bs = S.slice.userData.seeds[9]; const local = bs.position.clone().multiplyScalar(S.slice.scale.x).applyQuaternion(sliceQ);
    S.slice.position.copy(seedPathA(Math.min(t, 0.78)).sub(local)).add(V(0.6 * away, -0.25 * away, 2.2 * away)); }
  S.slice.visible = t < 1.6;
  const bitten = S.slice.userData.seeds[9];
  bitten.visible = t < 0.86;
  // the seed: from the slice -> tongue -> throat -> esophagus
  const seed = S.seed, chunk = S.chunk;
  S.slice.updateMatrixWorld(true);
  const sp = bitten.getWorldPosition(V(0, 0, 0));
  let camU = 0;
  if (t < 0.86) { seed.visible = false; chunk.visible = false; }
  else {
    seed.visible = true; chunk.visible = t < 2.2;
    const land = V(0.04, -0.17, -0.25), back = V(0.0, -0.2, -1.6), drop = S.tunnel.at(0.215);
    let p;
    if (t < 1.25) { const k = seg(t, 0.86, 1.25, ease.in); p = sp.clone().lerp(land, k); p.y += 0.12 * Math.sin(k * Math.PI); }
    else if (t < 1.4) { const k = seg(t, 1.25, 1.4); p = land.clone(); p.y += 0.04 * Math.sin(k * Math.PI); }
    else if (t < 2.35) { const k = seg(t, 1.55, 2.35, ease.in); p = land.clone().lerp(back, k); }
    else if (t < 2.75) { const k = seg(t, 2.35, 2.75, ease.in); p = back.clone().lerp(drop, k); }
    else { const u = lerp(0.215, 0.62, seg(t, 2.75, 3.35, ease.in)); p = S.tunnel.at(u); }
    seed.position.copy(p);
    seed.rotation.set(t * 2.2, t * 3.1, t * 1.3);
    chunk.position.copy(p).add(V(0.09, 0.02, 0.04)); chunk.rotation.set(t * 1.7, t, 0);
  }
  JUICE.update(t - 0.8, sp.clone().add(V(0, 0.02, -0.05)), { speed: 1.1, gravity: 3, up: V(0, 0.4, -1) });
  JUICE.mesh.visible = t > 0.79 && t < 1.6;
  SPLIT.group.visible = false; KGLOW.material.opacity = 0; KSPARK.group.visible = false; CRUMBS.mesh.visible = false;
  // camera
  let pos, look;
  if (t < 2.68) { pos = camPosA(t); look = camLookA(t); }
  else {
    const u = lerp(0.2, 0.58, seg(t, 2.68, 3.35, ease.in));
    pos = S.tunnel.at(u, 0, 0.02); look = S.tunnel.at(u + 0.05);
  }
  pos.add(shake(t, 0.012 * seg(t, 0.8, 0.84) * (1 - seg(t, 0.84, 1.05))));
  const fov = ktrack([[0, 58], [0.72, 54], [1.05, 62], [1.55, 66], [2.4, 62], [3.3, 78]])(t);
  aim(cam, pos, look, fov, ktrack([[0, 0], [0.8, -0.04], [1.3, 0.08], [2.3, 0], [3.3, 0.3]])(t));
  // peristaltic rings racing down the esophagus during the gulp
  const g = seg(t, 2.3, 2.6);
  S.tunnel.update((u) => 1 - g * 0.22 * Math.max(0, Math.sin(u * 70 - t * 22)) * smooth(clamp((u - 0.22) / 0.05)));
  S.camLight.position.copy(pos).add(cam.getWorldDirection(V(0, 0, 0)).multiplyScalar(-0.35)).add(V(0, 0.08, 0));
  S.fill.position.copy(t < 1.4 ? V(0, 0.15, -0.9) : pos.clone().add(V(0, 0.1, 0)));
  const fx = { flash: seg(t, 3.2, 3.33, ease.in) * 0.9, vignette: 0.3 };
  // focus: on the seed while it's visible, else ~0.6 ahead
  const fd = seed.visible ? cam.position.distanceTo(seed.position) : (t < 0.86 ? cam.position.distanceTo(sp) : 0.6);
  return { scene: S.scene, fx, exposure: 1.05, dof: { focus: fd, aperture: 0.012, maxblur: 0.012 } };
}

// ---------------- SHOT B1: the myth - the seed sprouts in the stomach ----------------
function resetPlant(S) {
  S.roots.forEach((r) => r.set(0)); S.stem.set(0); S.vines.forEach((v) => v.set(0));
  S.cots.forEach((c) => c.scale.setScalar(0.001)); S.leaves.forEach((l) => l.scale.setScalar(0.001)); S.vineLeaves.forEach((l) => l.scale.setScalar(0.001));
}
const camB1 = track([[3.3, [0.3, 1.7, 0.9]], [3.62, [0.5, 0.4, 1.6]], [4.1, [0.9, -1.55, 1.35]], [4.9, [-0.8, -1.45, 1.4]], [5.55, [-0.6, 0.4, 2.6]]]);
const lookB1 = track([[3.3, [0.2, -1.4, 0.4]], [3.62, [0.2, -1.9, 0.4]], [4.1, [0.2, -1.95, 0.4]], [4.9, [0.2, -1.7, 0.4]], [5.55, [0.15, -0.2, 0.3]]]);
function shotB1(t, cam) {
  const S = ST; const b = S.base;
  S.plant.visible = true; S.sprout.visible = false; S.acid.visible = false; S.acidBody.visible = false; S.bubbles.mesh.visible = false; S.splash.mesh.visible = false; S.ripple.visible = false;
  S.scene.fog = null; S.scene.background.set(0x5a1018);
  squeezeCavity(S, t, 0);
  // seed falls and lands
  const fall = seg(t, 3.3, 3.62, ease.in);
  const sp = V(b.x, lerp(1.9, b.y + 0.07, fall), b.z);
  if (t > 3.62) sp.y += 0.08 * Math.abs(Math.sin((t - 3.62) * 14)) * Math.exp(-(t - 3.62) * 9);
  S.seed.position.copy(sp); S.seed.rotation.set(Math.PI / 2 * fall + 0.2, t * (1 - fall) * 4, 0.3);
  const crack = seg(t, 4.12, 4.25); S.seed.position.x += 0.01 * Math.sin(t * 80) * crack * (1 - seg(t, 4.25, 4.4));
  S.seed.visible = true; S.shellGlow.material.opacity = 0;
  // growth
  resetPlant(S);
  S.roots.forEach((r, i) => r.set(seg(t, 4.15 + i * 0.03, 4.95 + i * 0.04, ease.out)));
  const sg = seg(t, 4.3, 5.5, ease.inOutSine); S.stem.set(sg);
  S.cots.forEach((c, i) => { const k = ease.outBack(seg(t, 4.55, 4.85, ease.linear)); const tip = S.stem.pointAt(Math.min(sg, 0.22));
    c.position.copy(tip); c.scale.setScalar(0.001 + 0.45 * k); c.rotation.set(0, i * Math.PI + 0.3, (i ? -1 : 1) * lerp(0.2, 1.05, k)); });
  S.leaves.forEach((l, i) => { const u = 0.32 + i * 0.12; const k = ease.outBack(seg(t, 4.75 + i * 0.12, 5.05 + i * 0.12, ease.linear));
    if (sg < u) { l.scale.setScalar(0.001); return; } l.position.copy(S.stem.pointAt(u)); l.scale.setScalar(0.001 + 0.75 * k * (1 - i * 0.06)); l.rotation.set(-0.5 - 0.4 * (1 - k), i * 2.3, (i % 2 ? 1 : -1) * 0.6); });
  S.vines.forEach((v, i) => v.set(seg(t, 4.85 + i * 0.08, 5.55, ease.out)));
  S.vineLeaves.forEach((l, i) => { const v = S.vines[i % 4]; const u = 0.15 + Math.floor(i / 4) * 0.22; const k = ease.outBack(seg(t, 5.0 + (i % 4) * 0.08 + Math.floor(i / 4) * 0.08, 5.3 + Math.floor(i / 4) * 0.08, ease.linear));
    if (v.g < u) { l.scale.setScalar(0.001); return; } l.position.copy(v.pointAt(u)); l.lookAt(0, l.position.y, 0); l.rotateX(-0.6); l.scale.setScalar(0.001 + 0.6 * k); });
  S.sparkles.update(t, V(b.x, b.y + 0.6 + sg * 1.2, b.z), 1.4, seg(t, 4.2, 4.6));
  // lights: warm "storybook" glow
  S.key.color.set(0xffd9a8); S.key.intensity = 18; S.key.position.set(0.6, 0.6, 1.0);
  S.hemi.intensity = 0.6; S.acidLight.intensity = 0; S.rim.intensity = 3; S.rim.position.set(b.x - 0.8, b.y + 0.8, b.z - 0.6);
  const pos = camB1(t), look = lookB1(t);
  aim(cam, pos, look, ktrack([[3.3, 70], [4.1, 52], [4.9, 50], [5.55, 62]])(t), ktrack([[3.3, 0.25], [4.1, 0], [4.9, -0.08], [5.55, 0]])(t));
  S.camLight.position.copy(pos).add(V(0, 0.3, 0)); S.camLight.intensity = 3;
  const fx = { flash: (1 - seg(t, 3.3, 3.4)) * 0.9, vignette: 0.35 };
  const focus = t < 4.9 ? cam.position.distanceTo(S.seed.position) : cam.position.distanceTo(S.stem.pointAt(sg));
  return { scene: S.scene, fx, exposure: 1.1, dof: { focus, aperture: 0.006, maxblur: 0.01 } };
}

// ---------------- REWIND ----------------
function shotRewind(t, cam) {
  const t0 = W(24), mid = 8.47;
  let r;
  if (t < mid) r = SHOTS[2].run(lerp(W(24) - 0.01, 5.56, inv(t0, mid, t)), cam);
  else r = shotB1(lerp(5.54, 3.95, inv(mid, 8.78, t)), cam);
  return { ...r, fx: { ...(r.fx || {}), flash: 0, rewind: 1 }, dof: { ...r.dof, aperture: 0 } };
}

// ---------------- SHOT C: reality - a pool of acid ----------------
const seedFallC = (t) => {
  const tDrop = W(30) + 0.02; // "drops"
  if (t < tDrop) return V(0.05, lerp(0.75, ACID_Y, ease.in(inv(8.78, tDrop, t))), 0.1);
  const k = seg(t, tDrop, tDrop + 1.4, ease.out);
  return V(0.05 + 0.05 * Math.sin(t * 1.3), lerp(ACID_Y - 0.05, -1.78, k) + 0.02 * Math.sin(t * 2.2), 0.1);
};
const camC = track([[8.78, [0.5, 1.2, 1.25]], [9.55, [0.6, 0.05, 1.1]], [10.1, [0.55, -1.45, 0.85]], [11.4, [0.6, -1.62, 0.55]], [12.4, [-0.55, -1.7, 0.45]], [13.35, [-0.45, -1.66, 0.62]], [14.6, [-0.32, -1.66, 0.55]], [15.62, [0.0, -1.7, 0.42]]]);
function underwater(S, cam) {
  const uw = cam.position.y < ACID_Y + waveH(cam.position);
  S.scene.fog = uw ? new THREE.FogExp2(0x9fbf12, 0.3) : null;
  S.scene.background.set(uw ? 0x8aa810 : 0x5a1018);
  return uw;
}
const waveH = () => 0;
function shotC(t, cam) {
  const S = ST;
  S.plant.visible = false; S.acid.visible = true; S.bubbles.mesh.visible = true; S.splash.mesh.visible = true; S.ripple.visible = true; S.seed.visible = true;
  squeezeCavity(S, t, 0);
  const tDrop = W(30) + 0.02;
  const sp = seedFallC(t); S.seed.position.copy(sp);
  { const settle = seg(t, 12.6, 13.6); S.seed.rotation.set(lerp(0.4 + t * 0.5, 0.35, settle), lerp(t * 0.7, 0.6, settle), lerp(0.2 + 0.3 * Math.sin(t), -0.25, settle)); }
  waveAcid(S, t, 0.025, { x: sp.x, z: sp.z, t: t - tDrop, a: 0.06 });
  S.splash.update(t - tDrop, V(sp.x, ACID_Y, sp.z), { speed: 1.4, gravity: 5 });
  S.ripple.position.set(sp.x, ACID_Y + 0.01, sp.z); { const k = inv(tDrop, tDrop + 0.9, t); S.ripple.scale.setScalar(0.05 + k * 1.2); S.ripple.material.opacity = t > tDrop ? 0.6 * (1 - k) : 0; }
  S.bubbles.update(t, V(0, 0, 0.1), 1.6, 1.4, -2.3, ACID_Y - 0.02, 1);
  // sprout attempt + wilt
  const sprOn = seg(t, W(48) - 0.05, W(48) + 0.4, ease.out), wilt = seg(t, W(50), W(50) + 0.5, ease.inOut);
  S.sprout.visible = sprOn > 0.001;
  S.seed.updateMatrixWorld(); S.sprout.position.copy(S.seed.localToWorld(V(0, 0.5, 0))); S.sprout.quaternion.copy(S.seed.quaternion);
  { const right = V(1, 0, 0).applyQuaternion(cam.quaternion); S.sprout.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(right, -wilt * 1.5)); }
  S.sproutStem.set(sprOn);
  S.sproutStem.mesh.material.color.setRGB(lerp(0.49, 0.45, wilt), lerp(0.76, 0.36, wilt), lerp(0.27, 0.12, wilt));
  S.sproutCots.forEach((c, i) => { const tip = S.sproutStem.pointAt(Math.max(0.01, sprOn)); c.position.copy(tip); c.scale.setScalar(0.001 + 0.3 * ease.outBack(seg(t, W(48) + 0.2, W(48) + 0.45, ease.linear)));
    c.rotation.set(0, i * Math.PI, (i ? -1 : 1) * lerp(1.0, 2.4, wilt)); c.material.color.setRGB(lerp(0.56, 0.48, wilt), lerp(0.82, 0.38, wilt), lerp(0.35, 0.12, wilt)); });
  // lights: acid glow
  S.key.color.set(0xffe8d0); S.key.intensity = 16; S.key.position.set(0.5, 1.9, 0.5); S.hemi.intensity = 0.5;
  S.acidLight.intensity = 6; S.rim.color.set(0xffffff); S.rim.intensity = 5; S.rim.position.copy(sp).add(V(-0.35, 0.35, -0.45));
  const pos = camC(t); const look = t < tDrop ? V(sp.x, lerp(sp.y, ACID_Y, 0.3), sp.z) : sp.clone().add(V(0, 0.02, 0));
  const fov = ktrack([[8.78, 58], [9.7, 52], [11.4, 46], [13.35, 42], [15.6, 40]])(t);
  aim(cam, pos, look, fov, 0.05 * Math.sin(t * 0.7));
  underwater(S, cam);
  S.camLight.position.copy(pos).add(V(0, 0.25, 0)); S.camLight.intensity = 2.2;
  const telops = [
    { text: 'pH 1.5', x: 540, y: 470, t0: W(35), size: 170, sub: 'STOMACH ACID' },
    { text: 'NEEDS 3+ DAYS', x: 540, y: 470, t0: W(41), size: 108, sub: 'TO SPROUT', color: '#ffffff' },
  ];
  telops[0].t1 = W(41) - 0.05;
  telops[1].t1 = W(48);
  return { scene: S.scene, fx: { vignette: 0.32 }, exposure: 1.05, telops, dof: { focus: cam.position.distanceTo(sp), aperture: 0.007, maxblur: 0.01 } };
}

// ---------------- SHOT D1/D2: tough shell -> stomach squeezes ----------------
const camD = track([[W(51), [0.0, -1.7, 0.42]], [16.3, [0.32, -1.72, 0.05]], [17.0, [0.25, -1.66, -0.3]], [17.9, [1.2, -0.6, 1.8]], [18.7, [0.4, -0.9, -1.6]]]);
function shotD12(t, cam) {
  const S = ST;
  S.plant.visible = false; S.sprout.visible = false; S.acid.visible = true; S.bubbles.mesh.visible = true; S.splash.mesh.visible = false; S.ripple.visible = false;
  const squeeze = seg(t, 17.0, 17.6) * (0.6 + 0.4 * Math.sin((t - 17) * 5) ** 2);
  squeezeCavity(S, t, squeeze);
  const tumble = seg(t, 17.0, 18.7, ease.in);
  const sp = V(0.05 + 0.6 * tumble * Math.sin(t * 2), -1.78 + 0.3 * tumble + 0.02 * Math.sin(t * 2.2), 0.1 - 1.6 * tumble);
  S.seed.position.copy(sp); S.seed.rotation.set(0.4 + t * (0.5 + 3 * tumble), t * 0.7, 0.2);
  waveAcid(S, t, 0.025 + 0.09 * squeeze);
  S.bubbles.update(t, V(0, 0, 0.1), 1.6, 1.4, -2.3, ACID_Y - 0.02, 1);
  // shell highlight pulse
  const hl = seg(t, W(53), W(54)) * (1 - seg(t, 17.1, 17.4));
  S.shellGlow.position.copy(sp); S.shellGlow.scale.setScalar(0.5 + 0.1 * Math.sin(t * 12)); S.shellGlow.material.opacity = 0.55 * hl;
  S.rim.intensity = 2.5 + 6 * hl; S.rim.position.copy(sp).add(V(-0.3, 0.25, -0.35));
  S.acidLight.intensity = 10; S.key.intensity = 16;
  const pos = camD(t); const look = t < 17.9 ? sp.clone() : V(0.2, -1.1, -2.6);
  aim(cam, pos, look, ktrack([[W(51), 36], [17.0, 40], [17.9, 62], [18.7, 70]])(t), 0.04 * Math.sin(t));
  underwater(S, cam);
  S.camLight.position.copy(pos).add(V(0, 0.25, 0));
  const telops = [{ text: 'TOUGH SHELL', x: 540, y: 470, t0: W(53), t1: W(55), size: 104, pill: '#f2f2f2', color: '#111' }];
  return { scene: S.scene, fx: { vignette: 0.32, flash: seg(t, 18.55, 18.7, ease.in) * 0.8 }, exposure: 1.05, telops, dof: { focus: cam.position.distanceTo(sp), aperture: t < 17.6 ? 0.008 : 0.003, maxblur: 0.01 } };
}

// ---------------- SHOT B2: the vine bursts out of the belly button ----------------
const camB2 = track([[5.55, [0.12, 0.06, 1.05]], [W(18), [0.16, 0.08, 1.0]], [6.45, [0.7, 0.35, 2.7]], [7.25, [-1.3, 0.55, 3.0]], [W(24), [-1.05, 0.7, 2.75]]]);
const lookB2 = track([[5.55, [0, 0.03, 0.6]], [W(18), [0, 0.04, 0.6]], [6.45, [0.0, 0.35, 0.9]], [7.25, [0.0, 0.5, 1.0]], [W(24), [0.15, 0.35, 1.1]]]);
function shotB2(t, cam) {
  const S = BE; const tb = W(18);
  const push = seg(t, 5.7, tb, ease.in) * (1 - seg(t, tb, tb + 0.15));
  S.bulge.scale.set(1 + push * 0.3, 0.001 + push * 0.6 + 0.05 * Math.sin(t * 40) * push, 1 + push * 0.3);
  const g = t < tb ? 0 : ease.outBack(seg(t, tb, tb + 0.35, ease.linear)) * 0.3 + 0.7 * seg(t, tb + 0.3, 7.3, ease.inOutSine);
  S.vine.set(g);
  S.branch.set(seg(t, 6.9, 7.3, ease.out));
  const us = [0.22, 0.36, 0.48, 0.6, 0.72, 0.83, 0.93];
  S.leaves.forEach((l, i) => { const u = us[i]; if (g < u) { l.scale.setScalar(0.001); return; }
    const k = ease.outBack(seg(t, tb + 0.15 + i * 0.16, tb + 0.45 + i * 0.16, ease.linear));
    l.position.copy(S.vine.pointAt(u)); l.rotation.set(-0.7 + 0.3 * Math.sin(i * 2), i * 2.4 + 0.5, (i % 2 ? 1 : -1) * 0.9); l.scale.setScalar(0.001 + 0.42 * k * (1 - 0.05 * i)); });
  S.tendrils.forEach((td, i) => td.set(seg(t, tb + 0.4 + i * 0.25, tb + 1.1 + i * 0.25, ease.out)));
  const mk = t < 7.2 ? 0 : ease.outElastic(seg(t, 7.2, W(23) + 0.15, ease.linear));
  S.melon.position.copy(S.branch.pointAt(1)).add(V(0.02, -0.16 * mk, 0)); S.melon.scale.setScalar(0.001 + 0.36 * mk); S.melon.rotation.set(0.3, t * 0.6, 0.2);
  S.sparkles.update(t, S.melon.position, 0.4, seg(t, W(23) - 0.1, W(23) + 0.2) * (1 - seg(t, 7.9, 8.1)));
  const pos = camB2(t).add(shake(t, 0.01 * seg(t, tb, tb + 0.05) * (1 - seg(t, tb + 0.05, tb + 0.3))));
  aim(cam, pos, lookB2(t), ktrack([[5.55, 34], [tb, 32], [6.45, 46], [8.1, 44]])(t), ktrack([[5.55, 0], [6.45, -0.06], [7.25, 0.05]])(t));
  const focus = t < tb + 0.3 ? cam.position.distanceTo(S.navel) : cam.position.distanceTo(S.vine.pointAt(Math.min(g, 0.7)));
  return { scene: S.scene, fx: { vignette: 0.28 }, exposure: 1.0, dof: { focus, aperture: 0.004, maxblur: 0.01 } };
}

// ---------------- SHOT D3: X-ray - squeezed into the intestines ----------------
function shotD3(t, cam) {
  const S = XR; const t0 = W(61), t1 = W(66);
  // seed path: stomach -> duodenum -> small intestine
  let p;
  const k1 = seg(t, t0, W(63), ease.inOut);       // through the stomach to the exit
  if (t < W(63)) p = S.stC.getPointAt(lerp(0.45, 1.0, k1));
  else p = S.small.getPointAt(lerp(0.0, 0.22, seg(t, W(63), t1 + 0.2, ease.inOutSine)));
  S.seed.position.copy(p); S.seed.rotation.set(t * 2, t * 3, 0);
  S.ring.position.copy(p); S.halo.position.copy(p);
  S.ring.scale.setScalar(1 + 0.15 * Math.sin(t * 10)); S.ring.lookAt(cam.position);
  S.body.rotation.y = -0.25 + 0.15 * seg(t, t0, t1);
  const camPos = track([[t0, [0.35, 0.25, 3.9]], [W(63), [0.2, 0.05, 2.6]], [t1, [p.x + 0.3, p.y + 0.15, 1.6]]])(t);
  const look = track([[t0, [0.0, 0.1, 0]], [W(63), [0.05, 0.1, 0.05]], [t1, [p.x, p.y, p.z]]])(t);
  aim(cam, camPos, look, 50, 0.04);
  return { scene: S.scene, fx: { vignette: 0.25, flash: (1 - seg(t, t0, t0 + 0.12)) * 0.8 }, exposure: 1.0 };
}

// ---------------- SHOT D4/D5: sliding along, days pass ----------------
function shotD45(t, cam) {
  const S = GU; const t0 = W(66), tDays = W(73), t1 = W(79);
  // seed progress: steady, then time-lapse speed-up during "a few days later"
  const u = 0.04 + 0.22 * inv(t0, tDays, t) + 0.6 * ease.inOut(inv(tDays, t1, t));
  const c = S.curve.getPointAt(u), tan = S.curve.getTangentAt(u);
  const side = V(0, 1, 0).cross(tan).normalize(), up = tan.clone().cross(side).normalize();
  const sp = c.clone().addScaledVector(up, -0.05);
  S.seed.position.copy(sp); S.seed.quaternion.setFromUnitVectors(V(0, 1, 0), tan); S.seed.rotateY(t * 2);
  S.halo.position.copy(sp); S.ring.position.copy(sp); S.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 10));
  // food bits drift along with slight differences in speed
  for (const f of S.food) { const fu = (f.u0 + (u - 0.04) * 0.9 + 0.0) % 1; const fc = S.curve.getPointAt(fu), ft = S.curve.getTangentAt(fu);
    const fs = V(0, 1, 0).cross(ft).normalize(), fup = ft.clone().cross(fs).normalize();
    f.m.position.copy(fc).addScaledVector(fs, f.ox * S.R).addScaledVector(fup, f.oy * S.R); f.m.rotation.set(t * f.spin, t, 0);
    f.m.visible = Math.abs(fu - u) > 0.006 || Math.hypot(f.ox, f.oy) > 0.25; }
  // camera alongside, outside the translucent wall, swinging around
  const lapse = seg(t, tDays, tDays + 0.3) * (1 - seg(t, t1 - 0.35, t1));
  const ang = 0.6 + 0.9 * inv(t0, t1, t) + 2.5 * ease.inOut(inv(tDays, t1, t));
  const dist = 1.35 + 0.5 * lapse;
  const pos = sp.clone().addScaledVector(side, Math.cos(ang) * dist).addScaledVector(up, Math.sin(ang) * dist).addScaledVector(tan, -0.25);
  aim(cam, pos, sp.clone().addScaledVector(tan, 0.15), 44 + 10 * lapse, 0.1 * Math.sin(t));
  S.ring.lookAt(cam.position);
  S.camLight.position.copy(pos);
  const telops = [];
  if (t >= tDays) {
    const d = 1 + Math.min(2, Math.floor(3 * inv(tDays + 0.15, t1 - 0.3, t)));
    telops.push({ text: `DAY 1 → DAY ${d}`, x: 540, y: 460, t0: tDays, size: 118, color: '#ffe03a', sub: d === 3 ? 'STILL IN ONE PIECE' : '' });
  }
  return { scene: S.scene, fx: { vignette: 0.25, flash: (1 - seg(t, t0, t0 + 0.1)) * 0.6 }, exposure: 1.0, telops, dof: { focus: cam.position.distanceTo(sp), aperture: 0.004, maxblur: 0.008 } };
}

// ---------------- SHOT D6: out it comes - exactly the way it went in ----------------
function shotD6(t, cam) {
  const S = TO; const t0 = W(79), tHit = t0 + 0.42, t1 = W(88);
  let sp;
  if (t < tHit) sp = V(0.1, lerp(1.6, WATER_Y, ease.in(inv(t0, tHit, t))), 0.0);
  else sp = V(0.1 + 0.03 * Math.sin(t), lerp(WATER_Y - 0.05, -0.75, seg(t, tHit, tHit + 1.6, ease.out)) + 0.015 * Math.sin(t * 2), 0.0);
  S.seed.position.copy(sp); S.seed.rotation.set(0.4 + 0.3 * t, 0.6 * t, 0.2);
  waveWater(S, t, { x: sp.x, z: sp.z, t: t - tHit });
  S.splash.update(t - tHit, V(sp.x, WATER_Y, sp.z), { speed: 1.3, gravity: 5 });
  S.ripple.position.set(sp.x, WATER_Y + 0.01, sp.z); { const k = inv(tHit, tHit + 0.9, t); S.ripple.scale.setScalar(0.05 + k); S.ripple.material.opacity = t > tHit ? 0.7 * (1 - k) : 0; }
  S.bubbles.update(t, V(sp.x, 0, sp.z), 0.25, 0.25, -0.9, -0.02, t > tHit ? 1 - seg(t, tHit + 0.5, tHit + 2) * 0.8 : 0);
  const ding = seg(t, W(82), W(82) + 0.25) * (1 - seg(t, W(84), W(85)));
  const ding2 = seg(t, W(86), W(86) + 0.2);
  S.sparkles.update(t, sp, 0.25, Math.max(ding, ding2));
  S.rimL.position.copy(sp).add(V(-0.3, 0.3, -0.3)); S.rimL.intensity = 2 + 6 * Math.max(ding, ding2);
  const pos = track([[t0, [0.3, 2.7, 2.3]], [tHit, [0.2, 0.95, 0.6]], [tHit + 0.5, [0.3, -0.3, 0.62]], [W(82), [0.32, -0.55, 0.5]], [t1, [-0.22, -0.66, 0.42]]])(t);
  const look = t < tHit ? V(sp.x, lerp(sp.y, WATER_Y, 0.6), sp.z) : sp;
  aim(cam, pos, look, ktrack([[t0, 55], [tHit, 46], [W(82), 36], [t1, 34]])(t), 0.03);
  const uw = cam.position.y < WATER_Y;
  S.scene.fog = uw ? new THREE.FogExp2(0x1f86a8, 0.9) : null; S.scene.background.set(uw ? 0x1f6f90 : 0x9fb0b8);
  const telops = [{ text: '100% INTACT', x: 540, y: 470, t0: W(82), size: 104, pill: '#ffffff', color: '#111' }];
  return { scene: S.scene, fx: { vignette: 0.3, flash: (1 - seg(t, t0, t0 + 0.1)) * 0.6, tint: uw ? 'rgba(10,110,150,0.16)' : null }, exposure: 1.0, telops, dof: { focus: cam.position.distanceTo(sp), aperture: 0.006, maxblur: 0.01 } };
}

// ---------------- SHOT E: chew it -> it cracks -> nutrients -> loop back to the first frame ----------------
const molarSeat = V(0.36, -0.13, -0.34);
function shotE(t, cam) {
  const S = M; const t0 = W(88), tChew = W(96), tPlate = W(105);
  const end = END;
  S.tunnel.update(() => 1);
  S.chunk.visible = false; S.seed.visible = false; JUICE.mesh.visible = false;
  // jaw: slowly closing before the crunch, snap at "chewed", reopen
  const pre = seg(t, 28.2, tChew - 0.05, ease.in), snap = seg(t, tChew - 0.06, tChew, ease.in), open = seg(t, tChew + 0.12, tChew + 0.6);
  const close = Math.max(0.55 * pre, snap) * (1 - open);
  S.lower.position.y = -0.2 + 0.31 * close; S.lower.rotation.x = -0.05 * (1 - close); S.upper.position.y = 0.16 - 0.06 * close;
  // split seed sitting on the molar
  const G = SPLIT.group; G.visible = t < tPlate + 0.2;
  G.position.copy(molarSeat).add(V(0, 0.0 + 0.31 * close * 0.0, 0)); G.rotation.set(Math.PI / 2 - 0.2, 0.5, 0.15);
  const crack = seg(t, tChew, tChew + 0.35, ease.outBack);
  SPLIT.halves[0].position.set(0, 0, 0.18 * crack); SPLIT.halves[0].rotation.set(0.0, 0.7 * crack, 0.15 * crack);
  SPLIT.halves[1].position.set(0, 0, -0.16 * crack); SPLIT.halves[1].rotation.set(0.0, -0.6 * crack, -0.1 * crack);
  SPLIT.kernel.scale.setScalar(t < tChew ? 0.001 : 1);
  const glowK = seg(t, tChew + 0.3, W(100)) * (1 - seg(t, tPlate, tPlate + 0.4));
  SPLIT.kernel.material.emissiveIntensity = 0.9 * glowK;
  SPLIT.kernel.position.y = 0.25 * seg(t, tChew + 0.2, W(101), ease.out);
  G.updateMatrixWorld(); const kp = SPLIT.kernel.getWorldPosition(V(0, 0, 0));
  KGLOW.position.copy(kp); KGLOW.scale.setScalar(0.35 + 0.05 * Math.sin(t * 8)); KGLOW.material.opacity = 0.7 * glowK;
  KSPARK.group.visible = true; KSPARK.update(t, kp, 0.18, glowK);
  CRUMBS.mesh.visible = t > tChew && t < tChew + 0.8; CRUMBS.update(t - tChew, molarSeat.clone().add(V(0, 0.03, 0)), { speed: 0.9, gravity: 3 });
  // slice comes back for the loop
  const loopK = inv(tPlate, end, t);
  S.slice.visible = t > tPlate - 0.3;
  { const bs = S.slice.userData.seeds[9]; bs.visible = true; const local = bs.position.clone().multiplyScalar(S.slice.scale.x).applyQuaternion(sliceQ);
    S.slice.quaternion.copy(sliceQ);
    const p0 = seedPathA(0), v = seedPathA(0.05).sub(p0).divideScalar(0.05); // match frame 0 motion
    const tau = t - end; // <= 0
    const far = V(0.9, -0.6, 2.4).multiplyScalar(Math.pow(1 - ease.out(loopK), 2));
    S.slice.position.copy(p0.clone().addScaledVector(v, tau).add(far).sub(local)); }
  // camera: molars -> pull back and turn to face out of the mouth -> exact first-frame pose
  const mPos = track([[t0, [0.18, 0.02, -0.75]], [28.3, [0.25, -0.02, -0.62]], [tChew, [0.27, -0.03, -0.6]], [W(100), [0.12, 0.05, -0.68]], [tPlate, [0.2, 0.06, -0.72]]])(Math.min(t, tPlate));
  const mLook = track([[t0, [0.36, -0.15, -0.3]], [tChew, [0.36, -0.14, -0.32]], [W(100), [kp.x, kp.y, kp.z]], [tPlate, [kp.x, kp.y, kp.z]]])(Math.min(t, tPlate));
  const tFace = Math.min(end - 0.45, tPlate + 0.75);
  const k = seg(t, tPlate, tFace, ease.inOut);
  const pos = mPos.clone().lerp(camPosA(0), k), look = mLook.clone().lerp(camLookA(0), k);
  pos.add(shake(t, 0.008 * seg(t, tChew, tChew + 0.03) * (1 - seg(t, tChew + 0.03, tChew + 0.25))));
  const fov = lerp(ktrack([[t0, 52], [tChew, 46], [W(100), 50], [tPlate, 52]])(Math.min(t, tPlate)), 58, k);
  aim(cam, pos, look, fov, lerp(0.05 * Math.sin(t), 0, k));
  S.camLight.position.copy(pos).add(cam.getWorldDirection(V(0, 0, 0)).multiplyScalar(-0.35)).add(V(0, 0.08, 0));
  S.fill.position.set(0, 0.15, -0.9);
  const telops = [
    { text: 'PROTEIN', x: 540, y: 380, t0: W(100), size: 96, pill: '#36c26a', color: '#fff' },
    { text: 'MAGNESIUM', x: 540, y: 520, t0: W(104), size: 96, pill: '#2f8fe0', color: '#fff' },
    { text: 'ZINC', x: 540, y: 660, t0: W(105), size: 96, pill: '#ff8a1f', color: '#fff' },
  ].map((x) => ({ ...x, t1: tPlate + 0.35 }));
  const fdist = t < tPlate ? cam.position.distanceTo(kp) : lerp(cam.position.distanceTo(kp), cam.position.distanceTo(seedPathA(0)), k);
  const cta = t >= end - 1.0 ? end - 1.0 : null;
  return { scene: S.scene, fx: { vignette: 0.3 }, exposure: 1.05, telops, cta, hideCaptions: t >= end - 1.0, dof: { focus: fdist, aperture: 0.012, maxblur: 0.012 } };
}
