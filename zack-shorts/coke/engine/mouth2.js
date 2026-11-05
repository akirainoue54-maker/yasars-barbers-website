import * as THREE from 'three';
import { clamp, lerp, smooth, rng, canvasTex, V, ease, seg } from './lib.js';
import { Droplets, Sparkles, bubbleMaterial } from './fx.js';
import { glassMat, colaMat, GH, BASE, LEVEL } from './cola.js';
import { makeArch, toothMat, tissueMat } from './teeth.js';

const GS = 0.2; // glass prop scale

// a small drinking glass: shell + liquid (+ foam cap), pivot at the rim centre so it tilts about the lip
export function makeGlassProp({ water = false } = {}) {
  const pivot = new THREE.Group(); const body = new THREE.Group(); pivot.add(body); body.position.y = -GH * GS; body.scale.setScalar(GS);
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.84, GH, 48, 1, true), glassMat(water ? 0.07 : 0.05)); outer.position.y = GH / 2; body.add(outer);
  const baseM = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, BASE, 48), glassMat(0.14)); baseM.position.y = BASE / 2; body.add(baseM);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.04, 10, 64), glassMat(0.35)); lip.rotation.x = Math.PI / 2; lip.position.y = GH; body.add(lip);
  const mat = colaMat();
  if (water) { mat.uniforms.top.value.set(0.35, 0.75, 1.0); mat.uniforms.bot.value.set(0.12, 0.45, 0.8); mat.uniforms.glowK.value = 0.25; mat.uniforms.aK.value = 0.45; }
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.78, LEVEL, 48, 1, true), mat); liquid.position.y = BASE + LEVEL / 2; liquid.renderOrder = 1; body.add(liquid);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.94, 48), new THREE.MeshBasicMaterial({ color: water ? 0xcfeeff : 0xf0d6ae, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })); cap.rotation.x = -Math.PI / 2; cap.position.y = BASE + LEVEL; cap.renderOrder = 2; body.add(cap);
  pivot.userData = { liquid, cap, setLevel: (L) => { L = clamp(L, 0.0001, 1); liquid.scale.y = L; liquid.position.y = BASE + (LEVEL * L) / 2; cap.position.y = BASE + LEVEL * L; cap.visible = false; } };
  return pivot;
}

export function buildMouth2(env) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a1018);
  const g = new THREE.Group(); scene.add(g);
  // face skin with an elliptical hole for the mouth
  const shape = new THREE.Shape(); shape.moveTo(-6, -8); shape.lineTo(6, -8); shape.lineTo(6, 8); shape.lineTo(-6, 8); shape.closePath();
  const hole = new THREE.Path(); hole.absellipse(0, -0.02, 0.86, 0.5, 0, Math.PI * 2, true); shape.holes.push(hole);
  const skinTex = canvasTex(256, 256, (c, w) => { const gr = c.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w / 1.4); gr.addColorStop(0, '#f0b090'); gr.addColorStop(1, '#d08a6e'); c.fillStyle = gr; c.fillRect(0, 0, w, w); });
  const skin = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64), new THREE.MeshPhysicalMaterial({ map: skinTex, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xffc8b0), side: THREE.DoubleSide }));
  skin.position.z = 0.28; g.add(skin);
  // lips as soft tubes around the hole
  const lp = []; for (let i = 0; i < 80; i++) { const a = i / 80 * Math.PI * 2; lp.push(V(Math.cos(a) * 0.86, Math.sin(a) * 0.5 - 0.02, 0.3 + 0.03 * Math.cos(a * 2))); }
  const lips = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp, true), 240, 0.13, 24, true), new THREE.MeshPhysicalMaterial({ color: 0xd2606c, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 1, sheenColor: new THREE.Color(0xffb6b6) }));
  g.add(lips);
  // dark cavity + tongue
  const cav = new THREE.Mesh(new THREE.SphereGeometry(1.8, 48, 32), new THREE.MeshBasicMaterial({ color: 0x4a0f18, side: THREE.BackSide })); cav.position.z = -0.3; g.add(cav);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), tissueMat(0xd8646e)); tongue.scale.set(0.46, 0.17, 0.7); tongue.position.set(0, -0.42, -0.22); g.add(tongue);
  const upper = makeArch(true), lower = makeArch(false); upper.position.set(0, 0.11, 0); lower.position.set(0, -0.15, 0); g.add(upper, lower);
  // props
  const cola = makeGlassProp(); g.add(cola);
  const water = makeGlassProp({ water: true }); g.add(water);
  const colaDrops = new Droplets(60, new THREE.MeshPhysicalMaterial({ color: 0xc8691a, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9, emissive: 0x5a2000, emissiveIntensity: 0.6 }), { size: 0.006, seed: 61 }); g.add(colaDrops.mesh);
  const waterDrops = new Droplets(150, new THREE.MeshPhysicalMaterial({ color: 0xcdeeff, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.8 }), { size: 0.007, seed: 62 }); g.add(waterDrops.mesh);
  const stars = new Sparkles(26, '#ffffff', { seed: 63, size: 0.09, star: true }); g.add(stars.group);
  scene.add(new THREE.HemisphereLight(0xfff0e8, 0x6a2a30, 0.7));
  const key = new THREE.DirectionalLight(0xfff2e6, 2.2); key.position.set(-1.5, 2, 3); scene.add(key);
  const fill = new THREE.PointLight(0xffd8c0, 3.5, 6, 1.6); fill.position.set(1.2, 0.2, 1.8); scene.add(fill);
  scene.environment = env; scene.environmentIntensity = 0.4;
  const S = { scene, g, upper, lower, cola, water, colaDrops, waterDrops, stars, fill, key };
  // amber stain on the teeth: 0 = clean, 1 = tea-stained
  S.setStain = (s) => { s = clamp(s); toothMat.color.setRGB(1, lerp(1, 0.74, s), lerp(1, 0.46, s)); };
  return S;
}

export const CONTACT = V(0, -0.1, 0.34);

// place a glass pivot: far = off-screen start, contact = at the teeth; p 0..1 approach, tilt radians (negative tilts the base toward the viewer)
export function placeGlass(glass, p, tilt, far = V(0.7, -0.85, 1.3), contact = CONTACT) {
  glass.position.copy(far).lerp(contact, clamp(p)); glass.rotation.set(tilt, 0, 0.12 * (1 - clamp(p)));
  glass.visible = p > 0.001;
}
