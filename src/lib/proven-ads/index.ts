export {
  PROVEN_DAYS,
  STALE_AFTER_DAYS,
  confirmedThrough,
  daysRunning,
  isProven,
  shouldMarkInactive,
  spanLabel,
  whyFlagged,
} from "./days-running";
export { classify, classifyOffer, classifyUnit, classifyAngle, classifyFormat } from "./classify";
export { adapterCoverage, getAdapter, ADAPTERS } from "./adapters";
export { upsertProvenAd, upsertMany, applyInsight } from "./upsert";
export { loadFacilitySnapshot, parseCityState } from "./facility-snapshot";
export {
  adaptForFacility,
  fallbackAdapt,
  scrubAdapted,
  bannedPhrases,
  persistAdaptedDraft,
} from "./adapt";
export { refreshProvenAds, seedDefaultSearches, sweepStale, DEFAULT_SEARCHES } from "./refresh";
export type { ProvenAdDraft, AdaptedCopy, FacilitySnapshot, ProvenAdInsight } from "./types";
export { generateInsight, insightRequestParams, parseInsightOutput, INSIGHT_MODEL } from "./insight";
export { scheduleInsights, writeProvenAdInsights, INSIGHTS_QUEUE } from "./insights-job";
export { groupFamilies, mapObservation } from "./adapters/meta-ad-library-web";
