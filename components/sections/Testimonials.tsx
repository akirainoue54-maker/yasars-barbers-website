"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { SHOP } from "@/lib/shop";
import { prefersReducedMotion } from "@/lib/gsap";

export default function Testimonials() {
  const reviews = SHOP.testimonials;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  const go = useCallback(
    (next: number) => {
      setDir(next > index || (index === reviews.length - 1 && next === 0) ? 1 : -1);
      setIndex((next + reviews.length) % reviews.length);
    },
    [index, reviews.length],
  );

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setDir(1);
      setIndex((i) => (i + 1) % reviews.length);
    }, 6000);
    return () => clearInterval(id);
  }, [reduced, reviews.length]);

  const review = reviews[index];

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden bg-bg-primary py-28 md:py-40"
    >
      {/* Floating 3D-style quote marks */}
      <motion.span
        aria-hidden="true"
        className="heading-display pointer-events-none absolute left-4 top-10 select-none text-[14rem] leading-none text-brass/10 md:left-24 md:text-[22rem]"
        animate={reduced ? {} : { y: [0, -24, 0], rotate: [0, -4, 0] }}
        transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
      >
        &ldquo;
      </motion.span>
      <motion.span
        aria-hidden="true"
        className="heading-display pointer-events-none absolute bottom-0 right-4 select-none text-[14rem] leading-none text-brass/10 md:right-24 md:text-[22rem]"
        animate={reduced ? {} : { y: [0, 24, 0], rotate: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 11, ease: "easeInOut" }}
      >
        &rdquo;
      </motion.span>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <p className="eyebrow mb-12">Word on the street</p>

        <div className="relative min-h-[280px] [perspective:1200px]">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.figure
              key={index}
              custom={dir}
              initial={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, rotateY: dir * 65, z: -200 }
              }
              animate={{ opacity: 1, rotateY: 0, z: 0 }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, rotateY: dir * -65, z: -200 }
              }
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="[transform-style:preserve-3d]"
            >
              <div className="mb-6 flex justify-center gap-1">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star
                    key={i}
                    size={20}
                    className="fill-brass text-brass"
                  />
                ))}
              </div>
              <blockquote className="heading-display text-2xl leading-snug text-text-primary md:text-4xl">
                {review.text}
              </blockquote>
              <figcaption className="mt-8 text-sm uppercase tracking-[0.2em] text-brass">
                — {review.name}
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        <div className="mt-12 flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Previous review"
            onClick={() => go(index - 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brass/40 text-brass transition-colors hover:bg-brass hover:text-bg-primary"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex gap-2" role="tablist" aria-label="Reviews">
            {reviews.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Review ${i + 1}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-8 bg-brass" : "w-2 bg-brass/30"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next review"
            onClick={() => go(index + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brass/40 text-brass transition-colors hover:bg-brass hover:text-bg-primary"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
