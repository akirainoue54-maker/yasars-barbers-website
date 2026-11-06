import * as THREE from 'three';

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (x) => x * x * (3 - 2 * x);
export const ease = {
  linear: (x) => x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
};
// value from t over [t0,t1] with easing, 0..1
export const seg = (t, t0, t1, e = ease.inOut) => e(inv(t0, t1, t));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 3D gradient noise (Perlin-style), deterministic
const P = new Uint8Array(512);
{ const r = rng(1337); const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
export function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(lerp(lerp(grad(P[AA] & 15, x, y, z), grad(P[BA] & 15, x - 1, y, z), u),
    lerp(grad(P[AB] & 15, x, y - 1, z), grad(P[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad(P[AA + 1] & 15, x, y, z - 1), grad(P[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(grad(P[AB + 1] & 15, x, y - 1, z - 1), grad(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}
export const fbm = (x, y, z, oct = 4) => { let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); a *= 0.5; f *= 2; } return s; };

// Keyframed vec3 track with Catmull-Rom through points, time eased per segment
export function track(keys) {
  // keys: [[t, [x,y,z]], ...]
  const pts = keys.map((k) => new THREE.Vector3(...k[1]));
  return (t) => {
    if (t <= keys[0][0]) return pts[0].clone();
    if (t >= keys[keys.length - 1][0]) return pts[pts.length - 1].clone();
    let i = 0; while (keys[i + 1][0] < t) i++;
    const u = ease.inOutSine(inv(keys[i][0], keys[i + 1][0], t));
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const u2 = u * u, u3 = u2 * u;
    return new THREE.Vector3(
      0.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
      0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
      0.5 * (2 * p1.z + (-p0.z + p2.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3));
  };
}
// scalar keyframes, eased between keys
export function ktrack(keys, e = ease.inOut) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
    let i = 0; while (keys[i + 1][0] < t) i++;
    return lerp(keys[i][1], keys[i + 1][1], e(inv(keys[i][0], keys[i + 1][0], t)));
  };
}

// ---------- textures ----------
export function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
// fill image pixels from function f(u,v) -> [r,g,b] 0..255
export function pixelTex(w, h, f, opts) {
  return canvasTex(w, h, (g) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = f((x + 0.5) / w, 1 - (y + 0.5) / h); const i = (y * w + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = c[3] ?? 255;
    }
    g.putImageData(img, 0, 0);
  }, opts);
}
// tangent-space normal map from height function hgt(u,v) (tileable if function is)
export function normalTex(w, h, hgt, strength = 2, opts = {}) {
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = hgt((x + 0.5) / w, 1 - (y + 0.5) / h);
  return pixelTex(w, h, (u, v) => {
    const x = Math.floor(u * w), y = Math.floor((1 - v) * h);
    const at = (xx, yy) => H[((yy + h) % h) * w + ((xx + w) % w)];
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const n = new THREE.Vector3(-dx, dy, 1).normalize();
    return [(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255];
  }, { srgb: false, ...opts });
}

// soft radial sprite for particles / glows
export function glowTex(color = '#ffffff') {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, color); gr.addColorStop(0.35, color + 'aa'); gr.addColorStop(1, color + '00');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// ---------- geometry helpers ----------
// displace vertices along normals by f(pos) (in place)
export function displace(geo, f) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i);
    const d = f(v, nn); p.setXYZ(i, v.x + nn.x * d, v.y + nn.y * d, v.z + nn.z * d);
  }
  p.needsUpdate = true; geo.computeVertexNormals(); return geo;
}
// tube with per-point radius function r(u) along curve
export function varTube(curve, segs, radial, rfun, closed = false) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, closed);
  const p = g.attributes.position, v = new THREE.Vector3();
  const frames = curve.computeFrenetFrames(segs, closed);
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, c = curve.getPointAt(u), r = rfun(u, i);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(typeof r === 'function' ? r(j / radial) : r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  p.needsUpdate = true; g.computeVertexNormals(); return g;
}

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
