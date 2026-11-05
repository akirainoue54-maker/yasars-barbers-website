import * as THREE from 'three';
import { clamp, lerp, inv, smooth, rng, canvasTex, V, ease, seg } from './lib.js';
import { Bubbles, Droplets, bubbleMaterial, glow, Sparkles } from './fx.js';
import { makeTooth } from './tooth.js';

// Glass geometry (table at y = 0)
export const GH = 2.6, BASE = 0.2, LEVEL = 2.05, SURF = BASE + LEVEL;
const R_BOT = 0.84, R_TOP = 1.0;
const rAt = (y) => lerp(R_BOT, R_TOP, clamp(y / GH));

// Fresnel glass: clear centre, bright edges, two soft window highlights
export function glassMat(alpha = 0.05) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { a: { value: alpha } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float a; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 n = normalize(vN); float f = pow(1.0-abs(dot(n,normalize(vV))), 2.4);
        float s1 = pow(max(dot(n, normalize(vec3(-0.55,0.15,0.82))),0.0), 38.0);
        float s2 = pow(max(dot(n, normalize(vec3(0.7,0.2,0.68))),0.0), 60.0);
        vec3 c = mix(vec3(0.9,0.97,1.0), vec3(1.0), f);
        gl_FragColor = vec4(c, clamp(a + 0.55*f + 0.8*s1 + 0.5*s2, 0.0, 1.0)); }`,
  });
}

// Cola: amber body, darker at the bottom, glowing edges (backlit look)
export function colaMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { aK: { value: 1.0 }, top: { value: new THREE.Color(0.30, 0.095, 0.014) }, bot: { value: new THREE.Color(0.075, 0.02, 0.004) }, glowK: { value: 1.0 }, y0: { value: BASE }, y1: { value: SURF } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vY = position.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float aK; uniform vec3 top; uniform vec3 bot; uniform float glowK; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float h = clamp((vY + 1.0)/2.0, 0.0, 1.0);
        float f = pow(1.0-abs(dot(normalize(vN),normalize(vV))), 1.6);
        vec3 c = mix(bot, top, h*0.85+0.15) + vec3(1.0,0.5,0.12)*f*0.65*glowK;
        gl_FragColor = vec4(c, clamp(0.72 + 0.2*f, 0.0, 0.94) * aK); }`,
  });
}

// Soft backlit backdrop: warm glow + bokeh discs
function backdropTex(night = false) {
  return canvasTex(1024, 1800, (g, w, h) => {
    const bg = g.createRadialGradient(w / 2, h * 0.42, 40, w / 2, h * 0.45, h * 0.8);
    if (night) { bg.addColorStop(0, '#2b4d9a'); bg.addColorStop(0.55, '#14224f'); bg.addColorStop(1, '#070b1c'); }
    else { bg.addColorStop(0, '#e8892a'); bg.addColorStop(0.28, '#a8520c'); bg.addColorStop(0.6, '#4a2004'); bg.addColorStop(1, '#100602'); }
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const r = rng(night ? 5 : 7);
    for (let i = 0; i < (night ? 70 : 26); i++) {
      const x = r() * w, y = r() * h * 0.8, s = night ? 2 + r() * 5 : 24 + r() * 80;
      const b = g.createRadialGradient(x, y, 0, x, y, s);
      b.addColorStop(0, night ? 'rgba(255,255,255,0.95)' : 'rgba(255,250,225,0.55)'); b.addColorStop(night ? 0.5 : 0.85, night ? 'rgba(200,220,255,0.35)' : 'rgba(255,240,200,0.3)'); b.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = b; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
    }
  });
}

function clockFaceTex() {
  return canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#fbf6ea'; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, 7); g.fill();
    g.strokeStyle = '#2a2a2a'; g.lineCap = 'round';
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, big = i % 5 === 0; g.lineWidth = big ? 12 : 4; g.beginPath();
      g.moveTo(w / 2 + Math.sin(a) * (w * 0.46), w / 2 - Math.cos(a) * (w * 0.46)); g.lineTo(w / 2 + Math.sin(a) * (w * (big ? 0.38 : 0.42)), w / 2 - Math.cos(a) * (w * (big ? 0.38 : 0.42))); g.stroke(); }
    g.fillStyle = '#2a2a2a'; g.font = '900 64px Montserrat'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [n, a] of [[12, 0], [3, 90], [6, 180], [9, 270]]) { const r = a * Math.PI / 180; g.fillText(String(n), w / 2 + Math.sin(r) * w * 0.3, w / 2 - Math.cos(r) * w * 0.3 + 4); }
  });
}

