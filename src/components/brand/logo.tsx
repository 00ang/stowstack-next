import { Manrope } from "next/font/google";

/**
 * The StorageAds mark: a blocky hand, plus the open lockup
 * (hand + StorageAds, no box, no shadow). Geometry is the founder's
 * hand-logo.svg: viewBox 0 0 120 120, ink rects.
 */

const wordmark = Manrope({
  weight: "800",
  subsets: ["latin"],
  display: "swap",
});

export function HandMark({
  size = 32,
  title,
}: {
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect x="16" y="54" width="66" height="56" fill="currentColor" />
      <rect x="16" y="18" width="12" height="42" fill="currentColor" />
      <rect x="34" y="8" width="12" height="52" fill="currentColor" />
      <rect x="52" y="14" width="12" height="46" fill="currentColor" />
      <rect x="70" y="24" width="12" height="36" fill="currentColor" />
      <rect x="82" y="60" width="24" height="14" fill="currentColor" />
    </svg>
  );
}

/**
 * Open lockup. `mark` is the hand height in px. The word is Manrope 800
 * at about 0.76 of that, matching the founder's open lockup (116px hand, 88px word).
 */
export function Logo({
  mark = 28,
  word = true,
  className,
}: {
  mark?: number;
  word?: boolean;
  className?: string;
}) {
  const fontSize = Math.round(mark * (88 / 116));
  const gap = Math.round(mark * (28 / 116));
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        color: "var(--color-dark, #16161A)",
        lineHeight: 1,
      }}
    >
      <HandMark size={mark} title={word ? undefined : "StorageAds"} />
      {word ? (
        <span
          className={wordmark.className}
          style={{
            fontWeight: 800,
            letterSpacing: "-0.045em",
            fontSize,
            lineHeight: 0.85,
            color: "inherit",
          }}
        >
          StorageAds
        </span>
      ) : null}
    </span>
  );
}
