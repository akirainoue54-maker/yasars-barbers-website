import * as THREE from 'three';
import { fbm, noise3, rng, clamp, smooth, lerp, V, normalTex, canvasTex } from './lib.js';
import { tissueNormal } from './set_mouth.js';
import { makeSeed } from './melon.js';
import { Droplets, Bubbles, Sparkles, glow } from './fx.js';
import { GrowTube, makeLeaf, makeCotyledon, stemMat, rootMat, tendrilPoints } from './plant.js';

export const RX = 3.0, RY = 2.4, RZ = 3.6, ACID_Y = -1.25;

function cavityGeometry() {
  const g = new THREE.SphereGeometry(1, 180, 130);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  const base = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const phi = Math.atan2(v.y, v.x);
    const warp = fbm(v.x * 1.5, v.y * 1.5, v.z * 1.5, 3);
    const ridge = Math.pow(Math.abs(Math.sin(phi * 9 + v.z * 1.2 + warp * 3.0)), 0.7); // rugae run along z
    const d = 0.16 * ridge + 0.05 * fbm(v.x * 6, v.y * 6, v.z * 6, 3);
    const s = 1 - d;
    p.setXYZ(i, v.x * RX * s, v.y * RY * s, v.z * RZ * s);
    base[i * 3] = v.x; base[i * 3 + 1] = v.y; base[i * 3 + 2] = v.z;
    const m = 0.78 + 0.32 * ridge + 0.1 * fbm(v.x * 12, v.y * 12, v.z * 12, 2);
    const vein = Math.pow(Math.abs(fbm(v.x * 4, v.y * 4, v.z * 4, 4) * 2.2), 10) * 0.6;
    col[i * 3] = m; col[i * 3 + 1] = m * (0.92 - vein) ; col[i * 3 + 2] = m * (0.95 - vein * 0.5);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.userData.base = base; g.userData.rest = Float32Array.from(p.array);
  g.computeVertexNormals();
  return g;
}

