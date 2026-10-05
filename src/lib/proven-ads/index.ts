export { PROVEN_DAYS, STALE_AFTER_DAYS, daysRunning, isProven, shouldMarkInactive, whyFlagged } from "./days-running";
export { classify, classifyOffer, classifyUnit, classifyAngle, classifyFormat } from "./classify";
export { adapterCoverage, getAdapter, ADAPTERS } from "./adapters";
export { upsertProvenAd, upsertMany } from "./upsert";
export { loadFacilitySnapshot, parseCityState } from "./facility-snapshot";
export {
  adaptForFacility,
  fallbackAdapt,
  scrubAdapted,
  bannedPhrases,
  persistAdaptedDraft,
} from "./adapt";
export { refreshProvenAds, seedDefaultSearches, sweepStale, DEFAULT_SEARCHES } from "./refresh";
export type { ProvenAdDraft, AdaptedCopy, FacilitySnapshot } from "./types";
