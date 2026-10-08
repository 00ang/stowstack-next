/**
 * Day-3 line of the recovery drip. Names a special only when the facility
 * is actually running it. Never invents "first month free".
 */
export function recoveryDay3Message(
  facilityName: string,
  offers: { name?: string | null; description?: string | null; active?: boolean | null }[],
): string {
  const running = offers.find((offer) => {
    if (offer.active === false) return false;
    return Boolean(offer.name?.trim() || offer.description?.trim());
  });
  if (!running) {
    return `Still looking at a unit at ${facilityName}? Reply and we'll hold one.`;
  }
  const label = (running.name?.trim() || running.description?.trim() || "").trim();
  return `Still interested? ${label} is on at ${facilityName}.`;
}
