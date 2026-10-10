import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { corsResponse, getOrigin } from "@/lib/api-helpers";

export async function OPTIONS(request: NextRequest) {
  return corsResponse(getOrigin(request));
}

interface Prediction {
  placeId: string;
  name: string;
  address: string;
}

interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  website: string | null;
  country: string | null;
  rating: number | null;
  reviewCount: number | null;
}

/**
 * Facility search for the homepage qualifier. The key stays on the server.
 * When it isn't set, the popup falls back to typed name and city.
 */
export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(
    request,
    RATE_LIMIT_TIERS.EXTERNAL_API_HOURLY,
    "places-suggest"
  );
  if (limited) return limited;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ available: false, results: [] });
  }

  let body: { query?: unknown; placeId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (typeof body.placeId === "string" && body.placeId.trim()) {
      const details = await fetchDetails(body.placeId.trim().slice(0, 200), apiKey);
      return NextResponse.json({ available: true, place: details });
    }

    const query = typeof body.query === "string" ? body.query.trim().slice(0, 120) : "";
    if (query.length < 2) {
      return NextResponse.json({ available: true, results: [] });
    }
    const results = await fetchPredictions(query, apiKey);
    return NextResponse.json({ available: true, results });
  } catch (err) {
    console.error("[places-suggest]", err instanceof Error ? err.message : err);
    return NextResponse.json({ available: false, results: [] });
  }
}

async function fetchPredictions(query: string, apiKey: string): Promise<Prediction[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", query);
  url.searchParams.set("types", "establishment");
  url.searchParams.set("key", apiKey);
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    predictions?: Array<{
      place_id?: string;
      structured_formatting?: { main_text?: string; secondary_text?: string };
      description?: string;
    }>;
  };
  return (data.predictions || []).slice(0, 5).map((p) => ({
    placeId: p.place_id || "",
    name: p.structured_formatting?.main_text || p.description || "",
    address: p.structured_formatting?.secondary_text || "",
  })).filter((p) => p.placeId && p.name);
}

async function fetchDetails(placeId: string, apiKey: string): Promise<PlaceDetails | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "name,formatted_address,website,rating,user_ratings_total,address_components"
  );
  url.searchParams.set("key", apiKey);
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    result?: {
      name?: string;
      formatted_address?: string;
      website?: string;
      rating?: number;
      user_ratings_total?: number;
      address_components?: Array<{ long_name?: string; types?: string[] }>;
    };
  };
  const place = data.result;
  if (!place?.name) return null;
  const country =
    place.address_components?.find((c) => c.types?.includes("country"))?.long_name || null;
  return {
    placeId,
    name: place.name,
    address: place.formatted_address || "",
    website: place.website || null,
    country,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.user_ratings_total === "number" ? place.user_ratings_total : null,
  };
}
