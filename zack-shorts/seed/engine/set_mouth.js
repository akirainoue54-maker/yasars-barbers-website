import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { normalTex, pixelTex, canvasTex, fbm, noise3, rng, clamp, smooth, lerp, V } from './lib.js';
import { makeSlice, makeSeed, fleshChunk } from './melon.js';

// Wet tissue normal map (folds + fine papillae), tileable-ish
export const tissueNormal = normalTex(512, 512, (u, v) =>
  fbm(u * 6, v * 6, 0.5, 4) * 0.8 + 0.25 * Math.pow(Math.abs(noise3(u * 40, v * 40, 2)), 0.5), 3.0, { repeat: true });
export function tissueMat(color = 0xd9606a, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.5, clearcoat: 1.0, clearcoatRoughness: 0.05, sheen: 0.6, sheenColor: new THREE.Color(0xff6a70), sheenRoughness: 0.4,
    normalMap: tissueNormal, normalScale: new THREE.Vector2(0.8, 0.8), side: THREE.DoubleSide, ...opts,
  });
}

// Tube with explicit frames for a path lying in the YZ plane (side vector = +X).
export class Tunnel {
  constructor(points, { rings = 420, radial = 56, rx, ry, mat }) {
    this.curve = new THREE.CatmullRomCurve3(points.map((p) => V(0, p[0], p[1])), false, 'centripetal');
    this.rings = rings; this.radial = radial; this.rx = rx; this.ry = ry;
    const n = (rings + 1) * (radial + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const uv = new Float32Array(n * 2); const len = this.curve.getLength();
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; uv[k * 2] = j / radial * 3; uv[k * 2 + 1] = i / rings * len * 1.2; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < rings; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    geo.setIndex(idx);
    const col = new Float32Array(n * 3);
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j, th = j / radial * Math.PI * 2, u = i / rings;
      const m = 0.8 + 0.3 * fbm(u * 40, Math.cos(th) * 2, Math.sin(th) * 2, 3);
      const vein = Math.pow(Math.abs(Math.sin(u * 90 + 3 * fbm(u * 10, Math.cos(th), Math.sin(th), 2))), 30) * 0.25;
      col[k * 3] = m * (1 - vein * 0.2); col[k * 3 + 1] = m * (1 - vein); col[k * 3 + 2] = m * (1 - vein * 0.8);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geo = geo; this.mesh = new THREE.Mesh(geo, mat); this.mesh.receiveShadow = true;
    this.C = []; this.T = []; this.U = [];
    for (let i = 0; i <= rings; i++) {
      const u = i / rings, c = this.curve.getPointAt(u), t = this.curve.getTangentAt(u);
      const side = V(1, 0, 0), up = side.clone().cross(t).normalize();
      this.C.push(c); this.T.push(t); this.U.push(up);
    }
    this.update(() => 1);
  }
  // squeeze(u, theta) -> radius multiplier (animated constrictions)
  update(squeeze) {
    const p = this.geo.attributes.position;
    for (let i = 0; i <= this.rings; i++) {
      const u = i / this.rings, c = this.C[i], up = this.U[i];
      for (let j = 0; j <= this.radial; j++) {
        const th = (j / this.radial) * Math.PI * 2;
        const wob = 1 + 0.06 * noise3(u * 30, Math.cos(th) * 1.5, Math.sin(th) * 1.5) + 0.03 * Math.sin(u * 160 + th * 2);
        const s = squeeze(u, th) * wob;
        const x = Math.cos(th) * this.rx(u, th) * s, y = Math.sin(th) * this.ry(u, th) * s;
        const k = i * (this.radial + 1) + j;
        p.setXYZ(k, c.x + x, c.y + up.y * y, c.z + up.z * y);
      }
    }
    p.needsUpdate = true; this.geo.computeVertexNormals();
  }
  // point inside the tube at parameter u, offset in local cross-section coordinates
  nearestU(p) { let best = 0, bd = 1e9; for (let i = 0; i <= this.rings; i++) { const d = this.C[i].distanceTo(p); if (d < bd) { bd = d; best = i / this.rings; } } return best; }
  at(u, ox = 0, oy = 0) {
    u = clamp(u, 0, 1);
    const c = this.curve.getPointAt(u), t = this.curve.getTangentAt(u), up = V(1, 0, 0).cross(t).normalize();
    return c.clone().add(V(ox, 0, 0)).add(up.multiplyScalar(oy));
  }
}

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

// Bright blurred kitchen behind the mouth opening (baked bokeh = depth of field look)
export function kitchenBackdrop() {
  const tex = canvasTex(1024, 1600, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#fff4e2'); bg.addColorStop(0.45, '#f7e3c8'); bg.addColorStop(1, '#d9b896');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // window glow
    const wg = g.createRadialGradient(w * 0.28, h * 0.25, 10, w * 0.28, h * 0.25, w * 0.6); wg.addColorStop(0, 'rgba(255,255,250,1)'); wg.addColorStop(1, 'rgba(255,250,235,0)');
    g.fillStyle = wg; g.fillRect(0, 0, w, h);
    g.filter = 'blur(28px)';
    g.fillStyle = 'rgba(120,170,140,0.55)'; g.fillRect(w * 0.62, h * 0.12, w * 0.3, h * 0.33); // plant / cabinet
    g.fillStyle = 'rgba(190,140,100,0.7)'; g.fillRect(0, h * 0.62, w, h * 0.06); // counter edge
    g.fillStyle = 'rgba(240,240,235,0.9)'; g.beginPath(); g.ellipse(w * 0.5, h * 0.8, w * 0.42, h * 0.06, 0, 0, 7); g.fill(); // plate
    g.filter = 'none';
    const r = rng(9);
    for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h * 0.6, s = 20 + r() * 60;
      const bk = g.createRadialGradient(x, y, 0, x, y, s); bk.addColorStop(0, 'rgba(255,250,235,0.55)'); bk.addColorStop(0.85, 'rgba(255,245,225,0.35)'); bk.addColorStop(1, 'rgba(255,245,225,0)');
      g.fillStyle = bk; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 25), new THREE.MeshBasicMaterial({ map: tex, color: 0x8a7868 }));
  return m;
}

