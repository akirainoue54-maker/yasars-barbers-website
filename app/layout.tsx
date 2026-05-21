import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { SHOP, SITE_URL } from "@/lib/shop";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SmoothScroll from "@/components/layout/SmoothScroll";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SHOP.name} — ${SHOP.tagline}`,
    template: `%s · ${SHOP.name}`,
  },
  description:
    "Yasar's Barbers is a traditional Turkish barbershop in Swindon — precision haircuts, skin fades, beard sculpting and hot-towel shaves by master barber Yaşar.",
  keywords: [
    "barber Swindon",
    "Turkish barber",
    "skin fade Swindon",
    "hot towel shave",
    "beard trim Swindon",
    "Yasar's Barbers",
  ],
  authors: [{ name: SHOP.name }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: SITE_URL,
    siteName: SHOP.name,
    title: `${SHOP.name} — ${SHOP.tagline}`,
    description:
      "Traditional Turkish barbering with a modern edge, in Swindon. Book your cut, fade or shave with Yaşar.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SHOP.name} — ${SHOP.tagline}`,
    description:
      "Traditional Turkish barbering with a modern edge, in Swindon.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0908",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HairSalon",
  name: SHOP.name,
  description:
    "Traditional Turkish barbershop in Swindon offering haircuts, skin fades, beard trims and hot-towel shaves.",
  image: `${SITE_URL}/opengraph-image`,
  url: SITE_URL,
  telephone: SHOP.phone,
  email: SHOP.email,
  priceRange: "££",
  address: {
    "@type": "PostalAddress",
    streetAddress: "275 Whitworth Rd",
    addressLocality: "Swindon",
    postalCode: "SN25 3BU",
    addressCountry: "GB",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: SHOP.coordinates.lat,
    longitude: SHOP.coordinates.lng,
  },
  hasMap: SHOP.googleMaps,
  sameAs: [SHOP.facebook],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "09:00",
      closes: "19:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Sunday",
      opens: "10:00",
      closes: "17:00",
    },
  ],
  makesOffer: SHOP.services.map((s) => ({
    "@type": "Offer",
    itemOffered: { "@type": "Service", name: s.name },
    price: s.price.replace("£", ""),
    priceCurrency: "GBP",
  })),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-GB"
      className={`${playfair.variable} ${inter.variable} ${bebas.variable}`}
    >
      <body className="grain antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SmoothScroll />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
