import * as THREE from 'three';
import { canvasTex, normalTex, fbm, noise3, rng, clamp, smooth, lerp, V } from './lib.js';
import { GrowTube, makeLeaf, stemMat, tendrilPoints, makeMiniMelon } from './plant.js';
import { Sparkles } from './fx.js';

const skinNormal = normalTex(512, 512, (u, v) => 0.6 * fbm(u * 30, v * 30, 1, 3) + 0.4 * Math.pow(Math.abs(noise3(u * 140, v * 140, 2)), 0.5), 0.9, { repeat: true });
const clothNormal = normalTex(512, 512, (u, v) => 0.5 * Math.sin(u * 600) * 0.1 + fbm(u * 6, v * 3, 4, 3) * 0.9, 2.5, { repeat: true });

// Torso from a lathe profile, elliptical cross-section, navel at +z, y=0
function torsoGeometry() {
  const prof = [];
  for (let i = 0; i <= 60; i++) { const y = -1.6 + i / 60 * 3.4;
    const r = 0.92 + 0.08 * Math.exp(-Math.pow((y - 0.05) / 0.45, 2)) - 0.05 * Math.exp(-Math.pow((y - 0.75) / 0.3, 2)) + 0.08 * smooth(clamp((y - 1.0) / 0.8)) + 0.05 * smooth(clamp((-y - 0.8) / 0.6));
    prof.push(new THREE.Vector2(r, y)); }
  const g = new THREE.LatheGeometry(prof, 160);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.z *= 0.72; v.x *= 1.02;
    // navel: soft dip with a rim
    const dx = v.x, dy = v.y - 0.02; const d2 = (dx * dx) / 0.004 + (dy * dy) / 0.006;
    if (v.z > 0) { v.z -= 0.13 * Math.exp(-d2) - 0.012 * Math.exp(-Math.pow(Math.sqrt(d2) - 1.6, 2) * 2) ; }
    // linea / subtle belly shape
    v.z += 0.03 * Math.exp(-Math.pow((v.y + 0.25) / 0.35, 2)) * smooth(clamp(v.z / 0.6));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}

