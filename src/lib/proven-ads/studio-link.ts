/** Ad Studio deep link for a draft created from a proven ad. */
export function adStudioDraftPath(studioUrl: string, facilityId: string): string {
  const url = new URL(studioUrl, "https://storageads.local");
  url.searchParams.set("facility", facilityId);
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ""}`;
}
