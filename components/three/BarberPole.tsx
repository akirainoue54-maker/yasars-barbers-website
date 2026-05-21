"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Builds a repeating diagonal-stripe texture (red / white / blue / white)
 * that, when scrolled vertically on a cylinder, reads as a spinning
 * barber-pole helix.
 */
function useStripeTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#f5f1ea";
    ctx.fillRect(0, 0, size, size);

    const colors = ["#c8362d", "#1e3a5f"];
    const band = size / 8;
    ctx.lineWidth = band;
    ctx.lineCap = "butt";

    // Diagonal stripes — drawn well past the edges so they wrap seamlessly.
    let colorIndex = 0;
    for (let offset = -size; offset < size * 2; offset += band * 2) {
      ctx.strokeStyle = colors[colorIndex % colors.length];
      ctx.beginPath();
      ctx.moveTo(offset - size, -size);
      ctx.lineTo(offset + size, size * 2);
      ctx.stroke();
      colorIndex++;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 2);
    texture.anisotropy = 8;
    return texture;
  }, []);
}

type BarberPoleProps = {
  /** Pointer position, normalised to roughly -1..1, for the parallax tilt. */
  pointer?: { x: number; y: number };
  reducedMotion?: boolean;
};

export default function BarberPole({
  pointer,
  reducedMotion = false,
}: BarberPoleProps) {
  const group = useRef<THREE.Group>(null);
  const stripeRef = useRef<THREE.MeshStandardMaterial>(null);
  const texture = useStripeTexture();

  useFrame((_, delta) => {
    if (!group.current) return;

    // Spiral motion: scroll the stripe texture upward.
    if (!reducedMotion) {
      texture.offset.y -= delta * 0.35;
      group.current.rotation.y += delta * 0.3;
    }

    // Parallax tilt toward the pointer.
    if (pointer) {
      const targetX = pointer.y * 0.25;
      const targetZ = -pointer.x * 0.25;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        targetX,
        0.05,
      );
      group.current.rotation.z = THREE.MathUtils.lerp(
        group.current.rotation.z,
        targetZ,
        0.05,
      );
    }
  });

  return (
    <group ref={group}>
      {/* Striped core */}
      <mesh castShadow>
        <cylinderGeometry args={[0.62, 0.62, 3.4, 64, 1, true]} />
        <meshStandardMaterial
          ref={stripeRef}
          map={texture}
          roughness={0.32}
          metalness={0.05}
        />
      </mesh>

      {/* Glass-like outer sheath */}
      <mesh>
        <cylinderGeometry args={[0.7, 0.7, 3.45, 64, 1, true]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.18}
          roughness={0}
          metalness={0}
          transmission={0.9}
          thickness={0.4}
          color="#ffffff"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Brass caps */}
      {[1, -1].map((dir) => (
        <group key={dir} position={[0, dir * 1.85, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.78, 0.78, 0.34, 48]} />
            <meshStandardMaterial
              color="#c9a961"
              metalness={1}
              roughness={0.22}
            />
          </mesh>
          <mesh position={[0, dir * 0.26, 0]} castShadow>
            <sphereGeometry args={[0.42, 32, 32]} />
            <meshStandardMaterial
              color="#b87333"
              metalness={1}
              roughness={0.28}
            />
          </mesh>
        </group>
      ))}

      {/* Brass mounting bracket */}
      <mesh position={[0, 0, -0.95]}>
        <boxGeometry args={[0.18, 2.6, 0.18]} />
        <meshStandardMaterial color="#8a6b3a" metalness={1} roughness={0.4} />
      </mesh>
    </group>
  );
}
