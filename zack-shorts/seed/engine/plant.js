import * as THREE from 'three';
import { canvasTex, rng, clamp, smooth, lerp, V, fbm } from './lib.js';

// Growing tube revealed with drawRange (growth 0..1). Tip cap follows the end.
export class GrowTube {
  constructor(points, radius, mat, { segs = 120, radial = 12, taper = 0.5 } = {}) {
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const g = new THREE.TubeGeometry(this.curve, segs, radius, radial, false);
    // taper toward the end
    const p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) { const u = i / segs; this.curve.getPointAt(u, c); const k = lerp(1, taper, u);
      for (let j = 0; j <= radial; j++) { const idx = i * (radial + 1) + j; v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(k).add(c); p.setXYZ(idx, v.x, v.y, v.z); } }
    g.computeVertexNormals();
    this.segs = segs; this.radial = radial; this.geo = g;
    this.mesh = new THREE.Mesh(g, mat); this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(radius * taper * 1.05, 12, 8), mat); this.mesh.add(this.tip);
    this.set(0);
  }
  set(g) {
    g = clamp(g); this.g = g;
    const n = Math.max(0, Math.floor(this.segs * g));
    this.geo.setDrawRange(0, n * this.radial * 6);
    this.mesh.visible = g > 0.002; this.tip.position.copy(this.curve.getPointAt(Math.max(0.001, g)));
  }
  pointAt(u) { return this.curve.getPointAt(clamp(u)); }
}

// Watermelon leaf texture (deep green with pale veins)
const leafTex = canvasTex(512, 512, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.9, 10, w / 2, h * 0.5, w * 0.6);
  gr.addColorStop(0, '#5fae3a'); gr.addColorStop(1, '#2f7d24'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(210,245,170,0.75)'; g.lineCap = 'round';
  const r = rng(5);
  for (let i = -3; i <= 3; i++) {
    g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, h * 0.95);
    const a = i * 0.42; const ex = w / 2 + Math.sin(a) * w * 0.48, ey = h * 0.95 - Math.cos(a) * h * 0.9;
    g.quadraticCurveTo(w / 2 + Math.sin(a) * w * 0.15, h * 0.6, ex, ey); g.stroke();
    for (let k = 1; k < 6; k++) { const t = k / 6; const x = lerp(w / 2, ex, t), y = lerp(h * 0.95, ey, t);
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 70, y - 30 - r() * 30); g.stroke(); }
  }
});
const leafMat = new THREE.MeshPhysicalMaterial({ map: leafTex, side: THREE.DoubleSide, roughness: 0.45, clearcoat: 0.5, sheen: 0.5, sheenColor: new THREE.Color(0xc8ff90) });
export const stemMat = new THREE.MeshPhysicalMaterial({ color: 0x4f9e2c, roughness: 0.4, clearcoat: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xe0ffb0) });
export const rootMat = new THREE.MeshPhysicalMaterial({ color: 0xf2ead2, roughness: 0.5, clearcoat: 0.4, sheen: 0.5, sheenColor: new THREE.Color(0xffffff) });

// Lobed watermelon leaf in XY plane, petiole at origin, pointing +Y, cupped slightly
export function leafGeometry(lobes = true) {
  const s = new THREE.Shape();
  const N = 160;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const lobe = lobes ? 0.55 + 0.45 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.6) : 1;
    const r = (0.5 + 0.5 * Math.sin(a)) * lobe * 0.5 + 0.06;
    const x = Math.cos(a) * r * 0.9, y = Math.sin(a) * r + r * 0.9;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  const g = new THREE.ShapeGeometry(s, 24);
  const p = g.attributes.position, uv = g.attributes.uv;
  g.computeBoundingBox(); const bb = g.boundingBox;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i);
    uv.setXY(i, (x - bb.min.x) / (bb.max.x - bb.min.x), (y - bb.min.y) / (bb.max.y - bb.min.y));
    p.setZ(i, 0.12 * x * x * 4 - 0.05 * y + 0.03 * Math.sin(y * 9) ); }
  g.computeVertexNormals(); return g;
}
export function makeLeaf(lobes = true) { const m = new THREE.Mesh(leafGeometry(lobes), leafMat); m.castShadow = true; return m; }
const cotMat = new THREE.MeshPhysicalMaterial({ color: 0x8fd05a, side: THREE.DoubleSide, roughness: 0.4, clearcoat: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xe8ffc0) });
export function makeCotyledon() {
  const g = new THREE.SphereGeometry(0.5, 32, 16); g.scale(0.55, 1, 0.12); g.translate(0, 0.5, 0);
  const m = new THREE.Mesh(g, cotMat); m.castShadow = true; return m;
}

// Curly tendril points (helix that widens)
export function tendrilPoints(base, dir, len, turns, rad, seed = 1) {
  const r = rng(seed); const pts = [];
  const d = dir.clone().normalize(); const side = V(1, 0, 0).cross(d).lengthSq() < 0.01 ? V(0, 0, 1) : V(1, 0, 0).cross(d).normalize(); const up = d.clone().cross(side);
  for (let i = 0; i <= 40; i++) { const u = i / 40; const a = u * turns * Math.PI * 2; const rr = rad * smooth(u);
    pts.push(base.clone().addScaledVector(d, len * u).addScaledVector(side, Math.cos(a) * rr).addScaledVector(up, Math.sin(a) * rr)); }
  return pts;
}

// Mini watermelon fruit
export function makeMiniMelon() {
  const tex = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#3f8a2c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { g.fillStyle = '#1d4e19'; g.beginPath(); const x = i / 16 * w;
      for (let y = 0; y <= h; y += 8) g.lineTo(x + 9 * Math.sin(y * 0.09 + i), y); for (let y = h; y >= 0; y -= 8) g.lineTo(x + 14 + 9 * Math.sin(y * 0.09 + i + 1), y); g.fill(); } });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }));
  m.scale.set(1, 0.85, 0.85); m.castShadow = true; return m;
}