export function buildBelly() {
  const scene = new THREE.Scene();
  // blurred living room
  const tex = canvasTex(1024, 1800, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#f6efe6'); bg.addColorStop(0.5, '#e9dccb'); bg.addColorStop(1, '#c9b49c');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.filter = 'blur(40px)';
    g.fillStyle = '#9fc7d8'; g.fillRect(w * 0.05, h * 0.08, w * 0.35, h * 0.35); // window
    g.fillStyle = '#ffffff'; g.fillRect(w * 0.08, h * 0.1, w * 0.3, h * 0.3);
    g.fillStyle = '#7a9a62'; g.beginPath(); g.ellipse(w * 0.82, h * 0.42, w * 0.16, h * 0.14, 0, 0, 7); g.fill(); // plant
    g.fillStyle = '#b48a64'; g.fillRect(w * 0.55, h * 0.68, w * 0.45, h * 0.32); // sofa
    g.filter = 'none';
    const r = rng(2); for (let i = 0; i < 18; i++) { const x = r() * w, y = r() * h * 0.5, s = 30 + r() * 70; const b = g.createRadialGradient(x, y, 0, x, y, s);
      b.addColorStop(0, 'rgba(255,252,240,0.5)'); b.addColorStop(1, 'rgba(255,250,240,0)'); g.fillStyle = b; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(22, 38), new THREE.MeshBasicMaterial({ map: tex, color: 0x6a6058 })); back.position.set(0, 0, -7); scene.add(back);
  const skinMat = new THREE.MeshPhysicalMaterial({ color: 0xe0a284, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xffc2a8), sheenRoughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4,
    normalMap: skinNormal, normalScale: new THREE.Vector2(0.35, 0.35) });
  skinNormal.repeat.set(4, 4);
  const torso = new THREE.Mesh(torsoGeometry(), skinMat); torso.castShadow = torso.receiveShadow = true; scene.add(torso);
  // t-shirt pulled up (rolled hem) and shorts
  const shirtMat = new THREE.MeshPhysicalMaterial({ color: 0x2f8fd0, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0x9fd8ff), normalMap: clothNormal, normalScale: new THREE.Vector2(0.6, 0.6) });
  clothNormal.repeat.set(3, 2);
  const shirt = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.99, 1.5, 128, 8, true), shirtMat); shirt.scale.set(1.05, 1, 0.78); shirt.position.y = 1.62; shirt.castShadow = true; scene.add(shirt);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 20, 128), shirtMat); hem.rotation.x = Math.PI / 2; hem.scale.set(1.06, 0.79, 1); hem.position.y = 0.88; hem.castShadow = true; scene.add(hem);
  const shortsMat = new THREE.MeshPhysicalMaterial({ color: 0x40465a, roughness: 0.9, sheen: 0.6, sheenColor: new THREE.Color(0x8890a8), normalMap: clothNormal, normalScale: new THREE.Vector2(0.5, 0.5) });
  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.04, 1.2, 128, 4, true), shortsMat); shorts.scale.set(1.04, 1, 0.77); shorts.position.y = -1.42; scene.add(shorts);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.05, 16, 128), shortsMat); band.rotation.x = Math.PI / 2; band.scale.set(1.04, 0.77, 1); band.position.y = -0.83; scene.add(band);

  // navel point on the surface
  const navel = V(0, 0.02, 0.92 * 1.0 * 0.72 + 0.03 - 0.085);
  // vine: out of the navel toward camera, then curling up
  const pts = [navel.clone().add(V(0, 0, -0.03)), navel.clone().add(V(0.02, 0.02, 0.18)), V(0.12, 0.18, 1.25), V(0.05, 0.5, 1.55), V(-0.25, 0.75, 1.5), V(-0.35, 0.95, 1.2), V(-0.15, 1.2, 1.05)];
  const vine = new GrowTube(pts, 0.05, stemMat, { segs: 200, radial: 14, taper: 0.35 }); scene.add(vine.mesh);
  const branch = new GrowTube([V(0.12, 0.2, 1.24), V(0.35, 0.05, 1.45), V(0.5, -0.12, 1.5)], 0.03, stemMat, { segs: 60, radial: 10, taper: 0.6 }); scene.add(branch.mesh);
  const leaves = []; for (let i = 0; i < 7; i++) { const l = makeLeaf(); l.scale.setScalar(0.001); scene.add(l); leaves.push(l); }
  const tendrils = [0.35, 0.62, 0.85].map((u, i) => { const base = vine.pointAt(u); return new GrowTube(tendrilPoints(base, V(i % 2 ? -1 : 1, 0.4, 0.3), 0.32, 2.5, 0.07, i), 0.008, stemMat, { segs: 80, radial: 6, taper: 0.5 }); });
  tendrils.forEach((t) => scene.add(t.mesh));
  const melon = makeMiniMelon(); melon.scale.setScalar(0.001); scene.add(melon);
  const sparkles = new Sparkles(24, '#ffe58a', { size: 0.09, seed: 11, star: true }); scene.add(sparkles.group);
  // skin bulge around the navel when the vine pushes out
  const bulge = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), skinMat); bulge.rotation.x = Math.PI / 2; bulge.position.copy(navel).add(V(0, 0, -0.02)); bulge.scale.set(1, 0.001, 1); scene.add(bulge);

  scene.add(new THREE.HemisphereLight(0xfff6ee, 0x403028, 0.3));
  const key = new THREE.DirectionalLight(0xfff0e0, 3.4); key.position.set(-4.5, 3.2, 3.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 1, far: 15 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe0c8, 2.2); rim.position.set(4, 1, -3); scene.add(rim);
  const fill = new THREE.PointLight(0xffe8dc, 6, 8, 1.6); fill.position.set(1.5, 0.3, 3); scene.add(fill);
  return { scene, torso, vine, branch, leaves, tendrils, melon, sparkles, navel, bulge };
}
