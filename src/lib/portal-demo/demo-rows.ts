import type { RawFacility } from "@/lib/ontology/types";

/**
 * The sample facility's rows: invented, internally consistent, and always
 * recent (every date is relative to `now`), so the sample portal never goes
 * stale. Built to show one of each thing the index links and each gap the
 * moves look for. Nothing here is a real business, person or result.
 */

export const DEMO_FACILITY_ID = "00000000-0000-4000-8000-00000000d3e0";
const DAY = 86_400_000;

/** Deterministic fake uuid: prefix + counter. */
const id = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function demoRows(now: Date): RawFacility {
  const ago = (days: number, hour = 15) => {
    const d = new Date(now.getTime() - days * DAY);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const ahead = (days: number, hour = 16) => ago(-days, hour);
  const date = (days: number) => ago(days).slice(0, 10);

  return {
    facility: { id: DEMO_FACILITY_ID, name: "Maple Street Storage", googleRating: 4.5, reviewCount: 212 },
    units: [
      { id: id("a1", 1), unitType: "5x5", sizeLabel: "5' x 5'", widthFt: 5, depthFt: 5, total: 40, occupied: 37, streetRate: 55, webRate: 49, features: [], lastUpdated: ago(3) },
      { id: id("a1", 2), unitType: "5x10", sizeLabel: "5' x 10'", widthFt: 5, depthFt: 10, total: 60, occupied: 55, streetRate: 75, webRate: 69, features: [], lastUpdated: ago(3) },
      { id: id("a1", 3), unitType: "10x10", sizeLabel: "10' x 10'", widthFt: 10, depthFt: 10, total: 80, occupied: 62, streetRate: 129, webRate: 119, features: ["Drive-up"], lastUpdated: ago(3) },
      { id: id("a1", 4), unitType: "10x10 Climate", sizeLabel: "10' x 10'", widthFt: 10, depthFt: 10, total: 40, occupied: 28, streetRate: 149, webRate: 139, features: ["Climate controlled", "Interior"], lastUpdated: ago(3) },
      { id: id("a1", 5), unitType: "10x15", sizeLabel: "10' x 15'", widthFt: 10, depthFt: 15, total: 40, occupied: 36, streetRate: 169, webRate: 159, features: ["Drive-up"], lastUpdated: ago(3) },
      { id: id("a1", 6), unitType: "10x20", sizeLabel: "10' x 20'", widthFt: 10, depthFt: 20, total: 30, occupied: 24, streetRate: 215, webRate: 199, features: ["Drive-up"], lastUpdated: ago(3) },
      { id: id("a1", 7), unitType: "10x30", sizeLabel: "10' x 30'", widthFt: 10, depthFt: 30, total: 12, occupied: 12, streetRate: 299, webRate: 279, features: ["Drive-up"], lastUpdated: ago(3) },
      { id: id("a1", 8), unitType: "Parking", sizeLabel: null, widthFt: null, depthFt: null, total: 20, occupied: 14, streetRate: 95, webRate: 89, features: ["Outdoor"], lastUpdated: ago(3) },
    ],
    specials: [
      { id: id("b1", 1), name: "First Month $1", description: null, appliesTo: ["10x20", "10x15"], discountType: "first_month", discountValue: 1, startDate: date(40), endDate: date(-24), active: true },
      { id: id("b1", 2), name: "Climate Fall Special", description: "15% off climate units for three months", appliesTo: ["10x10 Climate"], discountType: "percent", discountValue: 15, startDate: date(12), endDate: date(-40), active: true },
      { id: id("b1", 3), name: "Summer Half Off", description: "Half off the first two months", appliesTo: [], discountType: "percent", discountValue: 50, startDate: date(130), endDate: date(38), active: true },
    ],
    campaigns: [
      { id: id("c1", 1), name: "Fall Move Season", status: "live", archetype: "convenience", dailyBudget: 45, createdAt: ago(41), publishedAt: ago(40) },
      { id: id("c1", 2), name: "Big Unit Push", status: "testing", archetype: "urgency", dailyBudget: 20, createdAt: ago(12), publishedAt: ago(11) },
    ],
    ads: [
      { id: id("d1", 1), platform: "meta_feed", angle: "convenience", status: "published", createdAt: ago(40), funnelId: id("c1", 1), headline: "Room for the whole garage", text: "Room for the whole garage. 10x20 drive-up units on Maple Street. First Month $1. Reserve online in two minutes." },
      { id: id("d1", 2), platform: "google_search", angle: "proximity", status: "published", createdAt: ago(38), funnelId: id("c1", 1), headline: "Storage on Maple Street", text: "Storage on Maple Street. Open 7 days. Gate hours 6am to 10pm. Reserve online." },
      { id: id("d1", 3), platform: "meta_feed", angle: "urgency", status: "published", createdAt: ago(11), funnelId: id("c1", 2), headline: "Moving this month?", text: "Moving this month? 10x15 and 10x20 units open now. First Month $1 while they last." },
      { id: id("d1", 4), platform: "meta_feed", angle: "lifestyle", status: "draft", createdAt: ago(16), funnelId: null, headline: "Your hobby needs a home", text: "Your hobby needs a home. 5x10 units from $69 a month." },
      { id: id("d1", 5), platform: "tiktok", angle: "social_proof", status: "draft", createdAt: ago(9), funnelId: null, headline: "Your neighbors store here", text: "Your neighbors store here. Come see why." },
      { id: id("d1", 6), platform: "google_search", angle: "price", status: "approved", createdAt: ago(3), funnelId: id("c1", 2), headline: "10x30 units, drive-up", text: "10x30 drive-up units for contractors and big moves." },
    ],
    pages: [
      { id: id("e1", 1), slug: "maple-fall-move", title: "Fall move season at Maple Street", status: "published", funnelId: id("c1", 1), variationIds: [id("d1", 1), id("d1", 2)], createdAt: ago(41), publishedAt: ago(40), visits30: 412 },
      { id: id("e1", 2), slug: "maple-climate", title: "Climate-controlled units on Maple Street", status: "published", funnelId: null, variationIds: [], createdAt: ago(20), publishedAt: ago(19), visits30: 96 },
      { id: id("e1", 3), slug: "maple-big-units", title: "10x20 and 10x30 drive-up units", status: "published", funnelId: id("c1", 2), variationIds: [id("d1", 3)], createdAt: ago(12), publishedAt: ago(11), visits30: 133 },
      { id: id("e1", 4), slug: "maple-parking", title: "RV and boat parking", status: "draft", funnelId: null, variationIds: [], createdAt: ago(5), publishedAt: null, visits30: 0 },
    ],
    links: [
      { id: id("f2", 1), label: "Fall flyer QR code", shortCode: "MAPLE1", landingPageId: id("e1", 1), utmSource: "flyer", utmMedium: "print", utmCampaign: "fall", clickCount: 88, lastClickedAt: ago(1), createdAt: ago(39) },
      { id: id("f2", 2), label: "Google Business website button", shortCode: "MAPLEG", landingPageId: id("e1", 1), utmSource: "google", utmMedium: "organic", utmCampaign: "gbp", clickCount: 241, lastClickedAt: ago(0), createdAt: ago(60) },
      { id: id("f2", 3), label: "Big unit email", shortCode: "MAPLEB", landingPageId: id("e1", 3), utmSource: "email", utmMedium: "newsletter", utmCampaign: "big-units", clickCount: 37, lastClickedAt: ago(4), createdAt: ago(10) },
      { id: id("f2", 4), label: "Truck rental counter card", shortCode: "MAPLET", landingPageId: null, utmSource: "partner", utmMedium: "print", utmCampaign: null, clickCount: 12, lastClickedAt: ago(8), createdAt: ago(30) },
    ],
    posts: [
      { id: id("a6", 1), channel: "google", title: "First Month $1 on big units", body: "First Month $1 on 10x15 and 10x20 drive-up units this fall.", status: "published", offerCode: null, createdAt: ago(30), publishedAt: ago(30), scheduledAt: null },
      { id: id("a6", 2), channel: "google", title: "New gate hours", body: "The gate now opens at 6am, seven days a week.", status: "published", offerCode: null, createdAt: ago(14), publishedAt: ago(14), scheduledAt: null },
      { id: id("a6", 3), channel: "facebook", title: null, body: "Packing tip: label every box on two sides. You'll thank yourself at the unit.", status: "published", offerCode: null, createdAt: ago(6), publishedAt: ago(6), scheduledAt: null },
      { id: id("a6", 4), channel: "google", title: "Halloween costume swap", body: "Bring a costume, take a costume. Saturday at the office.", status: "scheduled", offerCode: null, createdAt: ago(2), publishedAt: null, scheduledAt: ahead(5) },
    ],
    leads: [
      { id: id("a2", 1), name: "Dana Ruiz", hasContact: true, unitSize: "10x10", status: "new", sourceChannel: "meta", landingPageId: id("e1", 1), funnelId: id("c1", 1), createdAt: ago(2, 13), firstResponseAt: null, matchedTenantId: null, converted: false },
      { id: id("a2", 2), name: "Chris Okafor", hasContact: true, unitSize: "10x10", status: "new", sourceChannel: "google_ads", landingPageId: null, funnelId: null, createdAt: ago(1, 18), firstResponseAt: null, matchedTenantId: null, converted: false },
      { id: id("a2", 3), name: "Pat Lindqvist", hasContact: true, unitSize: "5x10", status: "new", sourceChannel: "organic", landingPageId: null, funnelId: null, createdAt: ago(0, 9), firstResponseAt: null, matchedTenantId: null, converted: false },
      { id: id("a2", 4), name: "Morgan Hale", hasContact: true, unitSize: "10x20", status: "toured", sourceChannel: "meta", landingPageId: id("e1", 3), funnelId: id("c1", 2), createdAt: ago(6), firstResponseAt: ago(6, 16), matchedTenantId: null, converted: false },
      { id: id("a2", 5), name: "Sam Whitfield", hasContact: true, unitSize: "10x15", status: "reserved", sourceChannel: "google_ads", landingPageId: id("e1", 3), funnelId: id("c1", 2), createdAt: ago(8), firstResponseAt: ago(8, 16), matchedTenantId: null, converted: false },
      { id: id("a2", 6), name: "Riley Chen", hasContact: true, unitSize: "10x20", status: "moved_in", sourceChannel: "meta", landingPageId: id("e1", 1), funnelId: id("c1", 1), createdAt: ago(24), firstResponseAt: ago(24, 16), matchedTenantId: id("a3", 1), converted: true },
      { id: id("a2", 7), name: "Avery Brooks", hasContact: true, unitSize: "10x10", status: "moved_in", sourceChannel: "google_ads", landingPageId: id("e1", 1), funnelId: id("c1", 1), createdAt: ago(19), firstResponseAt: ago(19, 16), matchedTenantId: id("a3", 2), converted: true },
      { id: id("a2", 8), name: "Jamie Torres", hasContact: true, unitSize: "5x5", status: "contacted", sourceChannel: "gbp", landingPageId: null, funnelId: null, createdAt: ago(10), firstResponseAt: ago(10, 17), matchedTenantId: null, converted: false },
      { id: id("a2", 9), name: null, hasContact: false, unitSize: "10x10", status: "partial", sourceChannel: "meta", landingPageId: id("e1", 2), funnelId: null, createdAt: ago(4), firstResponseAt: null, matchedTenantId: null, converted: false },
      { id: id("a2", 10), name: "Quinn Adler", hasContact: true, unitSize: "Parking", status: "lost", sourceChannel: "referral", landingPageId: null, funnelId: null, createdAt: ago(33), firstResponseAt: ago(33, 16), matchedTenantId: null, converted: false },
      { id: id("a2", 11), name: "Devon Price", hasContact: true, unitSize: "10x15", status: "moved_in", sourceChannel: "organic", landingPageId: null, funnelId: null, createdAt: ago(46), firstResponseAt: ago(46, 16), matchedTenantId: id("a3", 3), converted: true },
    ],
    tours: [
      { id: id("a4", 1), leadId: id("a2", 4), contactName: "Morgan Hale", sizeLabel: "10x20", scheduledAt: ago(4, 17), status: "completed" },
      { id: id("a4", 2), leadId: id("a2", 5), contactName: "Sam Whitfield", sizeLabel: "10x15", scheduledAt: ahead(1, 16), status: "booked" },
      { id: id("a4", 3), leadId: id("a2", 1), contactName: "Dana Ruiz", sizeLabel: "10x10", scheduledAt: ahead(2, 15), status: "booked" },
    ],
    tenants: [
      { id: id("a3", 1), name: "Riley Chen", unitNumber: "C214", unitSize: "10x20", unitType: null, monthlyRate: 199, moveInDate: date(21), status: "active" },
      { id: id("a3", 2), name: "Avery Brooks", unitNumber: "B107", unitSize: "10x10", unitType: null, monthlyRate: 119, moveInDate: date(16), status: "active" },
      { id: id("a3", 3), name: "Devon Price", unitNumber: "C118", unitSize: "10x15", unitType: null, monthlyRate: 159, moveInDate: date(43), status: "active" },
      { id: id("a3", 4), name: "Lee Park", unitNumber: "A012", unitSize: "5x5", unitType: null, monthlyRate: 49, moveInDate: date(9), status: "active" },
      { id: id("a3", 5), name: "Robin Marsh", unitNumber: "D031", unitSize: "10x10", unitType: "Climate", monthlyRate: 139, moveInDate: date(27), status: "active" },
    ],
    tenantCounts: { active: 258, movedIn30: 4 },
    reviews: [
      { id: id("a5", 1), author: "Sam K.", rating: 2, text: "Gate code didn't work on a Sunday and nobody picked up the phone.", reviewTime: ago(3), hasResponse: false },
      { id: id("a5", 2), author: "Maria G.", rating: 5, text: "Clean, well lit, and the office helped me pick the right size.", reviewTime: ago(5), hasResponse: false },
      { id: id("a5", 3), author: "Theo R.", rating: 5, text: "Easy online reservation. Moved in the same day.", reviewTime: ago(12), hasResponse: true },
      { id: id("a5", 4), author: "Nina P.", rating: 4, text: "Good price for a climate unit. Elevator is slow.", reviewTime: ago(20), hasResponse: true },
      { id: id("a5", 5), author: "Owen D.", rating: 5, text: "Third time renting here. Always clean.", reviewTime: ago(31), hasResponse: true },
      { id: id("a5", 6), author: "Grace L.", rating: 5, text: "Friendly staff and a fair first month deal.", reviewTime: ago(44), hasResponse: true },
    ],
    competitors: [
      { name: "Elm Avenue Self Storage", distanceMiles: 1.8, rating: 4.1, reviewCount: 88, website: null, units: [{ size: "10x10", price: "$99/mo", type: null }, { size: "5x10", price: "$62", type: null }, { size: "10x20", price: "$209", type: null }], promotions: ["$1 first month on select units"] },
      { name: "Northside Storage Center", distanceMiles: 3.2, rating: 4.6, reviewCount: 301, website: null, units: [{ size: "10x10", price: "$134", type: "climate" }, { size: "10x15", price: "$165", type: null }], promotions: [] },
      { name: "Route 9 Mini Storage", distanceMiles: 4.9, rating: 3.8, reviewCount: 42, website: null, units: [{ size: "5x5", price: "$45", type: null }], promotions: ["50% off first two months"] },
    ],
  };
}
