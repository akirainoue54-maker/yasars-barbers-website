# Yasar's Barbers — Website

A premium, 3D-animated website for **Yasar's Barbers**, a traditional Turkish
barbershop in Swindon, UK. Built as an immersive, cinematic single-page
experience with supporting Services and Booking pages.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** with CSS variables
- **Three.js** via `@react-three/fiber`, `@react-three/drei`,
  `@react-three/postprocessing`
- **GSAP** + ScrollTrigger, **Framer Motion**, **Lenis** (smooth scroll)
- **React Hook Form** + **Zod** (multi-step booking form)
- `lucide-react` icons

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build
npm run start    # serve the production build
```

Deploy to **Vercel** — no configuration needed.

## Project structure

```
app/
  layout.tsx            Fonts, metadata, JSON-LD, Lenis, header/footer
  page.tsx              Home (all 3D sections)
  services/page.tsx     Service menu & pricing
  booking/page.tsx      Multi-step booking form
  opengraph-image.tsx   Auto-generated OG image
  icon.tsx              Auto-generated favicon
  sitemap.ts / robots.ts
  globals.css           Design tokens & base styles
components/
  three/                BarberPole, Razor, Particles, Scene
  sections/             Hero, About, Services, Gallery, Testimonials, Location
  ui/                   Button, MagneticLink, SplitText
  layout/               Header, Footer, SmoothScroll
  booking/              BookingForm
lib/
  shop.ts               All business data (single source of truth)
  gsap.ts               GSAP/ScrollTrigger registration
hooks/
  useLenis.ts           Smooth scroll
  useMagnetic.ts        Magnetic hover effect
public/
  gallery/  images/  models/   Placeholder asset folders
```

## Customising the site

### Business details

Everything — name, address, phone, hours, services, prices, testimonials —
lives in **`lib/shop.ts`**. Edit that single file to update the whole site,
including the structured data and SEO metadata.

> The email (`info@yasarsbarbers.co.uk`) is a **placeholder** — replace it
> with the real address.

### Gallery images

The WebGL gallery (`components/sections/Gallery.tsx`) currently renders
**procedurally generated placeholder panels**, so the site looks complete with
no assets.

To use real photography:

1. Add photos to `public/gallery/` (e.g. `cut-01.jpg` … `cut-08.jpg`,
   ideally portrait, ~600×800 or larger, WebP/AVIF/JPG).
2. In `Gallery.tsx`, replace the `makePanelTexture(...)` call in the
   `textures` memo with `new THREE.TextureLoader().load("/gallery/cut-0X.jpg")`
   for each panel.

### 3D models

All 3D objects (barber pole, razor, shop miniature) are built from Three.js
**primitives** — no external `.glb` files are required. Drop `.glb` files into
`public/models/` only if you want to swap in custom models later.

### Booking form submission

The booking form (`components/booking/BookingForm.tsx`) is a working
multi-step UI. Submission is **stubbed** — it logs the payload with
`console.log` and shows a thank-you message.

To make it live, replace the body of `onSubmit` with a call to your booking
API, an email service, or a form provider.

### OG image & favicon

Both are generated at build time from `app/opengraph-image.tsx` and
`app/icon.tsx`. Edit those files to restyle them — no static image assets
needed.

## Accessibility & performance

- Respects `prefers-reduced-motion` — animations and 3D motion are disabled
  for users who request it.
- 3D scenes are lightened on mobile (fewer particles, lower DPR, no
  post-processing).
- Semantic HTML, ARIA labels, and a brass-coloured keyboard focus ring.
- `LocalBusiness` (`HairSalon`) JSON-LD, sitemap, robots, OpenGraph and
  Twitter metadata are all included.
