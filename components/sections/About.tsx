"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import Razor from "@/components/three/Razor";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

const STATS = [
  { value: 10, suffix: "+", label: "Years of craft" },
  { value: 7, suffix: "", label: "Signature services" },
  { value: 5, suffix: ".0", label: "Average rating" },
];

/** Counts a number up from zero when scrolled into view. */
function Counter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.textContent = `${value}${suffix}`;
      return;
    }

    const obj = { n: 0 };
    const tween = gsap.to(obj, {
      n: value,
      duration: 1.8,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
      onUpdate: () => {
        el.textContent = `${Math.round(obj.n)}${suffix}`;
      },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [value, suffix]);

  return (
    <span ref={ref} className="font-accent text-5xl text-brass md:text-6xl">
      0{suffix}
    </span>
  );
}

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from(".about-copy > *", {
        x: -60,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: el, start: "top 70%" },
      });
      gsap.from(".about-visual", {
        x: 80,
        opacity: 0,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 70%" },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative mx-auto max-w-7xl px-6 py-28 md:py-40"
    >
      <div className="grid items-center gap-16 md:grid-cols-2">
        {/* Copy */}
        <div className="about-copy">
          <p className="eyebrow mb-5">Since 2015 · The Craft</p>
          <h2 className="heading-display text-4xl text-text-primary md:text-5xl">
            A barbershop where Turkish heritage meets a modern edge
          </h2>
          <p className="mt-6 text-text-muted leading-relaxed">
            Run by master barber Yaşar, our Whitworth Road shop carries the
            rituals of the Turkish barbering tradition — the hot towel, the
            straight razor, the unhurried attention to detail — and pairs them
            with the sharp, contemporary styling Swindon comes back for.
          </p>
          <p className="mt-4 text-text-muted leading-relaxed">
            Every chair is a quiet moment in your week. Walk in for a skin
            fade, a beard sculpt or a classic shave, and leave looking — and
            feeling — your best.
          </p>

          <dl className="mt-12 grid grid-cols-3 gap-6">
            {STATS.map((s) => (
              <div key={s.label}>
                <dd>
                  <Counter value={s.value} suffix={s.suffix} />
                </dd>
                <dt className="mt-2 text-xs uppercase tracking-[0.16em] text-text-muted">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        {/* 3D razor */}
        <div className="about-visual relative h-[340px] md:h-[460px]">
          <div className="absolute inset-0 rounded-3xl border border-brass/15 bg-bg-secondary/60" />
          <Canvas
            camera={{ position: [0, 0, 6], fov: 40 }}
            dpr={[1, 2]}
            aria-hidden="true"
          >
            <ambientLight intensity={0.4} />
            <spotLight position={[5, 6, 5]} intensity={90} angle={0.6} penumbra={1} />
            <pointLight position={[-5, -3, -3]} intensity={30} color="#c9a961" />
            <Razor reducedMotion={reduced} />
            <Environment resolution={256}>
              <Lightformer intensity={2} position={[0, 3, 3]} scale={[6, 4, 1]} color="#f5f1ea" />
              <Lightformer intensity={1.4} position={[-4, 0, 2]} scale={[3, 5, 1]} color="#c9a961" />
            </Environment>
          </Canvas>
          <span className="absolute bottom-4 left-5 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
            The straight razor · est. tradition
          </span>
        </div>
      </div>
    </section>
  );
}
