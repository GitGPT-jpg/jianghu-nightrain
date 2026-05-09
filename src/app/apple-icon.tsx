import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 82,
          fontWeight: 700,
          borderRadius: 42,
        }}
      >
        灯
      </div>
    ),
    size,
  );
}
