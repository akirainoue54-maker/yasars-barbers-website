import * as THREE from 'three';
import { pixelTex, normalTex, canvasTex, rng, fbm, noise3, clamp, smooth, lerp } from './lib.js';

// ---------- watermelon seed ----------
// Flat ovate seed, ~1 unit long (y), 0.62 wide (x), 0.22 thick (z). Pointed end at +y.
export function seedGeometry() {
  const g = new THREE.SphereGeometry(0.5, 64, 40);
  const p = g.attributes.position, v = new THREE.Vector3();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const y = v.y / 0.5; // -1..1
    const taper = 1 - 0.42 * smooth(clamp((y + 0.2) / 1.2)); // narrower toward +y
    const tip = y > 0.75 ? 1 - (y - 0.75) * 0.9 : 1;
    let x = v.x * 0.62 * taper * tip, z = v.z * 0.22;
    // flattened faces with a slightly raised rim
    const r = Math.hypot(v.x / 0.5, v.z / 0.5);
    z *= 0.85 + 0.15 * Math.pow(Math.abs(v.x / 0.5), 3);
    p.setXYZ(i, x, v.y * (y > 0 ? 1.04 : 0.96), z);
    // colour: dark brown-black, lighter tan rim, pale tip "hilum"
    const rim = Math.pow(clamp(Math.abs(v.x / 0.5) * 1.05), 10);
    const tipc = smooth(clamp((y - 0.86) / 0.14));
    const base = [0.012, 0.007, 0.005];
    const tan = [0.16, 0.09, 0.05];
    const n = 0.85 + 0.3 * noise3(v.x * 9, v.y * 9, v.z * 9);
    for (let k = 0; k < 3; k++) col[i * 3 + k] = lerp(lerp(base[k] * n, tan[k], rim * 0.3), 0.3, tipc * 0.4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const seedNormal = normalTex(512, 512, (u, v) => fbm(u * 24, v * 24, 3.1, 3) * 0.5 + 0.2 * noise3(u * 120, v * 120, 1), 0.8, { repeat: true });
export function seedMaterial() {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.3, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.03,
    normalMap: seedNormal, normalScale: new THREE.Vector2(0.1, 0.1), envMapIntensity: 1.0,
  });
}
export function makeSeed(scale = 1) {
  const m = new THREE.Mesh(seedGeometry(), seedMaterial());
  m.scale.setScalar(scale); m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------- watermelon slice ----------
// Classic wedge: tip at origin, flesh face in the XY plane facing +Z, arc of rind at radius R toward +Y.
// Slice spans angle +-HALF around +Y; thickness T toward -Z.
const R = 1, HALF = 0.5, T = 0.34;
const rFlesh = 0.84, rWhite = 0.93;

function cellular(u, v, scale, seed = 0) {
  // distance to nearest jittered point (F1) and second (F2) for granular flesh
  const x = u * scale, y = v * scale, xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const h = Math.sin(cx * 127.1 + cy * 311.7 + seed) * 43758.5453; const hx = h - Math.floor(h);
    const h2 = Math.sin(cx * 269.5 + cy * 183.3 + seed) * 43758.5453; const hy = h2 - Math.floor(h2);
    const d = Math.hypot(cx + hx - x, cy + hy - y);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2];
}

