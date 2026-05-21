"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { prefersReducedMotion } from "@/lib/gsap";

/**
 * Gallery panels. These are generated procedurally so the site looks
 * complete with no assets. To use real photography, drop files into
 * /public/gallery and switch `useRealImages` on (see README).
 */
const PANELS = [
  { n: "01", label: "Skin Fade" },
  { n: "02", label: "Classic Cut" },
  { n: "03", label: "Beard Sculpt" },
  { n: "04", label: "Hot Towel Shave" },
  { n: "05", label: "Textured Crop" },
  { n: "06", label: "Line Up" },
  { n: "07", label: "Head Shave" },
  { n: "08", label: "The Pompadour" },
];

const PLANE_W = 3.1;
const PLANE_H = 4;
const GAP = 0.55;
const STRIDE = PLANE_W + GAP;

function makePanelTexture(n: string, label: string): THREE.Texture {
  const w = 600;
  const h = 800;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#1a1715");
  grad.addColorStop(1, "#0a0908");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // brass frame
  ctx.strokeStyle = "#c9a961";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, w - 56, h - 56);

  // diagonal sheen
  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, "rgba(201,169,97,0)");
  sheen.addColorStop(0.5, "rgba(201,169,97,0.12)");
  sheen.addColorStop(1, "rgba(201,169,97,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#c9a961";
  ctx.font = "700 220px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(n, w / 2, h / 2 - 30);

  ctx.fillStyle = "#f5f1ea";
  ctx.font = "600 44px Georgia, serif";
  ctx.fillText(label, w / 2, h / 2 + 130);

  ctx.fillStyle = "#8b8680";
  ctx.font = "300 22px Arial, sans-serif";
  ctx.fillText("YASAR'S BARBERS", w / 2, h - 80);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const vertexShader = /* glsl */ `
  uniform float uVelocity;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // bend the plane along its travel direction
    p.z += sin(uv.x * 3.14159) * uVelocity * 2.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uVelocity;
  varying vec2 vUv;
  void main() {
    float shift = uVelocity * 0.06;
    float r = texture2D(uTexture, vUv + vec2(shift, 0.0)).r;
    float g = texture2D(uTexture, vUv).g;
    float b = texture2D(uTexture, vUv - vec2(shift, 0.0)).b;
    gl_FragColor = vec4(r, g, b, 1.0);
  }
`;

type DragState = {
  offset: number;
  target: number;
  velocity: number;
  dragging: boolean;
  lastX: number;
};

function GalleryTrack({ drag }: { drag: React.RefObject<DragState> }) {
  const group = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const materials = useRef<THREE.ShaderMaterial[]>([]);

  const textures = useMemo(
    () => PANELS.map((p) => makePanelTexture(p.n, p.label)),
    [],
  );

  const total = PANELS.length * STRIDE;
  const minOffset = -(total - STRIDE) - 1;

  useFrame(() => {
    const d = drag.current;
    if (!group.current || !d) return;

    if (!d.dragging) {
      d.target += d.velocity;
      d.velocity *= 0.94;
    }
    // clamp with soft bounds
    d.target = THREE.MathUtils.clamp(d.target, minOffset, 1);
    d.offset = THREE.MathUtils.lerp(d.offset, d.target, 0.12);
    group.current.position.x = d.offset;

    const vel = THREE.MathUtils.clamp(d.velocity * 4, -0.5, 0.5);
    materials.current.forEach((m) => {
      if (m) m.uniforms.uVelocity.value = vel;
    });
  });

  const scale = Math.min(1, viewport.width / 12);

  return (
    <group ref={group} scale={scale}>
      {PANELS.map((panel, i) => (
        <mesh key={panel.n} position={[i * STRIDE, 0, 0]}>
          <planeGeometry args={[PLANE_W, PLANE_H, 24, 24]} />
          <shaderMaterial
            ref={(m) => {
              if (m) materials.current[i] = m;
            }}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={{
              uTexture: { value: textures[i] },
              uVelocity: { value: 0 },
            }}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function Gallery() {
  const drag = useRef<DragState>({
    offset: 0,
    target: 0,
    velocity: 0,
    dragging: false,
    lastX: 0,
  });
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  const onDown = (clientX: number) => {
    drag.current.dragging = true;
    drag.current.lastX = clientX;
    drag.current.velocity = 0;
  };
  const onMove = (clientX: number) => {
    const d = drag.current;
    if (!d.dragging) return;
    const delta = (clientX - d.lastX) * 0.01;
    d.target += delta;
    d.velocity = delta;
    d.lastX = clientX;
  };
  const onUp = () => {
    drag.current.dragging = false;
  };

  return (
    <section
      id="gallery"
      className="relative bg-bg-secondary py-28 md:py-40"
      aria-label="Gallery — a draggable WebGL carousel of our work"
    >
      <div className="mx-auto mb-14 max-w-7xl px-6">
        <p className="eyebrow mb-5">The Gallery</p>
        <h2 className="heading-display max-w-xl text-4xl text-text-primary md:text-5xl">
          Drag through a few of our cuts
        </h2>
        <p className="mt-4 max-w-md text-text-muted">
          Click and drag — or swipe — to explore. Built with WebGL for a touch
          of distortion as the panels glide.
        </p>
      </div>

      <div
        className="h-[460px] w-full cursor-grab touch-pan-y select-none active:cursor-grabbing md:h-[560px]"
        onMouseDown={(e) => onDown(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={(e) => onDown(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onUp}
        role="region"
        aria-label="Draggable gallery carousel"
      >
        <Canvas camera={{ position: [0, 0, 9], fov: 42 }} dpr={[1, 2]}>
          <color attach="background" args={["#1a1715"]} />
          <GalleryTrack drag={drag} />
        </Canvas>
      </div>

      <p className="mx-auto mt-8 max-w-7xl px-6 text-xs uppercase tracking-[0.2em] text-text-muted">
        {reduced
          ? "Use the panels above to view our work"
          : "Drag to explore →"}
      </p>
    </section>
  );
}
