"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMagnetic } from "@/hooks/useMagnetic";

type MagneticLinkProps = {
  children: ReactNode;
  href: string;
  className?: string;
  strength?: number;
  onClick?: () => void;
};

/**
 * A navigation link that subtly tracks the cursor while hovered.
 */
export default function MagneticLink({
  children,
  href,
  className = "",
  strength = 0.5,
  onClick,
}: MagneticLinkProps) {
  const ref = useMagnetic<HTMLAnchorElement>(strength);
  const external = href.startsWith("http") || href.startsWith("tel:");

  if (external) {
    return (
      <a
        ref={ref}
        href={href}
        onClick={onClick}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className={`inline-block ${className}`}
      >
        {children}
      </a>
    );
  }

  return (
    <Link ref={ref} href={href} onClick={onClick} className={`inline-block ${className}`}>
      {children}
    </Link>
  );
}
