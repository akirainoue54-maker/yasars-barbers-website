"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ChevronDown, Phone } from "lucide-react";
import { SHOP } from "@/lib/shop";
import SplitText from "@/components/ui/SplitText";
import Button from "@/components/ui/Button";
import { prefersReducedMotion } from "@/lib/gsap";

const Scene = dynamic(() => import("@/components/three/Scene"), {
  ssr: false,
  loading: () => <SceneLoader />,
});

function SceneLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brass/30 border-t-brass" />
        <p className="eyebrow text-xs">Preparing the chair…</p>
      </div>
    </div>
  );
}

export default function Hero() {
  const [isMobile, setIsMobile] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReduced(prefersReducedMotion());
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <section
      id="hero"
      className="relative flex h-screen min-h-[640px] w-full items-center justify-center overflow-hidden"
      aria-label="Yasar's Barbers — a rotating 3D barber pole introduces the shop"
    >
      {/* 3D backdrop */}
      <div className="absolute inset-0">
        {mounted && <Scene isMobile={isMobile} reducedMotion={reduced} />}
      </div>

      {/* Readability gradient */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg-primary/40 via-transparent to-bg-primary"
        aria-hidden="true"
      />

      {/* Foreground content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="eyebrow mb-6"
        >
          Swindon · Est. Turkish Tradition
        </motion.p>

        <h1 className="heading-display max-w-4xl text-balance text-5xl font-semibold text-text-primary sm:text-7xl md:text-8xl">
          <SplitText text="Yasar's Barbers" as="span" delay={0.6} />
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 1 }}
          className="mt-6 max-w-xl text-lg text-text-muted md:text-xl"
        >
          {SHOP.tagline}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.9, duration: 0.8 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Button href="/booking">Book an Appointment</Button>
          <Button
            href={`tel:${SHOP.phone.replace(/\s/g, "")}`}
            variant="outline"
            ariaLabel={`Call ${SHOP.name}`}
          >
            <Phone size={18} />
            Call the Shop
          </Button>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4, duration: 1 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <motion.div
          animate={reduced ? {} : { y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          className="flex flex-col items-center gap-1 text-text-muted"
        >
          <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <ChevronDown size={18} className="text-brass" />
        </motion.div>
      </motion.div>
    </section>
  );
}
