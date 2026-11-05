import * as THREE from 'three';
import { clamp, lerp, smooth, rng, canvasTex, V, varTube, fbm, noise3, ease, seg } from './lib.js';
import { bubbleMaterial, glow, starTex } from './fx.js';
import { makeTooth } from './tooth.js';

// translucent "x-ray glass" with a fresnel rim
export function xrayMat(color, { rim = 0xffffff, alpha = 0.12, rimAlpha = 0.85, power = 2.0 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { c: { value: new THREE.Color(color) }, r: { value: new THREE.Color(rim) }, a: { value: alpha }, ra: { value: rimAlpha }, p: { value: power } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 c; uniform vec3 r; uniform float a; uniform float ra; uniform float p; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0-abs(dot(normalize(vN),normalize(vV))), p); gl_FragColor = vec4(mix(c, r, f), clamp(a + ra*f, 0.0, 1.0)); }`,
  });
}

const bgTex = (inner, outer) => canvasTex(512, 900, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.5, h * 0.72); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// ---------------------------------------------------------------------------------------------
// Stomach (x-ray, filled with acid) - the bottom half of the split screen
// ---------------------------------------------------------------------------------------------
export function buildStomachHalf(env) {
  const scene = new THREE.Scene();
  scene.background = bgTex('#1c7ba3', '#06202f');
  const g = new THREE.Group(); scene.add(g);
  const centre = new THREE.CatmullRomCurve3([V(-0.25, 1.05, 0), V(-0.62, 0.5, 0.02), V(-0.7, -0.15, 0), V(-0.38, -0.7, 0), V(0.25, -0.88, 0), V(0.82, -0.58, 0), V(1.0, -0.12, 0)], false, 'centripetal');
  const rad = (u) => 0.12 + 0.72 * Math.pow(Math.sin(Math.PI * Math.pow(clamp(u), 0.75)), 0.6) * (1 - 0.35 * u);
  const wall = new THREE.Mesh(varTube(centre, 140, 48, (u) => rad(u)), xrayMat(0xff8a9c, { alpha: 0.26, rimAlpha: 0.85, rim: 0xffe0e6, power: 1.5 }));
  const acid = new THREE.Mesh(varTube(centre, 140, 40, (u) => rad(u) * 0.92), xrayMat(0xa8f000, { alpha: 0.62, rimAlpha: 0.5, rim: 0xeaff80, power: 1.3 }));
  g.add(acid, wall);
  // esophagus (top) and duodenum (right)
  const eso = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.45, 2.45, 0), V(-0.36, 1.8, 0), V(-0.25, 1.05, 0)]), 30, 0.15, 20, false), xrayMat(0xff8a9c, { alpha: 0.26, rimAlpha: 0.85, rim: 0xffe0e6 }));
  const duo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(1.0, -0.12, 0), V(1.3, 0.1, 0), V(1.55, 0.5, 0)]), 30, 0.13, 20, false), xrayMat(0xffb38a, { alpha: 0.2, rimAlpha: 0.8, rim: 0xfff0d8 }));
  g.add(eso, duo);
  // folds hint: a few translucent ridges along the wall
  const ridgeM = xrayMat(0xffc0c8, { alpha: 0.0, rimAlpha: 0.55, rim: 0xffffff, power: 1.0 });
  for (let k = 0; k < 0; k++) { const off = (k - 2.5) * 0.17; const pts = []; for (let i = 0; i <= 40; i++) { const u = 0.1 + 0.8 * i / 40; const c = centre.getPointAt(u); pts.push(V(c.x + off * 0.4, c.y + off * 0.25, c.z + rad(u) * 0.9)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.012, 6, false), ridgeM)); }
  // acid fizz bubbles that stay inside the stomach outline
  const NB = 170, r = rng(9);
  const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), bubbleMaterial(0xf2ffb0), NB); bm.frustumCulled = false; bm.renderOrder = 6; g.add(bm);
  const bd = [...Array(NB)].map(() => ({ u: 0.12 + r() * 0.76, ox: (r() - 0.5) * 1.5, oz: (r() - 0.5), ph: r(), sp: 0.12 + r() * 0.25, s: 0.028 + r() * 0.045 }));
  const dm = new THREE.Object3D();
  const halo = glow('#d6ff4a', 5.0); halo.position.set(0.1, 0, -0.5); halo.material.opacity = 0.35; scene.add(halo);
  scene.add(new THREE.HemisphereLight(0xcfeaff, 0x203040, 0.8));
  g.scale.setScalar(0.8); g.position.set(0, -0.2, 0);
  const S = { scene, g, wall, acid, centre, rad, bm, bd, dm, halo };
  S.update = (t) => {
    for (let i = 0; i < NB; i++) {
      const b = bd[i]; const c = centre.getPointAt(b.u); const R = rad(b.u) * 0.75; const k = (b.ph + t * b.sp) % 1;
      dm.position.set(c.x + b.ox * R, c.y + (k - 0.5) * 2 * R * 0.9, c.z + b.oz * R * 0.5);
      dm.scale.setScalar(b.s * Math.sin(Math.PI * k)); dm.updateMatrix(); bm.setMatrixAt(i, dm.matrix);
    }
    bm.instanceMatrix.needsUpdate = true;
    g.rotation.y = 0.45 * Math.sin(t * 0.55); g.rotation.z = 0.04 * Math.sin(t * 0.9);
    const sq = 1 + 0.035 * Math.sin(t * 2.4); wall.scale.set(sq, 1 + 0.02 * Math.sin(t * 2.4 + 1), sq); acid.scale.copy(wall.scale);
    halo.material.opacity = 0.3 + 0.1 * Math.sin(t * 2.2);
  };
  return S;
}

// ---------------------------------------------------------------------------------------------
// Mucus cross-section: acid rains onto a thick, constantly renewed gel layer above epithelial cells
// ---------------------------------------------------------------------------------------------
export const MUC = { top: 0.75, bottom: -0.75, cellTop: -0.9 };

export function buildMucus(env) {
  const scene = new THREE.Scene();
  scene.background = bgTex('#1d6f9c', '#05182a');
  const root = new THREE.Group(); scene.add(root);
  const r = rng(404);
  // tissue below the cells
  const tissue = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 2.0), new THREE.MeshPhysicalMaterial({ color: 0xc8506a, roughness: 0.5, clearcoat: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0xff9ab0) }));
  tissue.position.set(0, -2.8, 0); root.add(tissue);
  // columnar epithelial cells (+ nuclei)
  const NC = 26, cw = 0.35;
  const cellGeo = new THREE.CapsuleGeometry(0.15, 0.55, 8, 16);
  const cells = new THREE.InstancedMesh(cellGeo, new THREE.MeshPhysicalMaterial({ color: 0xff9db0, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 1, sheenColor: new THREE.Color(0xffd0da), transparent: true, opacity: 0.95 }), NC * 2);
  const nuclei = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0x8a2a58, roughness: 0.4, clearcoat: 0.8 }), NC * 2);
  const dm = new THREE.Object3D();
  for (let row = 0; row < 2; row++) for (let i = 0; i < NC; i++) {
    const k = row * NC + i; const x = -4.5 + i * cw + (row ? cw * 0.5 : 0) + (r() - 0.5) * 0.04; const z = row ? -0.35 : 0.1 + (r() - 0.5) * 0.1;
    dm.position.set(x, MUC.cellTop - 0.4 + (r() - 0.5) * 0.05, z); dm.scale.set(1, 1 + (r() - 0.5) * 0.12, 1); dm.updateMatrix(); cells.setMatrixAt(k, dm.matrix);
    dm.position.set(x + (r() - 0.5) * 0.04, MUC.cellTop - 0.62, z + 0.1); dm.scale.setScalar(1); dm.updateMatrix(); nuclei.setMatrixAt(k, dm.matrix);
  }
  cells.castShadow = false; root.add(cells, nuclei);
  // mucus gel slab: animated wavy top, soft glowing sides
  const slabMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float time; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){ float f = pow(1.0-abs(dot(normalize(vN),normalize(vV))), 1.6);
        float band = 0.5+0.5*sin(vP.y*9.0 - time*2.4 + sin(vP.x*3.0+time)*1.2);
        float k = clamp((vP.y + 0.75)/1.5, 0.0, 1.0);
        vec3 deep = vec3(0.1,0.55,0.8), light = vec3(0.55,0.95,1.0);
        vec3 c = mix(deep, light, k*0.7 + band*0.25) + f*0.35;
        gl_FragColor = vec4(c, clamp(0.28 + 0.2*band + 0.45*f, 0.0, 0.92)); }`,
  });
  const slabGeo = new THREE.BoxGeometry(9, MUC.top - MUC.bottom, 1.6, 90, 12, 4);
  const slab = new THREE.Mesh(slabGeo, slabMat); slab.position.y = (MUC.top + MUC.bottom) / 2; slab.renderOrder = 2; root.add(slab);
  slabGeo.userData.rest = Float32Array.from(slabGeo.attributes.position.array);
  const topGlow = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.08), new THREE.MeshBasicMaterial({ color: 0xe8ffff, transparent: true, opacity: 0.8 })); topGlow.position.set(0, MUC.top + 0.01, 0.82); root.add(topGlow);
  // acid droplets raining into the lumen (turn pale and vanish inside the gel)
  const NA = 170;
  const acid = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), NA); acid.frustumCulled = false; root.add(acid);
  acid.setColorAt(0, new THREE.Color(1, 1, 1));
  const ad = [...Array(NA)].map(() => ({ x: -3.3 + r() * 6.6, z: -0.5 + r() * 1.1, ph: r(), sp: 0.34 + r() * 0.3, s: 0.045 + r() * 0.05, w: r() * 6 }));
  const lime = new THREE.Color(0xdcff3a), pale = new THREE.Color(0xd8f6ff), col = new THREE.Color();
  // bicarbonate bubbles rising from the cells into the lower gel
  const NBI = 90;
  const bic = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), bubbleMaterial(0xa8ecff), NBI); bic.frustumCulled = false; root.add(bic);
  const bid = [...Array(NBI)].map(() => ({ x: -3.6 + r() * 7.2, z: -0.4 + r() * 1.0, ph: r(), sp: 0.22 + r() * 0.3, s: 0.025 + r() * 0.04 }));
  // fresh gel globules secreted by the cells (white-cyan, glowing), merging into the layer
  const NG = 60;
  const gel = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xcffcff, transparent: true, opacity: 0.85 }), NG); gel.frustumCulled = false; root.add(gel);
  const gd = [...Array(NG)].map(() => ({ x: -3.9 + r() * 7.8, z: -0.4 + r() * 0.9, ph: r(), sp: 0.16 + r() * 0.16, s: 0.035 + r() * 0.05 }));
  // old mucus flaking off the top surface
  const NF = 46;
  const flake = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.55), new THREE.MeshBasicMaterial({ color: 0xcdf2ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }), NF); flake.frustumCulled = false; root.add(flake);
  const fd = [...Array(NF)].map(() => ({ x: -3.8 + r() * 7.6, z: -0.3 + r() * 0.8, ph: r(), sp: 0.12 + r() * 0.16, s: 0.1 + r() * 0.12, rot: r() * 6, w: r() * 4 }));
  const halo = glow('#8ee6ff', 8); halo.position.set(0, 0.2, -2); halo.material.opacity = 0.18; scene.add(halo);
  scene.add(new THREE.HemisphereLight(0xdff4ff, 0x4a2030, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-2, 4, 5); scene.add(key);
  const S = { scene, root, slab, slabMat, acid, bic, gel, flake, cells, nuclei };
  S.update = (t) => {
    slabMat.uniforms.time.value = t;
    // wavy top surface (the layer is alive)
    const p = slabGeo.attributes.position, rest = slabGeo.userData.rest;
    for (let i = 0; i < p.count; i++) { const x = rest[i * 3], y = rest[i * 3 + 1];
      const topK = smooth(clamp((y - 0.25) / 0.5)); p.setY(i, y + topK * (0.07 * Math.sin(x * 2.3 + t * 1.6) + 0.04 * Math.sin(x * 5.1 - t * 2.1) + 0.03 * noise3(x * 1.2, t * 0.5, 0))); }
    p.needsUpdate = true; slabGeo.computeVertexNormals();
    const yTop = MUC.top + 0.04;
    for (let i = 0; i < NA; i++) {
      const a = ad[i]; const k = ((a.ph + t * a.sp * 0.5) % 1 + 1) % 1; let y, sc, m;
      if (k < 0.62) { const u = k / 0.62; y = lerp(3.5, yTop, Math.pow(u, 1.5)); sc = a.s; m = 0; }
      else { const u = (k - 0.62) / 0.38; y = yTop - u * 0.55; sc = a.s * (1 - smooth(u) * 0.95); m = smooth(clamp(u * 1.6)); }
      dm.position.set(a.x + 0.05 * Math.sin(t * 1.5 + a.w), y, a.z); dm.scale.set(sc, sc * (k < 0.62 ? 1.5 : 1), sc); dm.updateMatrix(); acid.setMatrixAt(i, dm.matrix);
      col.copy(lime).lerp(pale, m); acid.setColorAt(i, col);
    }
    acid.instanceMatrix.needsUpdate = true; acid.instanceColor.needsUpdate = true;
    for (let i = 0; i < NBI; i++) { const b = bid[i]; const k = (b.ph + t * b.sp) % 1; dm.position.set(b.x + 0.04 * Math.sin(t * 2 + i), MUC.cellTop + 0.05 + k * 1.55, b.z); dm.scale.setScalar(b.s * Math.sin(Math.PI * k)); dm.updateMatrix(); bic.setMatrixAt(i, dm.matrix); }
    bic.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NG; i++) { const q = gd[i]; const k = (q.ph + t * q.sp) % 1; dm.position.set(q.x, MUC.cellTop + 0.02 + k * (MUC.top - MUC.cellTop - 0.05), q.z); dm.scale.setScalar(q.s * smooth(clamp(k * 5)) * (1 - smooth(clamp((k - 0.85) / 0.15)))); dm.updateMatrix(); gel.setMatrixAt(i, dm.matrix); }
    gel.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NF; i++) { const q = fd[i]; const k = (q.ph + t * q.sp) % 1; dm.position.set(q.x + 0.25 * k + 0.05 * Math.sin(t + q.w), MUC.top + 0.06 + k * 0.9, q.z); dm.rotation.set(0.6 * k, q.rot + t * 0.6, 0.4 * Math.sin(t + q.w)); dm.scale.setScalar(q.s * (1 - smooth(clamp((k - 0.55) / 0.45)))); dm.updateMatrix(); flake.setMatrixAt(i, dm.matrix); dm.rotation.set(0, 0, 0); }
    flake.instanceMatrix.needsUpdate = true;
  };
  return S;
}

