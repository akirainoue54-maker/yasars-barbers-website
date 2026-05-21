"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Scissors } from "lucide-react";
import { SHOP } from "@/lib/shop";

const schema = z.object({
  service: z.string().min(1, "Please choose a service"),
  date: z.string().min(1, "Please pick a date"),
  time: z.string().min(1, "Please pick a time"),
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(7, "Enter a valid phone number"),
  notes: z.string().max(500).optional(),
});

type BookingData = z.infer<typeof schema>;

const STEPS = ["Service", "Date & Time", "Your Details"] as const;
const STEP_FIELDS: (keyof BookingData)[][] = [
  ["service"],
  ["date", "time"],
  ["name", "email", "phone"],
];

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
];

export default function BookingForm() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookingData>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      service: "",
      date: "",
      time: "",
      name: "",
      email: "",
      phone: "",
      notes: "",
    },
  });

  const values = watch();
  const today = new Date().toISOString().split("T")[0];

  const next = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = (data: BookingData) => {
    // Placeholder submission — wire this to a booking API or email service.
    console.log("Booking request:", data);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl border border-brass/25 bg-bg-secondary p-12 text-center"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brass text-bg-primary">
          <Check size={32} />
        </div>
        <h2 className="heading-display text-3xl text-text-primary md:text-4xl">
          Thank you, {values.name.split(" ")[0] || "friend"}!
        </h2>
        <p className="mx-auto mt-4 max-w-md text-text-muted">
          We&apos;ve received your request for a{" "}
          <span className="text-brass">{values.service}</span> on{" "}
          <span className="text-brass">{values.date}</span> at{" "}
          <span className="text-brass">{values.time}</span>. The shop will
          confirm shortly. See you in the chair.
        </p>
        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-text-muted">
          Need to change something? Call {SHOP.phone}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="rounded-3xl border border-brass/15 bg-bg-secondary p-6 md:p-10">
      {/* Progress */}
      <ol className="mb-10 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition-colors ${
                i <= step
                  ? "border-brass bg-brass text-bg-primary"
                  : "border-brass/30 text-text-muted"
              }`}
            >
              {i < step ? <Check size={16} /> : i + 1}
            </span>
            <span
              className={`hidden text-xs uppercase tracking-[0.14em] sm:block ${
                i <= step ? "text-text-primary" : "text-text-muted"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={`ml-1 h-px flex-1 ${
                  i < step ? "bg-brass" : "bg-brass/20"
                }`}
              />
            )}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(onSubmit)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            {/* Step 1 — Service */}
            {step === 0 && (
              <fieldset>
                <legend className="heading-display mb-6 text-2xl text-text-primary">
                  Which service?
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SHOP.services.map((s) => {
                    const active = values.service === s.name;
                    return (
                      <label
                        key={s.name}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors ${
                          active
                            ? "border-brass bg-brass/10"
                            : "border-brass/20 hover:border-brass/50"
                        }`}
                      >
                        <input
                          type="radio"
                          value={s.name}
                          {...register("service")}
                          className="sr-only"
                        />
                        <span className="flex items-center gap-3">
                          <Scissors
                            size={18}
                            className={active ? "text-brass" : "text-text-muted"}
                          />
                          <span className="text-text-primary">{s.name}</span>
                        </span>
                        <span className="font-accent text-xl text-brass">
                          {s.price}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {errors.service && (
                  <p className="mt-3 text-sm text-barber-red">
                    {errors.service.message}
                  </p>
                )}
              </fieldset>
            )}

            {/* Step 2 — Date & Time */}
            {step === 1 && (
              <fieldset>
                <legend className="heading-display mb-6 text-2xl text-text-primary">
                  Pick a date &amp; time
                </legend>
                <label className="mb-2 block text-sm text-text-muted">
                  Date
                </label>
                <input
                  type="date"
                  min={today}
                  {...register("date")}
                  className="mb-1 w-full rounded-xl border border-brass/20 bg-bg-primary p-3 text-text-primary outline-none focus:border-brass [color-scheme:dark]"
                />
                {errors.date && (
                  <p className="mb-3 text-sm text-barber-red">
                    {errors.date.message}
                  </p>
                )}

                <p className="mb-2 mt-5 text-sm text-text-muted">Time</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {TIME_SLOTS.map((slot) => {
                    const active = values.time === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() =>
                          setValue("time", slot, { shouldValidate: true })
                        }
                        className={`rounded-lg border py-2 text-sm transition-colors ${
                          active
                            ? "border-brass bg-brass text-bg-primary"
                            : "border-brass/20 text-text-primary hover:border-brass/50"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
                {errors.time && (
                  <p className="mt-3 text-sm text-barber-red">
                    {errors.time.message}
                  </p>
                )}
              </fieldset>
            )}

            {/* Step 3 — Details */}
            {step === 2 && (
              <fieldset className="space-y-4">
                <legend className="heading-display mb-2 text-2xl text-text-primary">
                  Your details
                </legend>
                {(
                  [
                    { name: "name", label: "Full name", type: "text" },
                    { name: "email", label: "Email", type: "email" },
                    { name: "phone", label: "Phone", type: "tel" },
                  ] as const
                ).map((field) => (
                  <div key={field.name}>
                    <label className="mb-2 block text-sm text-text-muted">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      {...register(field.name)}
                      className="w-full rounded-xl border border-brass/20 bg-bg-primary p-3 text-text-primary outline-none focus:border-brass"
                    />
                    {errors[field.name] && (
                      <p className="mt-1 text-sm text-barber-red">
                        {errors[field.name]?.message}
                      </p>
                    )}
                  </div>
                ))}
                <div>
                  <label className="mb-2 block text-sm text-text-muted">
                    Notes (optional)
                  </label>
                  <textarea
                    rows={3}
                    {...register("notes")}
                    className="w-full resize-none rounded-xl border border-brass/20 bg-bg-primary p-3 text-text-primary outline-none focus:border-brass"
                  />
                </div>
              </fieldset>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            disabled={step === 0}
            className="flex items-center gap-1.5 text-sm uppercase tracking-[0.14em] text-text-muted transition-colors enabled:hover:text-brass disabled:opacity-30"
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1.5 rounded-full bg-brass px-7 py-3 text-sm uppercase tracking-[0.14em] text-bg-primary transition-colors hover:bg-text-primary"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full bg-brass px-7 py-3 text-sm uppercase tracking-[0.14em] text-bg-primary transition-colors hover:bg-text-primary"
            >
              Confirm Booking
              <Check size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
