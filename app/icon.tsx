import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0908",
          color: "#c9a961",
          fontSize: 44,
          fontWeight: 700,
          fontFamily: "serif",
          borderRadius: 12,
        }}
      >
        Y
      </div>
    ),
    { ...size },
  );
}
