import { ImageResponse } from "next/og";
import { SHOP } from "@/lib/shop";

export const alt = `${SHOP.name} — ${SHOP.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0a0908 0%, #1a1715 100%)",
          color: "#f5f1ea",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            display: "flex",
            letterSpacing: "0.35em",
            fontSize: 26,
            color: "#c9a961",
            textTransform: "uppercase",
          }}
        >
          Swindon · Turkish Barbershop
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 110,
            fontWeight: 700,
            marginTop: 24,
          }}
        >
          Yasar&apos;s{" "}
          <span style={{ color: "#c9a961", marginLeft: 24 }}>Barbers</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "#8b8680",
            marginTop: 20,
          }}
        >
          {SHOP.tagline}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            gap: 12,
          }}
        >
          <div style={{ width: 60, height: 6, background: "#c8362d" }} />
          <div style={{ width: 60, height: 6, background: "#f5f1ea" }} />
          <div style={{ width: 60, height: 6, background: "#1e3a5f" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