// texture coordinates: u = x + 0.5 (x in -0.5..0.5 covers |x| < sin(HALF)), v = y (0..1)
const FW = 1024, FH = 1024;
const fleshColor = pixelTex(FW, FH, (u, v) => {
  const x = (u - 0.5) * 1.0, y = v; const r = Math.hypot(x, y);
  const [f1, f2] = cellular(u, v, 105);
  const edge = clamp((f2 - f1) * 4); // 0 at cell borders
  const n = fbm(u * 6, v * 6, 0.3, 4);
  // red core -> lighter pink-coral toward rind -> pale green-white
  const t = clamp((r - 0.45) / (rFlesh - 0.45));
  let c = [lerp(222, 246, t * t), lerp(18, 70, t * t), lerp(38, 72, t * t)];
  c = c.map((k, i) => k * (0.88 + 0.12 * edge) + n * 18 * (i === 0 ? 1 : 0.6));
  // fibrous white streaks radiating from tip (watermelon placenta lines)
  const ang = Math.atan2(x, y); const streak = Math.pow(Math.abs(Math.sin(ang * 26 + fbm(u * 3, v * 3, 2) * 4)), 40) * smooth(clamp((r - 0.2) / 0.5)) * 0.35;
  c = c.map((k) => lerp(k, 255, streak * 0.5));
  // pinkish-white transition into rind
  const w = smooth(clamp((r - rFlesh + 0.05) / 0.06));
  c = [lerp(c[0], 240, w), lerp(c[1], 228, w), lerp(c[2], 200, w)];
  return c.map((k) => clamp(k, 0, 255));
});
const fleshNormal = normalTex(FW, FH, (u, v) => {
  const [f1, f2] = cellular(u, v, 105);
  const [g1] = cellular(u, v, 260, 7.7);
  return Math.sqrt(clamp(f2 - f1)) * 0.7 + (1 - g1) * 0.2 + fbm(u * 20, v * 20, 5, 2) * 0.1;
}, 5.0);
const fleshRough = pixelTex(512, 512, (u, v) => { const [f1, f2] = cellular(u, v, 35); const k = 70 + 120 * clamp((f2 - f1) * 3); return [k, k, k]; }, { srgb: false });

function sectorShape(r0, r1, half) {
  const s = new THREE.Shape();
  const a0 = Math.PI / 2 - half, a1 = Math.PI / 2 + half;
  if (r0 <= 0) s.moveTo(0, 0); else s.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
  s.absarc(0, 0, r1, a0, a1, false);
  if (r0 > 0) s.absarc(0, 0, r0, a1, a0, true); else s.lineTo(0, 0);
  return s;
}

const rindTex = pixelTex(1024, 128, (u, v) => {
  // dark green stripes along the rind
  const stripe = 0.5 + 0.5 * Math.sin(u * 40 + fbm(u * 8, v * 2, 1) * 6);
  const k = smooth(clamp((stripe - 0.35) * 2.2));
  const n = fbm(u * 50, v * 10, 3) * 0.5 + 0.5;
  return [lerp(26, 70, k) * (0.8 + 0.3 * n), lerp(70, 140, k) * (0.8 + 0.3 * n), lerp(22, 40, k)];
}, { repeat: true });

