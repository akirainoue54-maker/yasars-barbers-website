import * as THREE from 'three';
import { clamp, smooth, lerp, noise3, fbm, V, normalTex, varTube } from './lib.js';

// Surface pitting used when the enamel is eroded (strength driven by the material's normalScale)
const pit = normalTex(512, 512, (u, v) => 0.55 * fbm(u * 26, v * 26, 1.3, 3) + 0.45 * Math.pow(Math.abs(noise3(u * 110, v * 110, 2)), 0.6), 2.2, { repeat: true });

// Molar crown: rounded square block with four cusps on top, narrowing to a neck.
function crownGeometry() {
  const g = new THREE.SphereGeometry(1, 96, 72);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const sx = Math.sign(x) * Math.pow(Math.abs(x), 0.72), sz = Math.sign(z) * Math.pow(Math.abs(z), 0.72);
    let X = sx * 0.5, Z = sz * 0.46, Y;
    if (y >= 0) {
      const cusp = 0.075 * Math.pow(Math.abs(Math.cos(sx * Math.PI * 1.1) * Math.cos(sz * Math.PI * 1.1)), 1.4) * smooth(clamp(y * 1.6));
      const groove = -0.05 * Math.exp(-Math.pow(sx * 6, 2)) * smooth(clamp(y * 2)) - 0.05 * Math.exp(-Math.pow(sz * 6, 2)) * smooth(clamp(y * 2));
      Y = y * 0.34 + cusp + groove;
    } else {
      const neck = smooth(clamp(-y * 1.2));
      X *= 1 - 0.2 * neck; Z *= 1 - 0.2 * neck;
      Y = y * 0.3;
    }
    p.setXYZ(i, X, Y, Z);
    // enamel: bright cool white on top, warmer cream toward the neck
    const t = clamp((Y + 0.3) / 0.6);
    const n = 0.97 + 0.04 * noise3(X * 20, Y * 20, Z * 20);
    col[i * 3] = lerp(0.9, 0.99, t) * n; col[i * 3 + 1] = lerp(0.84, 0.98, t) * n; col[i * 3 + 2] = lerp(0.68, 0.94, t) * n;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function rootGeometry(sign, splay, len) {
  const c = new THREE.CatmullRomCurve3([V(sign * 0.18, -0.2, 0), V(sign * (0.2 + splay * 0.25), -0.2 - len * 0.35, 0.02), V(sign * (0.22 + splay), -0.2 - len * 0.7, -0.01), V(sign * (0.2 + splay * 1.4), -0.2 - len, 0.02)]);
  const g = varTube(c, 40, 20, (u) => lerp(0.15, 0.03, Math.pow(u, 0.8)));
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const n = 0.95 + 0.08 * noise3(p.getX(i) * 14, p.getY(i) * 14, p.getZ(i) * 14); col[i * 3] = 0.9 * n; col[i * 3 + 1] = 0.8 * n; col[i * 3 + 2] = 0.6 * n; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function makeTooth() {
  const group = new THREE.Group();
  const crownMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.35, sheenColor: new THREE.Color(0xdde8ff), normalMap: pit, normalScale: new THREE.Vector2(0, 0), envMapIntensity: 1.3 });
  const rootMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: new THREE.Color(0xfff0d0), envMapIntensity: 0.8 });
  const crown = new THREE.Mesh(crownGeometry(), crownMat); crown.castShadow = true; crown.receiveShadow = true;
  const r1 = new THREE.Mesh(rootGeometry(-1, 0.04, 0.62), rootMat), r2 = new THREE.Mesh(rootGeometry(1, 0.04, 0.58), rootMat);
  r1.castShadow = r2.castShadow = true;
  // drawn after the (transparent) cola so it stays crisp and bright seen through the glass
  crownMat.transparent = rootMat.transparent = true; crown.renderOrder = r1.renderOrder = r2.renderOrder = 3.5;
  group.add(crown, r1, r2);
  // wear 0..1: glossy enamel -> dull, slightly stained, finely pitted (the surface changes, never the shape)
  const setWear = (w) => {
    w = clamp(w);
    crownMat.roughness = lerp(0.16, 0.82, w); crownMat.clearcoat = lerp(1, 0.0, smooth(clamp(w * 1.15)));
    crownMat.clearcoatRoughness = lerp(0.04, 0.8, w); crownMat.sheen = lerp(0.35, 0.0, w);
    crownMat.normalScale.set(lerp(0, 1.7, w), lerp(0, 1.7, w));
    crownMat.color.setRGB(lerp(1, 0.9, w), lerp(1, 0.82, w), lerp(1, 0.66, w));
    crownMat.envMapIntensity = lerp(1.3, 0.55, w);
  };
  group.userData = { setWear, crown, crownMat, rootMat };
  return group;
}