export function buildCola(env) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0a050);
  // backdrop day + night layers (cross-faded for the "overnight" time-lapse)
  const dayMat = new THREE.MeshBasicMaterial({ map: backdropTex(false), toneMapped: false, color: 0xd0d0d0 });
  const nightMat = new THREE.MeshBasicMaterial({ map: backdropTex(true), toneMapped: false, transparent: true, opacity: 0 });
  const dayPlane = new THREE.Mesh(new THREE.PlaneGeometry(16, 28), dayMat); dayPlane.position.set(0, 3.2, -5.5);
  const nightPlane = new THREE.Mesh(new THREE.PlaneGeometry(16, 28), nightMat); nightPlane.position.set(0, 3.2, -5.45);
  scene.add(dayPlane, nightPlane);
  const moon = glow('#e9f1ff', 1.5); moon.position.set(1.2, 4.6, -5.3); moon.material.opacity = 0; scene.add(moon);
  const sun = glow('#fff0b0', 3.2); sun.position.set(-1.2, 1.2, -5.3); scene.add(sun);
  // table
  const table = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.5, metalness: 0, envMapIntensity: 0.5 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
  // clock on the wall (behind and above the glass)
  const clock = new THREE.Group(); clock.position.set(0, 4.55, -2.2); scene.add(clock);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.0, 64), new THREE.MeshBasicMaterial({ map: clockFaceTex(), toneMapped: false })); clock.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.07, 16, 96), new THREE.MeshPhysicalMaterial({ color: 0x2b2b30, roughness: 0.3, clearcoat: 1 })); rim.position.z = 0.02; clock.add(rim);
  const handMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, toneMapped: false });
  const hourPivot = new THREE.Group(), minPivot = new THREE.Group(); clock.add(hourPivot, minPivot);
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.02), handMat); hourHand.position.y = 0.2; hourPivot.add(hourHand);
  const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.78, 0.02), handMat); minHand.position.y = 0.32; minPivot.add(minHand);
  hourPivot.position.z = minPivot.position.z = 0.03;
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), handMat); hub.position.z = 0.045; clock.add(hub);
  clock.visible = false;

  // glass + cola
  const glass = new THREE.Group(); scene.add(glass);
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R_TOP, R_BOT, GH, 72, 1, true), glassMat(0.045)); outer.position.y = GH / 2; glass.add(outer);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(R_TOP - 0.06, R_BOT - 0.06, GH - BASE, 72, 1, true), glassMat(0.02)); inner.position.y = BASE + (GH - BASE) / 2; glass.add(inner);
  const baseM = new THREE.Mesh(new THREE.CylinderGeometry(R_BOT, R_BOT, BASE, 72, 1, false), glassMat(0.12)); baseM.position.y = BASE / 2; glass.add(baseM);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R_TOP - 0.03, 0.035, 12, 96), glassMat(0.1)); lip.rotation.x = Math.PI / 2; lip.position.y = GH; glass.add(lip);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(R_TOP - 0.065, R_BOT - 0.065, LEVEL, 72, 1, true), colaMat()); liquid.position.y = BASE + LEVEL / 2; liquid.renderOrder = 1; glass.add(liquid);
  const surf = new THREE.Mesh(new THREE.CircleGeometry(R_TOP - 0.065, 72), new THREE.MeshBasicMaterial({ color: 0xc8631a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  surf.rotation.x = -Math.PI / 2; surf.position.y = SURF; surf.renderOrder = 2; glass.add(surf);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R_BOT - 0.07, 72), new THREE.MeshBasicMaterial({ color: 0x5a1c06, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = BASE + 0.005; glass.add(floor);

  // foam: beige base + many fresnel bubbles
  const foamBase = new THREE.Mesh(new THREE.CircleGeometry(R_TOP - 0.07, 72), new THREE.MeshStandardMaterial({ color: 0xf0d6ae, roughness: 0.85, transparent: true, opacity: 0.88, side: THREE.FrontSide }));
  foamBase.rotation.x = -Math.PI / 2; foamBase.position.y = SURF + 0.012; foamBase.renderOrder = 3; glass.add(foamBase);
  const NF = 900; const fr = rng(91);
  const foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), bubbleMaterial(0xfff1d8), NF); foam.frustumCulled = false; foam.renderOrder = 4; glass.add(foam);
  const foamData = [...Array(NF)].map(() => { const a = fr() * Math.PI * 2, d = Math.sqrt(fr()) * (R_TOP - 0.1); return { x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.02 + Math.pow(fr(), 2) * 0.05, y: SURF + 0.02 + fr() * 0.07, ph: fr() * 6 }; });
  const dm = new THREE.Object3D();

  // rising fizz
  const fizz = new Bubbles(320, { size: 0.026, seed: 17, color: 0xfff0d0 }); glass.add(fizz.mesh);
  // splash droplets (foam + cola), emitted at the tooth impact
  const splash = new Droplets(110, new THREE.MeshPhysicalMaterial({ color: 0xc8691a, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85, emissive: 0x5a2000, emissiveIntensity: 0.7 }), { size: 0.014, seed: 23 }); glass.add(splash.mesh);
  const foamSpray = new Droplets(70, new THREE.MeshPhysicalMaterial({ color: 0xfff0d8, roughness: 0.4, transparent: true, opacity: 0.9 }), { size: 0.02, seed: 29 }); glass.add(foamSpray.mesh);

  // tooth (+ bubbles that nucleate on its surface)
  const tooth = makeTooth(); scene.add(tooth);
  const NB = 70; const tb = rng(55);
  const toothBubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), bubbleMaterial(0xfff4e0), NB); toothBubbles.frustumCulled = false; toothBubbles.renderOrder = 5; scene.add(toothBubbles);
  const crownPos = tooth.userData.crown.geometry.attributes.position; const rootPos = tooth.children[1].geometry.attributes.position;
  const tbData = [...Array(NB)].map((_, i) => { const useCrown = i % 3 !== 0; const pa = useCrown ? crownPos : rootPos; const k = Math.floor(tb() * pa.count); return { p: V(pa.getX(k), pa.getY(k), pa.getZ(k)), ph: tb(), s: 0.012 + tb() * 0.022 }; });

  // lights: warm key, strong rim from behind (cola glows), soft fill
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0xc88a50, 0.45));
  const key = new THREE.DirectionalLight(0xfff0e0, 1.7); key.position.set(-3, 5, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: 1, far: 16 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key);
  const rimL = new THREE.PointLight(0xffb060, 18, 14, 1.4); rimL.position.set(0.3, 2.3, -3.2); scene.add(rimL);
  const fill = new THREE.PointLight(0xffe0c0, 3, 9, 1.6); fill.position.set(2.5, 2, 3.5); scene.add(fill);

  const fog = new THREE.FogExp2(0x7a3208, 1.05);
  const pop = new Sparkles(22, '#ffe2a0', { seed: 77, size: 0.14, star: true }); scene.add(pop.group);
  const S = { pop, fog, scene, glass, outer, inner, liquid, surf, foam, foamData, foamBase, fizz, splash, foamSpray, tooth, toothBubbles, tbData, key, rimL, fill, clock, hourPivot, minPivot, dayMat, nightMat, moon, sun, table, dayPlane, nightPlane, dm };
  scene.environment = env; scene.environmentIntensity = 0.35;
  return S;
}

