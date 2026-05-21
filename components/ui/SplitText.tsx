"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

type SplitTextProps = {
  text: string;
  className?: string;
  /** Delay before the animation starts, in seconds. */
  delay?: number;
  /** Stagger between characters, in seconds. */
  stagger?: number;
  /** Render as a block-level element. */
  as?: "h1" | "h2" | "h3" | "p" | "span";
};

/**
 * Splits text into individual characters and fades each one in with a
 * GSAP stagger. Falls back to a plain reveal when reduced motion is set.
 */
export default function SplitText({
  text,
  className = "",
  delay = 0,
  stagger = 0.035,
  as = "span",
}: SplitTextProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const chars = el.querySelectorAll<HTMLElement>(".split-char");

    if (prefersReducedMotion()) {
      gsap.set(chars, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        { yPercent: 110, opacity: 0, rotateX: -55 },
        {
          yPercent: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.9,
          ease: "power4.out",
          stagger,
          delay,
        },
      );
    }, el);

    return () => ctx.revert();
  }, [text, delay, stagger]);

  const words = text.split(" ");
  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      className={className}
      aria-label={text}
      style={{ perspective: 600 }}
    >
      {words.map((word, wi) => (
        <span
          key={wi}
          className="inline-block whitespace-nowrap"
          aria-hidden="true"
        >
          {word.split("").map((char, ci) => (
            <span
              key={ci}
              className="split-char"
              style={{ opacity: 0 }}
            >
              {char}
            </span>
          ))}
          {wi < words.length - 1 && (
            <span className="split-char" style={{ opacity: 0 }}>
              {" "}
            </span>
          )}
        </span>
      ))}
    </Tag>
  );
}
