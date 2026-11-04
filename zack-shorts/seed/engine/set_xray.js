import * as THREE from 'three';
import { canvasTex, rng, clamp, smooth, lerp, V, fbm, varTube } from './lib.js';
import { makeSeed } from './melon.js';
import { glow, Sparkles } from './fx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// translucent "x-ray glass" with fresnel rim
export function xrayMat(color, { rim = 0xffffff, alpha = 0.12, rimAlpha = 0.85, power = 2.0, inner = 0.0 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending,
    uniforms: { c: { value: new THREE.Color(color) }, r: { value: new THREE.Color(rim) }, a: { value: alpha }, ra: { value: rimAlpha }, p: { value: power }, inner: { value: inner } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 c; uniform vec3 r; uniform float a; uniform float ra; uniform float p; uniform float inner; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), p);
        vec3 col = mix(c, r, f); float al = a + ra*f + inner;
        gl_FragColor = vec4(col, clamp(al,0.0,1.0)); }`,
  });
}

// random-walk curve packed inside a box (small intestine), smoothed -> irregular, not accordion
export function gutCurve(seed, n, box, start) {
  const r = rng(seed); const pts = [start.clone()]; let dir = V(1, -0.3, 0.2).normalize(); let p = start.clone();
  for (let i = 0; i < n; i++) {
    dir.add(V(r() - 0.5, r() - 0.5, (r() - 0.5) * 0.6).multiplyScalar(1.4)).normalize();
    let q = p.clone().addScaledVector(dir, box.step * (0.7 + r() * 0.6));
    // keep inside box: steer back toward centre
    const c = box.center; const d = q.clone().sub(c);
    if (Math.abs(d.x) > box.hx || Math.abs(d.y) > box.hy || Math.abs(d.z) > box.hz) { dir.lerp(c.clone().sub(p).normalize(), 0.75).normalize(); q = p.clone().addScaledVector(dir, box.step); }
    pts.push(q); p = q;
  }
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
}

export function buildXray() {
  const scene = new THREE.Scene();
  const bgTex = canvasTex(1080, 1920, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * 0.45, 50, w / 2, h * 0.5, h * 0.75); gr.addColorStop(0, '#1f6fae'); gr.addColorStop(1, '#06162e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,200,255,0.10)'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  scene.background = bgTex;
  const body = new THREE.Group(); scene.add(body);
  // torso + shoulders + neck silhouette
  const prof = []; for (let i = 0; i <= 50; i++) { const y = -1.9 + i / 50 * 4.1; let r = 0.95 + 0.07 * Math.exp(-Math.pow((y + 0.1) / 0.6, 2)) - 0.1 * Math.exp(-Math.pow((y - 0.6) / 0.4, 2)) + 0.25 * smooth(clamp((y - 0.9) / 0.6)) - 0.95 * smooth(clamp((y - 1.75) / 0.35)) + 0.12 * smooth(clamp((-y - 1.2) / 0.5));
    prof.push(new THREE.Vector2(Math.max(0.28, r), y)); }
  const tg = new THREE.LatheGeometry(prof, 96); tg.scale(1.05, 1, 0.68);
  body.add(new THREE.Mesh(tg, xrayMat(0x9fe6ff, { alpha: 0.06, rimAlpha: 0.8, power: 2.2 })));
  const boneM = xrayMat(0xe8f8ff, { alpha: 0.22, rimAlpha: 0.7, power: 1.4 });
  // spine
  for (let i = 0; i < 17; i++) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.13, 20), boneM); v.position.set(0, -1.3 + i * 0.17, -0.38); body.add(v); }
  // ribs
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
    const y = 1.5 - i * 0.17; const w = 0.62 + 0.28 * Math.sin(Math.PI * (i + 2) / 11); const pts = [];
    for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 0.85; pts.push(V(s * (0.08 + Math.sin(a) * w), y + 0.1 * Math.sin(a * 1.2) - 0.55 * Math.pow(k / 16, 1.6), -0.38 + (1 - Math.cos(a)) * 0.48)); }
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.022, 8), boneM));
  }
  // pelvis wings
  for (const s of [-1, 1]) { const pts = []; for (let k = 0; k <= 14; k++) { const a = k / 14 * Math.PI; pts.push(V(s * (0.25 + 0.55 * Math.sin(a * 0.5)), -1.35 + 0.35 * Math.sin(a), -0.2 + 0.25 * Math.cos(a))); }
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.07, 10), boneM)); }
  // stomach: J-shaped bag on the body's left (screen right)
  const stC = new THREE.CatmullRomCurve3([V(0.12, 1.05, -0.05), V(0.38, 0.85, 0.05), V(0.48, 0.5, 0.1), V(0.35, 0.22, 0.12), V(0.05, 0.18, 0.1), V(-0.15, 0.26, 0.08)]);
  const stomach = new THREE.Mesh(varTube(stC, 80, 24, (u) => 0.1 + 0.26 * Math.sin(Math.PI * Math.pow(u, 0.8)) * (1 - 0.4 * u)), xrayMat(0xffa0a8, { alpha: 0.2, rimAlpha: 0.75, rim: 0xffe0e4, power: 1.6 }));
  body.add(stomach);
  // small intestine coil in lower abdomen, entering from the duodenum
  const duo = [V(-0.15, 0.26, 0.08), V(-0.32, 0.12, 0.1), V(-0.28, -0.08, 0.15)];
  const coil = gutCurve(77, 70, { center: V(0, -0.55, 0.12), hx: 0.5, hy: 0.4, hz: 0.18, step: 0.16 }, duo[2]);
  const sPts = [...duo, ...coil.points.slice(1)];
  const small = new THREE.CatmullRomCurve3(sPts, false, 'centripetal');
  const smallMesh = new THREE.Mesh(new THREE.TubeGeometry(small, 900, 0.065, 12), xrayMat(0xffb38a, { alpha: 0.18, rimAlpha: 0.75, rim: 0xfff0d8, power: 1.5 }));
  body.add(smallMesh);
  // large intestine frame
  const lC = new THREE.CatmullRomCurve3([V(-0.25, -1.15, 0.12), V(-0.62, -0.95, 0.08), V(-0.68, -0.1, 0.0), V(-0.45, 0.12, 0.05), V(0.0, 0.05, 0.14), V(0.45, 0.12, 0.05), V(0.68, -0.1, 0.0), V(0.62, -0.95, 0.06), V(0.2, -1.2, 0.0), V(0.0, -1.35, -0.1)]);
  body.add(new THREE.Mesh(varTube(lC, 300, 16, (u) => 0.11 + 0.015 * Math.sin(u * 120)), xrayMat(0xff9f7a, { alpha: 0.16, rimAlpha: 0.7, rim: 0xffe8d0, power: 1.5 })));
  // the seed + highlight ring
  const seed = makeSeed(0.07); scene.add(seed);
  seed.material = new THREE.MeshBasicMaterial({ color: 0x050302 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.085, 0.105, 64), new THREE.MeshBasicMaterial({ color: 0xffe03a, transparent: true, depthTest: false }));
  ring.renderOrder = 10; scene.add(ring);
  const halo = glow('#fff2a0', 0.35); halo.renderOrder = 9; halo.material.depthTest = false; scene.add(halo);
  return { scene, body, stC, small, seed, ring, halo };
}

// Close-up translucent gut with food travelling alongside the seed
export function buildGut() {
  const scene = new THREE.Scene();
  const bgTex = canvasTex(1080, 1920, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * 0.45, 50, w / 2, h * 0.5, h * 0.8); gr.addColorStop(0, '#2a7cbc'); gr.addColorStop(1, '#071a36');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.background = bgTex;
  // irregular curve in 3D (random bends, varying radius of curvature)
  const r = rng(5); const pts = []; let p = V(0, 0, 0), dir = V(1, 0, 0);
  for (let i = 0; i < 46; i++) { dir.add(V((r() - 0.5) * 1.3, (r() - 0.5) * 1.3, (r() - 0.5) * 0.9)).normalize(); p = p.clone().addScaledVector(dir, 0.9 + r() * 0.8); pts.push(p); }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const R = 0.42;
  // irregular (noise) radius: soft bulges and pinches, never a regular ring pattern
  const wall = new THREE.Mesh(varTube(curve, 1600, 48, (u) => (th) => R * (1 + 0.16 * fbm(u * 9, 0.5, 1.7, 3) + 0.05 * fbm(u * 40, Math.cos(th) * 0.8, Math.sin(th) * 0.8, 2))),
    xrayMat(0xffb08a, { alpha: 0.14, rimAlpha: 0.8, rim: 0xfff3e0, power: 1.7 }));
  scene.add(wall);
  // inner folds (circular rings) for texture
  // second, inner translucent layer for depth (no rings)
  scene.add(new THREE.Mesh(varTube(curve, 1600, 40, (u) => R * 0.9 * (1 + 0.16 * fbm(u * 9, 0.5, 1.7, 3))), xrayMat(0xff9a7a, { alpha: 0.05, rimAlpha: 0.35, rim: 0xffd8c0, power: 2.5 })));
  // food bits
  const foodCols = [0xe8c48a, 0x8cc850, 0xf09a40, 0xd9a070, 0xf0e0b0, 0xc86a50];
  const food = []; const fr = rng(9);
  for (let i = 0; i < 150; i++) {
    const g = new THREE.IcosahedronGeometry(0.08 + fr() * 0.08, 5); const pp = g.attributes.position; const v = new THREE.Vector3();
    for (let k = 0; k < pp.count; k++) { v.fromBufferAttribute(pp, k); v.multiplyScalar(1 + 0.3 * fbm(v.x * 5 + i, v.y * 5, v.z * 5, 2)); pp.setXYZ(k, v.x, v.y, v.z); } g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: foodCols[i % foodCols.length], roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15, transparent: true, opacity: 0.82, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }));
    food.push({ m, u0: fr() * 0.9, ox: (fr() - 0.5) * 0.45, oy: (fr() - 0.5) * 0.45, spin: fr() * 3 }); scene.add(m);
  }
  const seed = makeSeed(0.16); scene.add(seed);
  const halo = glow('#fff3a0', 0.6); halo.material.opacity = 0.5; scene.add(halo);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.218, 64), new THREE.MeshBasicMaterial({ color: 0xffe03a, transparent: true, depthTest: false, side: THREE.DoubleSide }));
  ring.renderOrder = 10; scene.add(ring);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88aacc, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(2, 3, 4); scene.add(key);
  const camLight = new THREE.PointLight(0xffffff, 4, 5, 1.6); scene.add(camLight);
  return { scene, curve, R, food, seed, halo, ring, camLight };
}