// tooth path: free fall above the foam for t<0 (loop), enters at t=0, sinks with drag to the bottom
export const TS = 0.36; // tooth scale
const ENTER = V(0.04, SURF + 0.15, 0.0);
export function toothPose(t) {
  // t: seconds relative to the moment the tooth touches the foam
  let y;
  if (t < 0) y = ENTER.y + (-t) * 1.25 + 0.5 * 5.0 * t * t;
  else {
    const dep = 0.42 * t + (0.7 / 3.2) * (1 - Math.exp(-3.2 * t));
    y = ENTER.y - Math.min(dep, SURF - BASE - 0.22);
  }
  const pos = V(ENTER.x + 0.05 * Math.sin(t * 1.3) * (t > 0 ? 1 : 0) + 0.12 * Math.sin(t * 0.7), y, ENTER.z + 0.04 * Math.cos(t * 1.1));
  // starts roots-up (it falls crown-first), tumbles upright while spinning, then lies on its side at the bottom
  const flip = smooth(clamp(t / 2.4)); const tr = Math.min(t, 3.4);
  let rot = V(0.16 + 0.12 * Math.sin(tr * 1.1), 0.3 + 0.9 * tr, 2.75 - 2.5 * flip + 0.12 * Math.cos(tr * 0.8));
  const lie = smooth(clamp((t - 2.5) / 0.8));
  rot = rot.lerp(V(0.1, 0.9 + 0.9 * 2.5, 1.45), lie);
  return { pos, rot };
}

