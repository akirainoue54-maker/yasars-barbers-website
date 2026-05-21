"use client";

import { useLenis } from "@/hooks/useLenis";

/** Mounts Lenis smooth scrolling for the whole document. Renders nothing. */
export default function SmoothScroll() {
  useLenis();
  return null;
}
