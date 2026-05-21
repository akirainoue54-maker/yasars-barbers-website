import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { SHOP } from "@/lib/shop";
import Button from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "Explore the full menu at Yasar's Barbers in Swindon — haircuts, skin fades, beard trims, hot-towel shaves, head shaves and more, with clear pricing.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <div className="pt-32 md:pt-40">
      {/* Header */}
      <section className="mx-auto max-w-7xl px-6 pb-16 text-center">
        <p className="eyebrow mb-5">The Full Menu</p>
        <h1 className="heading-display mx-auto max-w-3xl text-5xl text-text-primary md:text-7xl">
          Services &amp; Pricing
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-text-muted">
          Traditional Turkish barbering, finished to a modern standard. Prices
          are a guide — every visit starts with a consultation.
        </p>
      </section>

      {/* Detailed cards */}
      <section className="mx-auto max-w-7xl px-6 pb-28">
        <div className="grid gap-6 md:grid-cols-2">
          {SHOP.services.map((service, i) => (
            <article
              key={service.name}
              className="group relative flex flex-col gap-4 rounded-2xl border border-brass/15 bg-bg-secondary/70 p-8 transition-colors duration-300 hover:border-brass/50 md:p-10"
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <span className="font-accent text-sm text-brass">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="heading-display mt-1 text-3xl text-text-primary">
                    {service.name}
                  </h2>
                </div>
                <span className="font-accent text-4xl text-brass md:text-5xl">
                  {service.price}
                </span>
              </div>

              <p className="text-text-muted leading-relaxed">
                {service.description}
              </p>

              <div className="mt-auto flex items-center justify-between border-t border-brass/10 pt-5">
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted">
                  <Clock size={15} className="text-brass" />
                  {service.duration}
                </span>
                <Link
                  href="/booking"
                  className="flex items-center gap-1.5 text-sm uppercase tracking-[0.14em] text-brass transition-transform group-hover:translate-x-1"
                >
                  Book this
                  <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-brass/15 bg-bg-secondary py-24 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="heading-display text-4xl text-text-primary md:text-5xl">
            Ready when you are
          </h2>
          <p className="mt-4 text-text-muted">
            Book online in under a minute, or call the shop directly.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button href="/booking">Book an Appointment</Button>
            <Button
              href={`tel:${SHOP.phone.replace(/\s/g, "")}`}
              variant="outline"
            >
              {SHOP.phone}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
