"use client";

import Link from "next/link";
import { useMagnetic } from "@/hooks/useMagnetic";
import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "solid" | "outline";
  className?: string;
  type?: "button" | "submit";
  ariaLabel?: string;
};

/**
 * Brass-accented call-to-action button with a magnetic hover effect.
 * Renders an anchor when `href` is provided, otherwise a native button.
 */
export default function Button({
  children,
  href,
  onClick,
  variant = "solid",
  className = "",
  type = "button",
  ariaLabel,
}: ButtonProps) {
  const ref = useMagnetic<HTMLSpanElement>(0.35);

  const base =
    "group relative inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] transition-colors duration-300";

  const styles =
    variant === "solid"
      ? "bg-brass text-bg-primary hover:bg-text-primary"
      : "border border-brass/60 text-text-primary hover:border-brass hover:text-brass";

  const inner = (
    <span ref={ref} className="inline-flex items-center gap-2.5">
      {children}
    </span>
  );

  if (href) {
    const external = href.startsWith("http") || href.startsWith("tel:");
    if (external) {
      return (
        <a
          href={href}
          aria-label={ariaLabel}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className={`${base} ${styles} ${className}`}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} aria-label={ariaLabel} className={`${base} ${styles} ${className}`}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${base} ${styles} ${className}`}
    >
      {inner}
    </button>
  );
}
