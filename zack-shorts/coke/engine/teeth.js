import * as THREE from 'three';
import { normalTex, fbm, noise3, clamp, smooth, lerp, V } from './lib.js';

export const tissueNormal = normalTex(512, 512, (u, v) =>
  fbm(u * 6, v * 6, 0.5, 4) * 0.8 + 0.25 * Math.pow(Math.abs(noise3(u * 40, v * 40, 2)), 0.5), 3.0, { repeat: true });
export function tissueMat(color = 0xd9606a, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.5, clearcoat: 1.0, clearcoatRoughness: 0.05, sheen: 0.6, sheenColor: new THREE.Color(0xff6a70), sheenRoughness: 0.4,
    normalMap: tissueNormal, normalScale: new THREE.Vector2(0.8, 0.8), side: THREE.DoubleSide, ...opts,
  });
}

// Tube with explicit frames for a path lying in the YZ plane (side vector = +X).

function toothGeo(kind) {
  // crown modelled from a deformed sphere, biting edge toward -y; vertex colours give translucent enamel edge
  const g = new THREE.SphereGeometry(1, 48, 36);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const e = clamp((-y + 1) / 2); // 0 root .. 1 edge
    if (kind === 'molar' || kind === 'pre') {
      const cusp = y < -0.3 ? 0.16 * Math.cos(x * Math.PI * 1.6) * Math.cos(z * Math.PI * 1.6) : 0;
      x *= 0.5; z *= kind === 'molar' ? 0.52 : 0.42; y = y * 0.5 - cusp * 0.3;
      if (y < -0.36) y = -0.36 + (y + 0.36) * 0.35;
    } else {
      const w = 0.5 * (0.78 + 0.3 * e);
      let d = 0.22 * (0.4 + 0.75 * (1 - e));
      if (kind === 'canine') { x *= 1 - 0.55 * smooth(clamp((-y - 0.2) / 0.8)); d *= 1.35; }
      x *= kind === 'canine' ? 0.5 : w; z = z * d + (z > 0 ? 0.05 * (1 - x * x * 6) * (1 - e) : 0);
      y *= 0.62; if (y < -0.5 && kind !== 'canine') y = -0.5 + (y + 0.5) * 0.25;
    }
    p.setXYZ(i, x, y, z);
    // enamel: cream body, cooler translucent edge, warmer neck
    const edge = smooth(clamp((e - 0.72) / 0.28)), neck = smooth(clamp((0.25 - e) / 0.25));
    const n = 0.97 + 0.05 * noise3(x * 30, y * 30, z * 30);
    col[i * 3] = (0.93 - 0.17 * edge - 0.02 * neck) * n; col[i * 3 + 1] = (0.9 - 0.13 * edge - 0.06 * neck) * n; col[i * 3 + 2] = (0.83 - 0.05 * edge - 0.14 * neck) * n;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const sz = { incisor: 0.105, canine: 0.1, pre: 0.11, molar: 0.13 }[kind];
  g.scale(sz, sz * 1.1, sz);
  return g;
}
export const toothMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.03, sheen: 0.25, sheenColor: new THREE.Color(0xdde6ff), envMapIntensity: 1.2 });

// One dental arch. Teeth along z = zf - k x^2, pointing down (upper) or up (lower).
export function makeArch(upper) {
  const grp = new THREE.Group();
  const zf = 0.1, k = 1.6;
  const kinds = ['incisor', 'incisor', 'canine', 'pre', 'pre', 'molar', 'molar'];
  const sizes = [0.095, 0.085, 0.088, 0.095, 0.1, 0.125, 0.13];
  let s = 0.0; const pts = [];
  // arc-length placement
  const arc = (x) => V(x, 0, zf - k * x * x);
  for (const side of [-1, 1]) {
    let x = side * 0.004; let acc = 0;
    kinds.forEach((kind, i) => {
      const w = sizes[i] * (upper ? 1 : 0.86);
      // advance x so that the chord equals half widths
      const target = acc + w / 2; let xx = Math.abs(x);
      let L = 0, prev = arc(0); for (let q = 0; q < 400; q++) { const nx = q / 400 * 0.6; const pnt = arc(nx); L += pnt.distanceTo(prev); prev = pnt; if (L >= target) { xx = nx; break; } }
      acc += w + 0.006;
      const pos = arc(xx * side), tan = V(1, 0, -2 * k * xx * side).normalize();
      const m = new THREE.Mesh(toothGeo(kind), toothMat); m.castShadow = true; m.receiveShadow = true;
      m.position.copy(pos);
      m.rotation.y = Math.atan2(-tan.z, tan.x) * 1;
      if (!upper) m.rotation.z = Math.PI; // biting edge up
      m.scale.set(upper ? 1 : 0.86, upper ? 1 : 0.92, 1);
      m.position.y = upper ? 0.085 : -0.085;
      grp.add(m); pts.push(pos);
    });
  }
  // gum ridge along the arch
  const gp = []; for (let i = -40; i <= 40; i++) { const x = i / 40 * 0.62; gp.push(V(x, upper ? 0.175 : -0.175, zf - k * x * x - 0.01)); }
  const gum = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gp), 120, 0.07, 20), tissueMat(0xe07885));
  gum.scale.set(1, 1, 1); gum.receiveShadow = true; grp.add(gum);
  return grp;
}

