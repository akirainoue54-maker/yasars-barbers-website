import * as THREE from 'three';
import { canvasTex, normalTex, fbm, noise3, rng, clamp, smooth, lerp, V } from './lib.js';
import { makeSeed } from './melon.js';
import { Droplets, Bubbles, Sparkles, glow } from './fx.js';

export const WATER_Y = 0;

export function buildToilet() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb0b8);
  // bowl interior: lathe profile (radius by height), open top
  const prof = [];
  for (let i = 0; i <= 80; i++) { const u = i / 80; const y = lerp(-1.4, 1.2, u);
    const r = 0.25 + 1.25 * Math.pow(clamp((y + 1.4) / 2.6), 0.55) + 0.06 * smooth(clamp((y - 1.0) / 0.2));
    prof.push(new THREE.Vector2(r, y)); }
  const bg = new THREE.LatheGeometry(prof, 160); bg.scale(1, 1, 0.82);
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xdfe4e8, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide, envMapIntensity: 1.3 });
  const bowl = new THREE.Mesh(bg, porcelain); bowl.receiveShadow = true; scene.add(bowl);
  // rim (torus)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.56, 0.14, 24, 160), porcelain); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 0.82, 1); rim.position.y = 1.22; scene.add(rim);
  // tiled wall far behind (blurred)
  const tiles = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#cfe2ea'; g.fillRect(0, 0, w, h); g.filter = 'blur(6px)'; g.strokeStyle = '#eef6f9'; g.lineWidth = 10;
    for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: tiles, color: 0x8a9aa2 })); wall.position.set(0, 3, -5); scene.add(wall);
  // water
  const wg = new THREE.CircleGeometry(1.5, 128); wg.rotateX(-Math.PI / 2);
  const sg = new THREE.PlaneGeometry(3.4, 3.4, 140, 140); sg.rotateX(-Math.PI / 2); sg.userData.rest = Float32Array.from(sg.attributes.position.array);
  const waterNormal = normalTex(512, 512, (u, v) => fbm(u * 6, v * 6, 2.2, 4), 2.0, { repeat: true });
  const water = new THREE.Mesh(sg, new THREE.MeshPhysicalMaterial({ color: 0x2a9cc0, roughness: 0.03, transparent: true, opacity: 0.7, clearcoat: 1, normalMap: waterNormal, normalScale: new THREE.Vector2(0.25, 0.25), side: THREE.DoubleSide, envMapIntensity: 1.8 }));
  water.position.y = WATER_Y; water.renderOrder = 2; scene.add(water);
  const seed = makeSeed(0.14); scene.add(seed);
  const splash = new Droplets(140, new THREE.MeshPhysicalMaterial({ color: 0xd8f4ff, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.8 }), { size: 0.014, seed: 31 }); scene.add(splash.mesh);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); ripple.rotation.x = -Math.PI / 2; scene.add(ripple);
  const bubbles = new Bubbles(70, { seed: 12, size: 0.018, color: 0xeaf8ff }); scene.add(bubbles.mesh);
  const sparkles = new Sparkles(18, '#ffffff', { seed: 13, size: 0.12, star: true }); scene.add(sparkles.group);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x50606a, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(1.5, 5, 2); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 }); scene.add(key);
  const rimL = new THREE.PointLight(0xffffff, 0, 3, 1.5); scene.add(rimL);
  return { scene, water, seed, splash, ripple, bubbles, sparkles, rimL };
}

export function waveWater(S, t, drop) {
  const g = S.water.geometry, p = g.attributes.position, rest = g.userData.rest;
  for (let i = 0; i < p.count; i++) {
    const x = rest[i * 3], z = rest[i * 3 + 2];
    let y = 0.008 * Math.sin(x * 3 + t * 1.5) * Math.cos(z * 2.4 + t);
    if (drop && drop.t > 0) { const d = Math.hypot(x - drop.x, z - drop.z); y += 0.05 * Math.exp(-drop.t * 1.6) * Math.sin(d * 16 - drop.t * 16) * Math.exp(-Math.pow((d - drop.t * 1.1) * 2.6, 2)); }
    p.setY(i, y);
  }
  p.needsUpdate = true; g.computeVertexNormals();
}