export function buildStomach() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5a1018);
  const cavMat = new THREE.MeshPhysicalMaterial({
    color: 0xe87a7c, vertexColors: true, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.7, sheenColor: new THREE.Color(0xff7070), sheenRoughness: 0.4,
    normalMap: tissueNormal, normalScale: new THREE.Vector2(1.0, 1.0), side: THREE.BackSide,
  });
  tissueNormal.repeat.set(1, 1);
  const cav = new THREE.Mesh(cavityGeometry(), cavMat); cav.receiveShadow = true; scene.add(cav);
  // floor point under (x,z)
  const ray = new THREE.Raycaster(); cav.updateMatrixWorld();
  const floorAt = (x, z) => { ray.set(V(x, 0, z), V(0, -1, 0)); const h = ray.intersectObject(cav)[0]; return h ? h.point.clone() : V(x, -RY, z); };

  // ----- acid -----
  const surfGeo = new THREE.CircleGeometry(4.2, 160); surfGeo.rotateX(-Math.PI / 2);
  // add rings for wave resolution
  const sg = new THREE.PlaneGeometry(8.4, 8.4, 200, 200); sg.rotateX(-Math.PI / 2);
  const acidNormal = normalTex(512, 512, (u, v) => fbm(u * 8, v * 8, 0.7, 4), 2.5, { repeat: true });
  const acidMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9e23a, emissive: 0x7d9a10, emissiveIntensity: 0.55, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
    transparent: true, opacity: 0.8, side: THREE.DoubleSide, normalMap: acidNormal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 2.0,
  });
  const acid = new THREE.Mesh(sg, acidMat); acid.position.y = ACID_Y; acid.renderOrder = 2; scene.add(acid);
  sg.userData.rest = Float32Array.from(sg.attributes.position.array);
  const acidBody = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    new THREE.MeshBasicMaterial({ color: 0x9fbf20, transparent: true, opacity: 0.0, side: THREE.BackSide, depthWrite: false }));
  acidBody.scale.set(RX * 0.95, RY * 0.95, RZ * 0.95); scene.add(acidBody);
  const bubbles = new Bubbles(320, { size: 0.022, seed: 4, color: 0xe8ff80 }); scene.add(bubbles.mesh);
  const splash = new Droplets(150, new THREE.MeshPhysicalMaterial({ color: 0xe8ff70, emissive: 0x8aa000, emissiveIntensity: 0.7, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.6 }), { size: 0.008, seed: 8 });
  scene.add(splash.mesh);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), new THREE.MeshBasicMaterial({ color: 0xf4ffb0, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
  ripple.rotation.x = -Math.PI / 2; scene.add(ripple);

  // ----- seeds -----
  const seed = makeSeed(0.16); scene.add(seed);
  const shellGlow = glow('#ffe9a0', 0.6); scene.add(shellGlow); shellGlow.material.opacity = 0;

  // ----- myth plant (grows from the seed on the stomach floor) -----
  const plant = new THREE.Group(); scene.add(plant);
  const base = floorAt(0.2, 0.4);
  const rr = rng(21);
  const roots = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rr() * 0.4; const pts = [];
    for (let k = 0; k <= 8; k++) { const u = k / 8; const L = 0.25 + u * (1.0 + rr() * 0.5);
      const p = V(base.x + Math.cos(a) * L, 0, base.z + Math.sin(a) * L); const f = floorAt(p.x, p.z); p.y = f.y + 0.03 + 0.04 * Math.sin(u * 9 + i); pts.push(p); }
    pts.unshift(base.clone().add(V(0, 0.02, 0)));
    const t = new GrowTube(pts, 0.011, rootMat, { segs: 90, radial: 8, taper: 0.15 }); plant.add(t.mesh); roots.push(t);
  }
  const stemPts = []; for (let k = 0; k <= 12; k++) { const u = k / 12; stemPts.push(V(base.x + 0.18 * Math.sin(u * 4), base.y + 0.05 + u * 2.6, base.z + 0.15 * Math.cos(u * 3))); }
  const stem = new GrowTube(stemPts, 0.038, stemMat, { segs: 140, radial: 14, taper: 0.4 }); plant.add(stem.mesh);
  const cots = [makeCotyledon(), makeCotyledon()]; cots.forEach((c) => plant.add(c));
  const leaves = []; for (let i = 0; i < 6; i++) { const l = makeLeaf(); l.scale.setScalar(0.001); plant.add(l); leaves.push(l); }
  // climbing vines along the walls
  const vines = [];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6 + 0.4; const pts = [];
    for (let k = 0; k <= 16; k++) { const u = k / 16; const h = -1.6 + u * 3.4; const ph = a + u * 1.4;
      const x = Math.cos(ph) * RX * 0.86 * Math.sqrt(Math.max(0.05, 1 - (h * h) / (RY * RY))), z = Math.sin(ph) * RZ * 0.86 * Math.sqrt(Math.max(0.05, 1 - (h * h) / (RY * RY)));
      pts.push(V(x, h, z)); }
    const t = new GrowTube(pts, 0.032, stemMat, { segs: 120, radial: 10, taper: 0.35 }); plant.add(t.mesh); vines.push(t);
  }
  const vineLeaves = []; for (let i = 0; i < 16; i++) { const l = makeLeaf(); l.scale.setScalar(0.001); plant.add(l); vineLeaves.push(l); }
  const sparkles = new Sparkles(28, '#ffd36a', { size: 0.05, seed: 6, star: true }); scene.add(sparkles.group);

  // ----- tiny sprout (acid scene) -----
  const sprout = new THREE.Group(); sprout.scale.setScalar(0.2); scene.add(sprout);
  const sproutStem = new GrowTube([V(0, 0, 0), V(0.02, 0.12, 0), V(0.0, 0.25, 0.02), V(-0.03, 0.36, 0.0)], 0.018, stemMat.clone(), { segs: 60, radial: 8, taper: 0.6 });
  sprout.add(sproutStem.mesh);
  const sproutCots = [makeCotyledon(), makeCotyledon()]; sproutCots.forEach((c) => { c.material = c.material.clone(); c.scale.setScalar(0.001); sprout.add(c); });

  // ----- lights -----
  const hemi = new THREE.HemisphereLight(0xffe2d0, 0x3a0810, 0.25); scene.add(hemi);
  const key = new THREE.PointLight(0xffe6cc, 14, 9, 1.6); key.position.set(0.2, 0.9, 0.4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.002; scene.add(key);
  const acidLight = new THREE.PointLight(0xc8f040, 0, 6, 1.5); acidLight.position.set(0, ACID_Y - 0.4, 0); scene.add(acidLight);
  const camLight = new THREE.PointLight(0xfff0e8, 4, 4, 1.7); scene.add(camLight);
  const rim = new THREE.PointLight(0xffd0a0, 0, 3, 1.5); scene.add(rim);

  return { scene, cav, cavMat, acid, acidMat, acidBody, bubbles, splash, ripple, seed, shellGlow, plant, base, roots, stem, cots, leaves, vines, vineLeaves, sparkles,
    sprout, sproutStem, sproutCots, hemi, key, acidLight, camLight, rim, floorAt };
}

// animate acid waves; amp grows when the stomach churns
export function waveAcid(S, t, amp = 0.03, drop = null) {
  const g = S.acid.geometry, p = g.attributes.position, rest = g.userData.rest;
  for (let i = 0; i < p.count; i++) {
    const x = rest[i * 3], z = rest[i * 3 + 2];
    let y = amp * (Math.sin(x * 2.1 + t * 1.7) * Math.cos(z * 1.7 - t * 1.3) + 0.5 * noise3(x * 0.9, z * 0.9, t * 0.4));
    if (drop) { const d = Math.hypot(x - drop.x, z - drop.z); const k = drop.t; if (k > 0) y += drop.a * Math.exp(-k * 1.5) * Math.sin(d * 14 - k * 18) * Math.exp(-Math.pow((d - k * 1.3) * 2.5, 2)); }
    p.setY(i, y);
  }
  p.needsUpdate = true; g.computeVertexNormals();
}

// squeeze the cavity walls (peristalsis): k 0..1
export function squeezeCavity(S, t, k) {
  const g = S.cav.geometry, p = g.attributes.position, rest = g.userData.rest, b = g.userData.base;
  for (let i = 0; i < p.count; i++) {
    const z = b[i * 3 + 2];
    const wave = 1 - k * (0.12 + 0.1 * Math.sin(z * 4 - t * 7));
    p.setXYZ(i, rest[i * 3] * wave, rest[i * 3 + 1] * (1 - k * 0.05), rest[i * 3 + 2]);
  }
  p.needsUpdate = true; g.computeVertexNormals();
}
