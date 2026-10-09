import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "StorageAds. Ads, pages, and reservations that become move-ins";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const hand = readFileSync(join(process.cwd(), "public/hand-mark.png"));
const manrope = readFileSync(join(process.cwd(), "src/fonts/Manrope-800.ttf"));

export default function OGImage() {
  const handSrc = `data:image/png;base64,${hand.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E0E0E5",
          gap: 36,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={handSrc} width={148} height={148} alt="" />
        <div
          style={{
            fontFamily: "Manrope",
            fontWeight: 800,
            fontSize: 88,
            letterSpacing: "-0.045em",
            lineHeight: 0.85,
            color: "#16161A",
          }}
        >
          StorageAds
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Manrope", data: manrope, weight: 800, style: "normal" }],
    },
  );
}