// ---------------------------------------------------------------------------------------------
// Studio: the tooth alone on a bright seamless set (DAY 1 / 3 / 7 wear comparison)
// ---------------------------------------------------------------------------------------------
export function buildStudio(env) {
  const scene = new THREE.Scene();
  scene.background = canvasTex(512, 900, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.5, h * 0.75); gr.addColorStop(0, '#2f5a9e'); gr.addColorStop(0.5, '#142c58'); gr.addColorStop(1, '#040a18'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const tooth = makeTooth(); tooth.scale.setScalar(1.15); tooth.position.set(0, 0.2, 0); scene.add(tooth);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.MeshStandardMaterial({ color: 0x20386a, roughness: 0.22, metalness: 0.1, envMapIntensity: 1.0 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.62; floor.receiveShadow = true; scene.add(floor);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(20,40,80,0.45)'); gr.addColorStop(1, 'rgba(20,40,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.615; scene.add(shadow);
  scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x4a6aa0, 0.28));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-2.8, 3.2, 3.0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 1, far: 12 }); key.shadow.bias = -0.0004; scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 2.2); rim.position.set(3, 2, -3); scene.add(rim);
  const frontFill = new THREE.DirectionalLight(0xffffff, 0.35); frontFill.position.set(2.5, 1.2, 4); scene.add(frontFill);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex('#ffffff'), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true })); spark.scale.setScalar(0.5); spark.material.opacity = 0; spark.renderOrder = 20; scene.add(spark);
  scene.environment = env; scene.environmentIntensity = 0.75;
  return { scene, tooth, spark, key };
}