export function makeSlice() {
  const grp = new THREE.Group();
  const ext = (shape, depth, bevel) => new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments: 96, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, steps: 1,
  });
  // flesh
  const fg = ext(sectorShape(0.0, rFlesh, HALF), T - 0.04, 0.02);
  fg.translate(0, 0, -T + 0.02);
  // remap UVs for front/back faces: u = x+0.5, v = y
  { fg.computeVertexNormals(); const p = fg.attributes.position, uv = fg.attributes.uv, n = fg.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(n.getZ(i)) > 0.6) uv.setXY(i, p.getX(i) + 0.5, p.getY(i));
      else uv.setXY(i, 0.5 + (p.getX(i) * n.getY(i) - p.getY(i) * n.getX(i)) * 0.9, 0.5 + p.getZ(i) * 0.9);
    } uv.needsUpdate = true; }
  const fleshMat = new THREE.MeshPhysicalMaterial({
    map: fleshColor, normalMap: fleshNormal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: fleshRough,
    roughness: 0.55, clearcoat: 0.85, clearcoatRoughness: 0.12, sheen: 0.6, sheenColor: new THREE.Color(0xff6070), sheenRoughness: 0.5,
    specularIntensity: 1.0, ior: 1.36,
  });
  const flesh = new THREE.Mesh(fg, fleshMat); flesh.castShadow = flesh.receiveShadow = true; grp.add(flesh);
  // white rind band
  const wg = ext(sectorShape(rFlesh - 0.005, rWhite, HALF), T - 0.03, 0.012); wg.translate(0, 0, -T + 0.015);
  const white = new THREE.Mesh(wg, new THREE.MeshPhysicalMaterial({ color: 0xeef3cf, roughness: 0.45, clearcoat: 0.5, sheen: 0.3, sheenColor: new THREE.Color(0xe8ffd0) }));
  white.castShadow = white.receiveShadow = true; grp.add(white);
  // green rind (slightly thinner so it reads as the curved skin)
  const gg = ext(sectorShape(rWhite - 0.005, R, HALF), T - 0.05, 0.02); gg.translate(0, 0, -T + 0.035);
  { const p = gg.attributes.position, uv = gg.attributes.uv;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getX(i), p.getY(i)); uv.setXY(i, a * 2.0 + 0.5, p.getZ(i) * 2 + 0.5); } uv.needsUpdate = true; }
  const green = new THREE.Mesh(gg, new THREE.MeshPhysicalMaterial({ map: rindTex, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  green.castShadow = green.receiveShadow = true; grp.add(green);
  // seeds embedded in the front face, along two arcs
  const r = rng(42); const seeds = [];
  const place = (rad, ang, rot, s) => {
    const sd = makeSeed(s);
    sd.position.set(Math.sin(ang) * rad, Math.cos(ang) * rad, 0.012);
    sd.rotation.set(0, 0, -ang + rot); // pointed end toward the tip-ish
    sd.rotateY((r() - 0.5) * 0.4);
    grp.add(sd); seeds.push(sd); return sd;
  };
  [[0.46, -0.27], [0.5, -0.08], [0.48, 0.13], [0.44, 0.31], [0.62, -0.36], [0.66, -0.17], [0.67, 0.03], [0.65, 0.22], [0.6, 0.38], [0.3, -0.12], [0.31, 0.15]]
    .forEach(([rad, a], i) => place(rad + (r() - 0.5) * 0.03, a + (r() - 0.5) * 0.04, Math.PI + (r() - 0.5) * 0.5, 0.085 + r() * 0.012));
  // juice droplets: small glossy beads on the face
  const dropMat = new THREE.MeshPhysicalMaterial({ color: 0xff4050, roughness: 0.02, transmission: 0, clearcoat: 1, opacity: 0.55, transparent: true });
  const dg = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 26; i++) {
    const rad = 0.12 + r() * 0.68, a = (r() - 0.5) * 2 * HALF * 0.9;
    const d = new THREE.Mesh(dg, dropMat); const s = 0.006 + r() * 0.012;
    d.scale.set(s, s, s * 0.5); d.position.set(Math.sin(a) * rad, Math.cos(a) * rad, 0.006); grp.add(d);
  }
  grp.userData.seeds = seeds;
  return grp;
}

// A loose bitten chunk of flesh (small irregular blob) to travel with the seed
export function fleshChunk(seed = 3) {
  const g = new THREE.IcosahedronGeometry(0.12, 4);
  const r = rng(seed);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + 0.35 * fbm(v.x * 9 + seed, v.y * 9, v.z * 9, 3); v.multiplyScalar(k); v.y *= 0.7; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0xf0304a, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.6, sheenColor: new THREE.Color(0xff8090), normalMap: fleshNormal, normalScale: new THREE.Vector2(0.6, 0.6) }));
}

// Seed cracked open: two shell halves (split between the flat faces) + the pale kernel
export function makeSplitSeed(scale = 1) {
  const grp = new THREE.Group();
  const halves = [1, -1].map((side) => {
    const g = seedGeometry(); const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i);
      if (z * side < 0.012) { p.setZ(i, side * 0.012); c.setXYZ(i, 0.07, 0.05, 0.035); } }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, seedMaterial()); m.castShadow = true; grp.add(m); return m;
  });
  const kg = new THREE.SphereGeometry(0.5, 48, 32); { const p = kg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.5; const taper = 1 - 0.4 * smooth(clamp((y + 0.2) / 1.2)); p.setXYZ(i, p.getX(i) * 0.5 * taper, p.getY(i) * 0.88, p.getZ(i) * 0.14); } kg.computeVertexNormals(); }
  const kernel = new THREE.Mesh(kg, new THREE.MeshPhysicalMaterial({ color: 0xf3ead0, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xfff6d8), clearcoat: 0.3, emissive: 0xffc860, emissiveIntensity: 0 }));
  grp.add(kernel);
  grp.scale.setScalar(scale);
  return { group: grp, halves, kernel };
}
