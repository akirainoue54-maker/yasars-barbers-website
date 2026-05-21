import type { Metadata } from "next";
import { SHOP } from "@/lib/shop";
import BookingForm from "@/components/booking/BookingForm";

export const metadata: Metadata = {
  title: "Book an Appointment",
  description:
    "Book your appointment at Yasar's Barbers in Swindon. Choose your service, pick a date and time, and we'll see you in the chair.",
  alternates: { canonical: "/booking" },
};

export default function BookingPage() {
  return (
    <div className="pt-32 md:pt-40">
      <section className="mx-auto max-w-3xl px-6 pb-10 text-center">
        <p className="eyebrow mb-5">Reserve your chair</p>
        <h1 className="heading-display text-5xl text-text-primary md:text-7xl">
          Book an Appointment
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-text-muted">
          Three quick steps. Prefer to talk? Call {SHOP.phone} and Yaşar will
          sort you out.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-28">
        <BookingForm />
      </section>
    </div>
  );
}
