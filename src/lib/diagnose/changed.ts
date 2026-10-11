import type { Digest, GapKind, PictureStamps } from "./picture";

/**
 * One sentence on why the list is different from the last time we read
 * this facility. Null the first time, and null when nothing material moved.
 */

const TITLES: Record<GapKind, string> = {
  demand: "Not enough people asking",
  conversion: "People asking and then going quiet",
  retention: "Move-outs keeping up",
  lease_up: "Lease-up",
  vacant_sizes: "Empty sizes",
  google: "Google",
  online_rental: "Online rental",
  rates: "The rate",
};

export function whyChanged(
  prev: Digest | null,
  next: Digest,
  prevStamps: PictureStamps | null,
  nextStamps: PictureStamps,
): string | null {
  if (!prev || !prevStamps) return null;
  if (prev.fingerprint === next.fingerprint) return null;

  const prevIds = new Set(prev.gaps.map((g) => g.id));
  const nextIds = new Set(next.gaps.map((g) => g.id));
  const appeared = next.gaps.find((g) => !prevIds.has(g.id));
  if (appeared) {
    const via = appeared.evidence[0]?.sourceLabel;
    return via ? `${TITLES[appeared.kind]} is on the list now, ${via}.` : `${TITLES[appeared.kind]} is on the list now.`;
  }
  const gone = prev.gaps.find((g) => !nextIds.has(g.id));
  if (gone) return `${TITLES[gone.kind]} came off the list.`;

  if (prevStamps.pmsUnitsAt !== nextStamps.pmsUnitsAt && nextStamps.pmsUnitsAt) {
    return "A new PMS upload changed which sizes are empty.";
  }
  if (prevStamps.snapshotAt !== nextStamps.snapshotAt && nextStamps.snapshotAt) {
    return "A new PMS snapshot changed the move-in and move-out counts.";
  }
  if (prevStamps.intakeKey !== nextStamps.intakeKey && nextStamps.intakeKey) {
    return "Your answers changed, so this list did too.";
  }
  if (!prevStamps.callsKnown && nextStamps.callsKnown) return "Call logs came in, so this list did too.";
  if (!prevStamps.adsKnown && nextStamps.adsKnown) return "Ad results came in, so this list did too.";
  if (!prevStamps.googleKnown && nextStamps.googleKnown) return "Google came in, so this list did too.";

  if (prev.gaps[0]?.id !== next.gaps[0]?.id && next.gaps[0]) {
    return `The top of the list is now ${TITLES[next.gaps[0].kind].toLowerCase()}.`;
  }
  const shifted = next.gaps.find((g) => {
    const old = prev.gaps.find((p) => p.id === g.id);
    return old != null && Math.abs(old.severity - g.severity) >= 8;
  });
  if (shifted) return `${TITLES[shifted.kind]} moved after new numbers came in.`;
  return "New numbers came in, so this list was read again.";
}
