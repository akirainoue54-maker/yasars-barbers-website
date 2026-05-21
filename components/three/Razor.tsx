"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type RazorProps = {
  reducedMotion?: boolean;
};

/**
 * A straight razor built from primitives: a brass handle and a polished
 * steel blade, slowly rotating to catch the light.
 */
export default function Razor({ reducedMotion = false }: RazorProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current || reducedMotion) return;
    group.current.rotation.y += delta * 0.5;
    group.current.rotation.z =
      Math.sin(state.clock.elapsedTime * 0.6) * 0.12;
  });

  return (
    <group ref={group} rotation={[0.3, 0, 0]}>
      {/* Handle */}
      <mesh position={[-1.1, 0, 0]} castShadow>
        <boxGeometry args={[1.6, 0.26, 0.12]} />
        <meshStandardMaterial color="#1a1715" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Handle brass inlay */}
      <mesh position={[-1.1, 0, 0.07]}>
        <boxGeometry args={[1.4, 0.1, 0.02]} />
        <meshStandardMaterial color="#c9a961" metalness={1} roughness={0.2} />
      </mesh>

      {/* Pivot rivet */}
      <mesh position={[-0.3, 0, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.18, 24]} />
        <meshStandardMaterial color="#c9a961" metalness={1} roughness={0.2} />
      </mesh>

      {/* Blade */}
      <mesh position={[0.7, 0.1, 0]} rotation={[0, 0, 0.06]} castShadow>
        <boxGeometry args={[2, 0.5, 0.04]} />
        <meshStandardMaterial
          color="#d9dde2"
          metalness={1}
          roughness={0.12}
          envMapIntensity={1.4}
        />
      </mesh>
      {/* Blade edge highlight */}
      <mesh position={[0.7, -0.13, 0]} rotation={[0, 0, 0.06]}>
        <boxGeometry args={[2, 0.06, 0.05]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={1}
          roughness={0.04}
        />
      </mesh>
    </group>
  );
}
