"use client";

import { useEffect, useRef } from "react";
import {
  Scissors,
  Layers,
  Paintbrush,
  Droplets,
  CircleUser,
  Eye,
  Baby,
  type LucideIcon,
} from "lucide-react";
import { SHOP } from "@/lib/shop";
import { useMagnetic } from "@/hooks/useMagnetic";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

const ICONS: LucideIcon[] = [
  Scissors,
  Layers,
  Paintbrush,
  Droplets,
  CircleUser,
  Eye,
  Baby,
];

function ServiceCard({
  name,
  duration,
  price,
  Icon,
}: {
  name: string;
  duration: string;
  price: string;
  Icon: LucideIcon;
}) {
  const ref = useMagnetic<HTMLElement>(0.18);

  return (
    <article
      ref={ref}
      className="service-card group relative flex flex-col gap-5 rounded-2xl border border-brass/15 bg-bg-secondary/70 p-8 transition-colors duration-300 hover:border-brass/50"
    >
      {/* 3D-flipping icon */}
      <div className="[perspective:600px]">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-brass/25 bg-bg-primary text-brass transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(360deg)]">
          <Icon size={26} strokeWidth={1.6} />
        </div>
      </div>

      <h3 className="heading-display text-2xl text-text-primary">{name}</h3>

      <div className="mt-auto flex items-center justify-between border-t border-brass/10 pt-5">
        <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
          {duration}
        </span>
        <span className="font-accent text-3xl text-brass">{price}</span>
      </div>
    </article>
  );
}

export default function Services() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from(".service-card", {
        y: 60,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: el, start: "top 65%" },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="services"
      ref={sectionRef}
      className="relative bg-bg-primary py-28 md:py-40"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow mb-5">What we do</p>
            <h2 className="heading-display max-w-xl text-4xl text-text-primary md:text-5xl">
              Services cut to a fine finish
            </h2>
          </div>
          <p className="max-w-sm text-text-muted">
            Honest pricing, no rush. Every service includes a consultation so
            the result is exactly what you came in for.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SHOP.services.map((service, i) => (
            <ServiceCard
              key={service.name}
              name={service.name}
              duration={service.duration}
              price={service.price}
              Icon={ICONS[i % ICONS.length]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
