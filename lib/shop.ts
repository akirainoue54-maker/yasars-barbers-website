export const SHOP = {
  name: "Yasar's Barbers",
  tagline: "Turkish Craftsmanship. Modern Edge.",
  owner: "Yaşar",
  address: "275 Whitworth Rd, Swindon SN25 3BU, United Kingdom",
  phone: "+44 7453 322056",
  email: "info@yasarsbarbers.co.uk", // placeholder
  facebook: "https://www.facebook.com/profile.php?id=100063602589314",
  googleMaps: "https://maps.app.goo.gl/LJE18EED3s2L1bJe8",
  coordinates: { lat: 51.5839, lng: -1.7889 }, // Swindon SN25 3BU area
  hours: {
    "Mon-Sat": "09:00 – 19:00",
    Sunday: "10:00 – 17:00",
  },
  services: [
    {
      name: "Men's Haircut",
      duration: "30 min",
      price: "£15",
      description:
        "A precision cut tailored to your face shape and style, finished with a sharp line-up and styling.",
    },
    {
      name: "Skin Fade",
      duration: "40 min",
      price: "£18",
      description:
        "A seamless blend from skin to length, sculpted freehand and clipper-over-comb for a crisp gradient.",
    },
    {
      name: "Beard Trim",
      duration: "20 min",
      price: "£10",
      description:
        "Shaping, sculpting and detailing of the beard with hot towel prep and conditioning oil.",
    },
    {
      name: "Hot Towel Shave",
      duration: "30 min",
      price: "£20",
      description:
        "The traditional Turkish ritual — steaming towels, rich lather and a clean straight-razor finish.",
    },
    {
      name: "Head Shave",
      duration: "25 min",
      price: "£12",
      description:
        "A smooth, close head shave with hot towel preparation and a soothing balm to finish.",
    },
    {
      name: "Eyebrow Shaping",
      duration: "10 min",
      price: "£5",
      description:
        "Clean, defined brows shaped with traditional threading and trimming techniques.",
    },
    {
      name: "Kids' Cut (under 12)",
      duration: "25 min",
      price: "£10",
      description:
        "A patient, friendly cut for younger gentlemen — we're great with kids of every age.",
    },
  ],
  // Selected from real Google reviews
  testimonials: [
    {
      name: "Jaroslaw S.",
      text: "Best barbers in Swindon, would 100% recommend.",
      rating: 5,
    },
    {
      name: "Customer",
      text: "Best barbershop in Swindon. Good with kids too.",
      rating: 5,
    },
    {
      name: "Customer",
      text: "Extremely friendly and professional service. Yaşar is a very skilled barber.",
      rating: 5,
    },
    {
      name: "Customer",
      text: "Top barbers. Won't go anywhere else!",
      rating: 5,
    },
    {
      name: "Customer",
      text: "Great professional job and a good price.",
      rating: 5,
    },
  ],
} as const;

export type Service = (typeof SHOP.services)[number];
export type Testimonial = (typeof SHOP.testimonials)[number];

export const SITE_URL = "https://yasarsbarbers.co.uk";
