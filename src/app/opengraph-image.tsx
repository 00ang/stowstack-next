import { ImageResponse } from "next/og";

export const alt = "StorageAds. Ads, pages, and reservations that become move-ins";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
          backgroundColor: "#E0E0E5",
          position: "relative",
        }}
      >
        {/* Blue accent line at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "#446386",
          }}
        />

        {/* Main text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#141413",
              letterSpacing: "-2px",
            }}
          >
            StorageAds
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#141413",
              letterSpacing: "-0.5px",
            }}
          >
            Ads, pages, and reservations that become move-ins
          </div>
        </div>

        {/* Blue accent element at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: "60px",
            width: "80px",
            height: "4px",
            borderRadius: "2px",
            backgroundColor: "#446386",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
