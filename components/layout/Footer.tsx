"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Facebook, MapPin, Phone, Mail, Clock } from "lucide-react";
import { SHOP } from "@/lib/shop";
import Button from "@/components/ui/Button";
import { prefersReducedMotion } from "@/lib/gsap";

const ASCII = [
  "+------------------------------------+",
  "|   Y A S A R ' S   B A R B E R S    |",
  "|   - turkish craft, modern edge -   |",
  "+------------------------------------+",
];

/** Types the ASCII banner out line-by-line, then leaves it static. */
function AsciiLogo() {
  const [shown, setShown] = useState("");
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const full = ASCII.join("\n");

    if (prefersReducedMotion()) {
      setShown(full);
      return;
    }

    let i = 0;
    let raf = 0;
    let started = false;

    const type = () => {
      i += 2;
      setShown(full.slice(0, i));
      if (i < full.length) raf = window.setTimeout(type, 16);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          started = true;
          type();
        }
      },
      { threshold: 0.4 },
    );
    if (ref.current) observer.observe(ref.current);

    return () => {
      observer.disconnect();
      window.clearTimeout(raf);
    };
  }, []);

  return (
    <pre
      ref={ref}
      aria-label="Yasar's Barbers"
      className="overflow-x-auto whitespace-pre font-mono text-[10px] leading-tight text-brass sm:text-xs md:text-sm"
    >
      {shown}
      <span className="animate-pulse">_</span>
    </pre>
  );
}

export default function Footer() {
  const tel = `tel:${SHOP.phone.replace(/\s/g, "")}`;

  return (
    <footer
      id="contact"
      className="relative overflow-hidden border-t border-brass/15 bg-bg-secondary"
    >
      <div className="mx-auto max-w-7xl px-6 py-20">
        {/* CTA */}
        <div className="flex flex-col items-center gap-6 border-b border-brass/15 pb-16 text-center">
          <p className="eyebrow">Ready for the chair?</p>
          <h2 className="heading-display max-w-2xl text-4xl text-text-primary md:text-6xl">
            Book your next cut with Yaşar
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            <Button href={tel} ariaLabel={`Call ${SHOP.name}`}>
              <Phone size={18} />
              {SHOP.phone}
            </Button>
            <Button href="/booking" variant="outline">
              Book online
            </Button>
          </div>
        </div>

        {/* Columns */}
        <div className="grid gap-12 py-16 md:grid-cols-4">
          <div className="md:col-span-2">
            <AsciiLogo />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-text-muted">
              {SHOP.tagline} A traditional Turkish barbershop in Swindon —
              precision cuts, hot-towel shaves and a welcome for every
              gentleman.
            </p>
          </div>

          <div>
            <h3 className="eyebrow mb-5 text-xs">Visit</h3>
            <ul className="space-y-3 text-sm text-text-muted">
              <li className="flex gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-brass" />
                <span>{SHOP.address}</span>
              </li>
              <li className="flex gap-2">
                <Phone size={16} className="mt-0.5 shrink-0 text-brass" />
                <a href={tel} className="hover:text-brass">
                  {SHOP.phone}
                </a>
              </li>
              <li className="flex gap-2">
                <Mail size={16} className="mt-0.5 shrink-0 text-brass" />
                <a href={`mailto:${SHOP.email}`} className="hover:text-brass">
                  {SHOP.email}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="eyebrow mb-5 text-xs">Opening Hours</h3>
            <ul className="space-y-3 text-sm text-text-muted">
              {Object.entries(SHOP.hours).map(([day, time]) => (
                <li key={day} className="flex items-center gap-2">
                  <Clock size={16} className="shrink-0 text-brass" />
                  <span className="text-text-primary">{day}</span>
                  <span className="ml-auto">{time}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3">
              <a
                href={SHOP.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Yasar's Barbers on Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-brass/40 text-brass transition-colors hover:bg-brass hover:text-bg-primary"
              >
                <Facebook size={18} />
              </a>
              <a
                href={SHOP.googleMaps}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get directions on Google Maps"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-brass/40 text-brass transition-colors hover:bg-brass hover:text-bg-primary"
              >
                <MapPin size={18} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-brass/15 pt-8 text-xs text-text-muted md:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {SHOP.name}. All rights reserved.
          </p>
          <nav className="flex gap-6" aria-label="Footer">
            <Link href="/" className="hover:text-brass">
              Home
            </Link>
            <Link href="/services" className="hover:text-brass">
              Services
            </Link>
            <Link href="/booking" className="hover:text-brass">
              Booking
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
