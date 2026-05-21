"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Phone } from "lucide-react";
import { SHOP } from "@/lib/shop";
import MagneticLink from "@/components/ui/MagneticLink";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Location", href: "/#location" },
  { label: "Book", href: "/booking" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-bg-primary/85 py-3 backdrop-blur-md shadow-[0_1px_0_0_rgba(201,169,97,0.18)]"
            : "bg-transparent py-6"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="heading-display text-xl font-semibold tracking-tight text-text-primary md:text-2xl"
          >
            Yasar&apos;s <span className="text-brass">Barbers</span>
          </Link>

          <nav className="hidden items-center gap-9 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <MagneticLink
                key={item.href}
                href={item.href}
                strength={0.4}
                className="text-sm uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-brass"
              >
                {item.label}
              </MagneticLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <a
              href={`tel:${SHOP.phone.replace(/\s/g, "")}`}
              className="hidden items-center gap-2 text-sm tracking-wide text-text-primary transition-colors hover:text-brass lg:flex"
            >
              <Phone size={16} className="text-brass" />
              {SHOP.phone}
            </a>
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="text-text-primary md:hidden"
            >
              {menuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-bg-primary md:hidden"
          >
            {NAV.map((item, i) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i + 0.1 }}
              >
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="heading-display text-4xl text-text-primary transition-colors hover:text-brass"
                >
                  {item.label}
                </Link>
              </motion.div>
            ))}
            <motion.a
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              href={`tel:${SHOP.phone.replace(/\s/g, "")}`}
              className="mt-4 flex items-center gap-2 text-brass"
            >
              <Phone size={18} />
              {SHOP.phone}
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
