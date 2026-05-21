"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { MapPin, Navigation, Phone, Clock } from "lucide-react";
import { SHOP } from "@/lib/shop";
import Button from "@/components/ui/Button";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/** A small stylised model of the shopfront, built from primitives. */
function ShopMiniature() {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (group.current && !prefersReducedMotion()) {
      group.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group ref={group} position={[0, -0.6, 0]}>
      {/* Base */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[5, 0.3, 4]} />
        <meshStandardMaterial color="#0a0908" roughness={0.9} />
      </mesh>

      {/* Building */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[3.4, 2.5, 2.6]} />
        <meshStandardMaterial color="#1a1715" roughness={0.8} />
      </mesh>

      {/* Roof trim */}
      <mesh position={[0, 2.45, 0]} castShadow>
        <boxGeometry args={[3.6, 0.25, 2.8]} />
        <meshStandardMaterial color="#c9a961" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* Awning stripes */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh
          key={i}
          position={[-1.5 + i * 0.5, 0.95, 1.55]}
          rotation={[-0.5, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.5, 0.06, 0.9]} />
          <meshStandardMaterial color={i % 2 ? "#f5f1ea" : "#c8362d"} />
        </mesh>
      ))}

      {/* Door */}
      <mesh position={[0, 0.5, 1.32]}>
        <boxGeometry args={[0.8, 1.6, 0.08]} />
        <meshStandardMaterial color="#0a0908" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0.25, 0.5, 1.38]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#c9a961" metalness={1} roughness={0.2} />
      </mesh>

      {/* Windows */}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 1.05, 0.7, 1.32]}>
          <boxGeometry args={[0.9, 1, 0.06]} />
          <meshPhysicalMaterial
            color="#1e3a5f"
            metalness={0.2}
            roughness={0.05}
            transmission={0.6}
            thickness={0.3}
          />
        </mesh>
      ))}

      {/* Barber pole beside door */}
      <group position={[1.55, 0.6, 1.45]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 1.3, 24]} />
          <meshStandardMaterial color="#c8362d" roughness={0.4} />
        </mesh>
        {[0.75, -0.75].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.18, 24]} />
            <meshStandardMaterial color="#c9a961" metalness={1} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* Sign */}
      <mesh position={[0, 1.85, 1.33]}>
        <boxGeometry args={[2.6, 0.5, 0.06]} />
        <meshStandardMaterial color="#c9a961" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

export default function Location() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from(".hours-row", {
        x: -40,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: { trigger: el, start: "top 65%" },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="location"
      ref={sectionRef}
      className="relative bg-bg-secondary py-28 md:py-40"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:grid-cols-2">
        {/* Hours + address */}
        <div>
          <p className="eyebrow mb-5">Find us</p>
          <h2 className="heading-display text-4xl text-text-primary md:text-5xl">
            Opening hours &amp; the chair&apos;s address
          </h2>

          <div className="mt-10 divide-y divide-brass/15 border-y border-brass/15">
            {Object.entries(SHOP.hours).map(([day, time]) => (
              <div
                key={day}
                className="hours-row flex items-center justify-between py-4"
              >
                <span className="flex items-center gap-3 text-text-primary">
                  <Clock size={18} className="text-brass" />
                  {day}
                </span>
                <span className="font-accent text-2xl text-brass">{time}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3 text-text-muted">
            <p className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-brass" />
              {SHOP.address}
            </p>
            <p className="flex items-center gap-3">
              <Phone size={18} className="shrink-0 text-brass" />
              <a
                href={`tel:${SHOP.phone.replace(/\s/g, "")}`}
                className="hover:text-brass"
              >
                {SHOP.phone}
              </a>
            </p>
          </div>

          <div className="mt-8">
            <Button href={SHOP.googleMaps} ariaLabel="Get directions on Google Maps">
              <Navigation size={18} />
              Get Directions
            </Button>
          </div>
        </div>

        {/* 3D shop miniature */}
        <div className="relative h-[400px] overflow-hidden rounded-3xl border border-brass/15 bg-bg-primary md:h-[500px]">
          <Canvas
            shadows
            camera={{ position: [5, 4, 6], fov: 40 }}
            dpr={[1, 2]}
            aria-hidden="true"
          >
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[6, 8, 5]}
              intensity={2}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <pointLight position={[-5, 3, -3]} intensity={20} color="#c9a961" />
            <ShopMiniature />
            <ContactShadows
              position={[0, -0.75, 0]}
              opacity={0.5}
              scale={12}
              blur={2.5}
            />
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 2.2}
            />
          </Canvas>
          <span className="pointer-events-none absolute bottom-4 left-5 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
            Drag to look around · Whitworth Rd
          </span>
        </div>
      </div>
    </section>
  );
}
