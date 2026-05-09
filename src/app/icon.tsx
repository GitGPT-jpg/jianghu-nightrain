import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

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
          background: "linear-gradient(135deg, #0a1a29 0%, #103245 54%, #081521 100%)",
          color: "#f5f7fb",
          fontSize: 220,
          fontWeight: 700,
          borderRadius: 96,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 42,
            borderRadius: 72,
            border: "6px solid rgba(255,255,255,0.12)",
            background: "radial-gradient(circle at top, rgba(54,225,178,0.25), transparent 46%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 88,
            right: 88,
            width: 66,
            height: 66,
            borderRadius: 999,
            background: "#ffcb74",
            boxShadow: "0 0 48px rgba(255,203,116,0.55)",
          }}
        />
        <span style={{ zIndex: 1 }}>灯</span>
      </div>
    ),
    size,
  );
}
