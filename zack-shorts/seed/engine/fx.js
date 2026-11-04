import * as THREE from 'three';
import { rng, clamp, lerp, glowTex, V } from './lib.js';

const dummy = new THREE.Object3D();

// Ballistic droplets (juice / acid splash). Deterministic in t.
export class Droplets {
  constructor(n, mat, { size = 0.02, seed = 1 } = {}) {
    this.n = n; this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), mat, n);
    this.mesh.frustumCulled = false;
    const r = rng(seed);
    this.p = [...Array(n)].map(() => ({ dir: V(r() - 0.5, r() * 0.9 + 0.3, r() - 0.5).normalize(), sp: 0.4 + r() * 1.0, s: size * (0.4 + r()), life: 0.35 + r() * 0.5 }));
  }
  // t: time since burst. origin, spreadScale, gravity, up axis
  update(t, origin, { speed = 1, gravity = 4, up = V(0, 1, 0), squash = 1 } = {}) {
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), up.clone().normalize());
    for (let i = 0; i < this.n; i++) {
      const d = this.p[i]; const k = t / d.life;
      if (t < 0 || k > 1) { dummy.scale.setScalar(0); }
      else {
        const v = d.dir.clone().applyQuaternion(q).multiplyScalar(d.sp * speed);
        dummy.position.copy(origin).addScaledVector(v, t).addScaledVector(up, -0.5 * gravity * t * t);
        const sc = d.s * (1 - k * 0.6);
        dummy.scale.set(sc, sc * (1 + squash * 0.8 * (1 - k)), sc);
      }
      dummy.updateMatrix(); this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Fresnel bubble: clear centre, bright rim, one sharp highlight
export function bubbleMaterial(color = 0xf4ffd0) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tint: { value: new THREE.Color(color) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * instanceMatrix * vec4(position,1.0); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 tint; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float spec = pow(max(dot(normalize(vN), normalize(vec3(-0.45,0.6,0.65))),0.0), 40.0);
        vec3 c = mix(tint, vec3(1.0), f*0.6) + spec;
        gl_FragColor = vec4(c, clamp(0.05 + 0.75*f + spec, 0.0, 1.0)); }`,
  });
}

// Rising bubbles inside a liquid volume
export class Bubbles {
  constructor(n, { seed = 2, size = 0.03, color = 0xf4ffd0 } = {}) {
    this.n = n;
    const mat = bubbleMaterial(color);
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), mat, n); this.mesh.frustumCulled = false;
    const r = rng(seed);
    this.p = [...Array(n)].map(() => ({ x: r(), z: r(), ph: r(), sp: 0.25 + r() * 0.5, s: size * (0.3 + r() * 1.2), w: r() * 6 }));
  }
  // box: center, half-size x/z, y range [y0,y1]
  update(t, c, hx, hz, y0, y1, density = 1) {
    for (let i = 0; i < this.n; i++) {
      const b = this.p[i];
      if (i / this.n > density) { dummy.scale.setScalar(0); }
      else {
        const h = (b.ph + t * b.sp / (y1 - y0)) % 1;
        dummy.position.set(c.x + (b.x - 0.5) * 2 * hx + 0.03 * Math.sin(t * 5 + b.w), y0 + h * (y1 - y0), c.z + (b.z - 0.5) * 2 * hz + 0.03 * Math.cos(t * 4 + b.w));
        dummy.scale.setScalar(b.s * (0.6 + 0.4 * h) * (h > 0.97 ? (1 - h) / 0.03 : 1));
      }
      dummy.updateMatrix(); this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Additive glow sprites / sparkles
export class Sparkles {
  constructor(n, color = '#fff3c0', { seed = 3, size = 0.08, star = false } = {}) {
    this.n = n; const tex = star ? starTex(color) : glowTex(color);
    this.group = new THREE.Group(); this.items = [];
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      this.group.add(s); this.items.push({ s, d: V(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), r: 0.3 + r(), ph: r(), sz: size * (0.4 + r()) });
    }
  }
  update(t, center, radius, intensity = 1) {
    for (const it of this.items) {
      const k = (it.ph + t * 0.6) % 1;
      it.s.position.copy(center).addScaledVector(it.d, radius * it.r * (0.4 + k));
      it.s.position.y += k * radius * 0.4;
      const a = Math.sin(k * Math.PI) * intensity;
      it.s.material.opacity = clamp(a); it.s.scale.setScalar(it.sz * (0.5 + a));
    }
  }
}

// four-point twinkle star
export function starTex(color) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 22); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, color); gr.addColorStop(1, color + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[128, 6], [6, 128]]) { const l = g.createLinearGradient(64 - w / 2, 64 - h / 2, 64 + w / 2, 64 + h / 2); l.addColorStop(0, color + '00'); l.addColorStop(0.5, '#ffffff'); l.addColorStop(1, color + '00'); g.fillStyle = l; g.fillRect(64 - w / 2, 64 - h / 2, w, h); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// soft glow sprite
export function glow(color = '#ffffff', size = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size); return s;
}