// settle the whole glass scene for time tRel (tooth contact at 0) and optional extras
export function colaUpdate(S, t, o = {}) {
  const { camPos = null, melt = 0, wear = 0, toothT = t, fizzK = null, toothVisible = true, bottomRest = null } = o;
  const P = toothPose(toothT);
  const tooth = S.tooth;
  tooth.visible = toothVisible && melt < 0.995;
  tooth.position.copy(P.pos); tooth.rotation.set(P.rot.x, P.rot.y, P.rot.z);
  if (bottomRest) { tooth.position.y = Math.max(tooth.position.y, BASE + bottomRest.h); }
  // melt: squash, spread, shrink (comic dissolve)
  const m = clamp(melt); const sc = Math.pow(1 - m, 0.9);
  tooth.scale.set(TS * sc * (1 + 0.25 * m), TS * sc * (1 - 0.35 * m), TS * sc * (1 + 0.25 * m));
  tooth.userData.setWear(wear);
  tooth.updateMatrixWorld(true);
  const inLiq = P.pos.y < SURF;
  const dt = toothT; // time since contact
  // foam: pushed aside by the tooth on contact
  const dm = S.dm; const push = dt > 0 ? Math.exp(-dt * 1.6) : 0; const hole = dt > 0 ? smooth(clamp(dt / 0.25)) * (1 - smooth(clamp((dt - 1.2) / 1.6))) : 0;
  for (let i = 0; i < S.foamData.length; i++) {
    const f = S.foamData[i]; const dx = f.x - P.pos.x, dz = f.z - P.pos.z; const d = Math.hypot(dx, dz) + 1e-4;
    const away = push * 0.32 * Math.exp(-d * 3.2); const nx = f.x + dx / d * away, nz = f.z + dz / d * away;
    let s = f.s * (1 + 0.15 * Math.sin(t * 2 + f.ph)); s *= 1 - hole * smooth(clamp((0.34 - d) / 0.2));
    dm.position.set(nx, f.y + 0.02 * Math.sin(t * 3 + f.ph), nz); dm.scale.setScalar(Math.max(0.0001, s)); dm.updateMatrix(); S.foam.setMatrixAt(i, dm.matrix);
  }
  S.foam.instanceMatrix.needsUpdate = true;
  // splash at contact
  const st = t < 0 ? -1 : dt; const sp = V(P.pos.x, SURF + 0.03, P.pos.z);
  S.splash.update(st, sp, { speed: 1.35, gravity: 5.2 }); S.foamSpray.update(st, sp, { speed: 1.0, gravity: 4.0 });
  S.splash.mesh.visible = S.foamSpray.mesh.visible = st >= 0 && st < 1.2;
  // fizz
  const dens = fizzK ?? (0.45 + 0.55 * smooth(clamp(dt / 0.7)));
  S.fizz.update(t, V(0, 0, 0), 0.78, 0.78, BASE + 0.12, SURF - 0.04, dens, camPos);
  // bubbles nucleating on the tooth
  const dum = S.dm; const up = V(0, 1, 0);
  for (let i = 0; i < S.tbData.length; i++) {
    const b = S.tbData[i]; const k = ((dt * 0.55 + b.ph) % 1 + 1) % 1; const wp = tooth.children[i % 3 === 0 ? 1 : 0].localToWorld(b.p.clone());
    const grow = smooth(clamp(k / 0.8)), det = clamp((k - 0.8) / 0.2);
    wp.y += det * det * 0.7; const on = (inLiq && wp.y < SURF - 0.02 && dt > 0.05 && tooth.visible) ? 1 : 0;
    let near = 1; if (camPos) near = clamp((wp.distanceTo(camPos) - 0.25) / 0.3);
    dum.position.copy(wp); dum.scale.setScalar(Math.max(0.0001, b.s * grow * (1 - det * 0.6) * on * near * (1 - m))); dum.updateMatrix(); S.toothBubbles.setMatrixAt(i, dum.matrix);
  }
  S.toothBubbles.instanceMatrix.needsUpdate = true;
  S.surf.visible = true;
  return { P, sp };
}

// time-of-day for the backdrop: night 0..1 and clock angle
export function setNight(S, night, hours = null) {
  S.nightMat.opacity = clamp(night); S.moon.material.opacity = clamp(night * 1.2);
  S.sun.material.opacity = clamp(1 - night * 1.3);
  S.rimL.color.setRGB(lerp(1.0, 0.45, night), lerp(0.69, 0.62, night), lerp(0.38, 1.0, night)); S.rimL.intensity = lerp(18, 14, night);
  S.key.intensity = lerp(1.7, 0.9, night); S.key.color.setRGB(lerp(1, 0.7, night), lerp(0.94, 0.8, night), lerp(0.88, 1, night));
  S.liquid.material.uniforms.glowK.value = lerp(1.0, 0.6, night);
  S.dayMat.color.setScalar(lerp(0.82, 0.74, night));
  if (hours !== null) { S.minPivot.rotation.z = -hours * Math.PI * 2; S.hourPivot.rotation.z = -hours / 12 * Math.PI * 2; }
}