export function buildMouth() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a2a22);
  const g = new THREE.Group(); scene.add(g);
  // mouth cavity -> pharynx -> esophagus, path in (y, z)
  const pts = [[0.0, 0.42], [0.0, 0.0], [0.03, -0.7], [0.0, -1.45], [-0.2, -2.1], [-0.65, -2.6], [-1.4, -2.95], [-2.4, -3.12], [-3.8, -3.2], [-6.0, -3.22], [-8.5, -3.22], [-11, -3.22]];
  const total = pts.length;
  const rx = (u) => { const m = smooth(clamp((u - 0.12) / 0.16)); return lerp(0.64, 0.42, m) * (1 - 0.35 * smooth(clamp((u - 0.27) / 0.12))) + 0.0; };
  const ry = (u) => { const m = smooth(clamp((u - 0.12) / 0.16)); return lerp(0.52, 0.4, m) * (1 - 0.35 * smooth(clamp((u - 0.27) / 0.12))); };
  const tunnel = new Tunnel(pts, { rx, ry, mat: tissueMat(0xe06a70, { vertexColors: true }) });
  g.add(tunnel.mesh); tunnel.mesh.receiveShadow = false;
  // tongue
  const tg = new THREE.SphereGeometry(1, 96, 64);
  { const p = tg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i);
      let y = v.y; if (y > 0) y *= 1 - 0.18 * Math.exp(-v.x * v.x * 40); // midline groove
      p.setXYZ(i, v.x * 0.5, y * 0.2, v.z * 1.0); }
    tg.computeVertexNormals(); }
  const papillae = normalTex(512, 512, (u, v) => Math.pow(Math.abs(noise3(u * 90, v * 90, 4)), 0.6) * 0.7 + fbm(u * 8, v * 8, 1, 3) * 0.3, 4.0, { repeat: true });
  const tongueCol = pixelTex(512, 512, (u, v) => { const d = Math.pow(Math.abs(noise3(u * 90, v * 90, 4)), 0.5); const n = fbm(u * 6, v * 6, 2, 3);
    return [lerp(196, 236, d) + n * 20, lerp(84, 120, d) + n * 10, lerp(96, 128, d) + n * 10]; }, { repeat: true });
  tongueCol.repeat.set(5, 9);
  const tongueMat = new THREE.MeshPhysicalMaterial({ map: tongueCol, color: 0xffffff, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.8, sheenColor: new THREE.Color(0xffb0b8), normalMap: papillae, normalScale: new THREE.Vector2(0.7, 0.7) });
  papillae.repeat.set(5, 9); tongueMat.normalScale.set(1.1, 1.1);
  const tongue = new THREE.Mesh(tg, tongueMat); tongue.position.set(0, -0.36, -0.82); tongue.receiveShadow = true; tongue.castShadow = true; g.add(tongue);
  // uvula
  const ug = new THREE.SphereGeometry(0.08, 32, 24); { const p = ug.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 - 0.45 * clamp((y + 0.08) / 0.16); p.setXYZ(i, p.getX(i) * k * 0.9, y * 2.0, p.getZ(i) * k * 0.8); } ug.computeVertexNormals(); }
  const uv = new THREE.Mesh(ug, tissueMat(0xd85866)); uv.position.set(0, 0.2, -2.0); g.add(uv);
  // teeth
  const upper = makeArch(true), lower = makeArch(false);
  upper.position.set(0, 0.16, 0); lower.position.set(0, -0.2, 0.0);
  g.add(upper, lower);
  // lips at the opening (ellipse ring)
  const lp = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; lp.push(V(Math.cos(a) * 0.7, Math.sin(a) * 0.55, 0.42 + 0.04 * Math.cos(a * 2))); }
  const lips = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp, true), 200, 0.14, 24, true),
    new THREE.MeshPhysicalMaterial({ color: 0xc8505c, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 1, sheenColor: new THREE.Color(0xffb6b6), normalMap: tissueNormal, normalScale: new THREE.Vector2(0.3, 0.3) }));
  g.add(lips);
  // outside world
  const back = kitchenBackdrop(); back.position.set(0, 0.5, 6.5); back.rotation.y = Math.PI; scene.add(back);
  const slice = makeSlice(); slice.scale.setScalar(1.25); scene.add(slice);
  // the swallowed seed (travels by itself) + small flesh bits
  const seed = makeSeed(0.105); seed.castShadow = false; scene.add(seed);
  const chunk = fleshChunk(5); chunk.scale.setScalar(0.55); chunk.castShadow = false; scene.add(chunk);
  // lights
  scene.add(new THREE.HemisphereLight(0xfff2e6, 0x5a1a20, 0.18));
  const outside = new THREE.DirectionalLight(0xfff3e0, 4.0); outside.position.set(1.5, 2.5, 6); outside.target.position.set(0, 0, -1);
  outside.castShadow = true; outside.shadow.mapSize.set(2048, 2048); Object.assign(outside.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 }); outside.shadow.bias = -0.0005;
  scene.add(outside, outside.target);
  const camLight = new THREE.PointLight(0xfff4ee, 3.0, 4, 1.8); scene.add(camLight);
  const fill = new THREE.PointLight(0xffc8b8, 1.4, 3, 2); fill.position.set(0, 0.2, -1.2); scene.add(fill);
  return { scene, tunnel, tongue, upper, lower, lips, slice, seed, chunk, camLight, fill, back, outside, uv };
}
