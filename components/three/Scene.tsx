"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import BarberPole from "./BarberPole";
import Particles from "./Particles";

type SceneProps = {
  reducedMotion?: boolean;
  isMobile?: boolean;
};

/**
 * Drives the hero camera: gentle pointer parallax plus a scroll-linked
 * zoom-out as the visitor leaves the top of the page.
 */
function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, pointer } = useThree();
  const base = useRef(6);

  useFrame(() => {
    const scrollY =
      typeof window !== "undefined" ? window.scrollY : 0;
    const vh = typeof window !== "undefined" ? window.innerHeight : 1;
    const progress = Math.min(scrollY / vh, 1);

    const targetZ = base.current + progress * 5;
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      targetZ,
      0.08,
    );

    if (!reducedMotion) {
      camera.position.x = THREE.MathUtils.lerp(
        camera.position.x,
        pointer.x * 0.8,
        0.05,
      );
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        pointer.y * 0.5,
        0.05,
      );
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

function PoleWithPointer({ reducedMotion }: { reducedMotion: boolean }) {
  const { pointer } = useThree();
  const ref = useRef({ x: 0, y: 0 });
  ref.current.x = pointer.x;
  ref.current.y = pointer.y;
  return <BarberPole pointer={ref.current} reducedMotion={reducedMotion} />;
}

export default function Scene({
  reducedMotion = false,
  isMobile = false,
}: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 42 }}
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      gl={{ antialias: true, alpha: true }}
      aria-hidden="true"
    >
      <color attach="background" args={["#0a0908"]} />
      <fog attach="fog" args={["#0a0908", 8, 20]} />

      <ambientLight intensity={0.35} />
      <spotLight
        position={[6, 8, 6]}
        angle={0.5}
        penumbra={0.8}
        intensity={120}
        color="#f5f1ea"
        castShadow
      />
      <pointLight position={[-6, -2, -4]} intensity={40} color="#b87333" />
      <pointLight position={[4, 1, 5]} intensity={25} color="#c9a961" />

      <Suspense fallback={null}>
        <PoleWithPointer reducedMotion={reducedMotion} />
        <Particles
          count={isMobile ? 160 : 600}
          reducedMotion={reducedMotion}
        />

        {/* Local environment for metal reflections — no network fetch. */}
        <Environment resolution={256}>
          <Lightformer
            intensity={2}
            position={[0, 4, 4]}
            scale={[8, 4, 1]}
            color="#f5f1ea"
          />
          <Lightformer
            intensity={1.4}
            position={[-4, 0, 2]}
            scale={[3, 6, 1]}
            color="#c9a961"
          />
          <Lightformer
            intensity={1}
            position={[4, -2, 2]}
            scale={[3, 6, 1]}
            color="#b87333"
          />
        </Environment>
      </Suspense>

      <CameraRig reducedMotion={reducedMotion} />

      {!isMobile && (
        <EffectComposer>
          <Bloom
            intensity={0.7}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.25} darkness={0.85} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
