import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { list, param, type FunnelGraph, type FunnelNode, type NodeType } from "@/lib/funnel-graph";
import { PartialPublish, publishToGoogle, publishToMeta, type PlatformConnection } from "@/lib/ad-publish";
import {
  buildFacilityContext,
  generateGoogleRSA,
  generateMetaAds,
  getNextVersion,
  getOrCreateBrief,
  insertVariations,
} from "@/lib/creative-generation";
import { generateLandingPage } from "@/lib/landing-page-generation";
import { publishPage } from "@/lib/page-blocks/persist";
import { adaptForFacility, persistAdaptedDraft } from "@/lib/proven-ads/adapt";
import { loadFacilitySnapshot } from "@/lib/proven-ads/facility-snapshot";
import { messagingLive } from "@/lib/messaging";
import { normalisePhone } from "@/lib/messaging/types";
import { followUpDays, followUpSteps, followUpTrigger } from "./follow-up";
import { findDownstream, findUpstream, pageUrl, trackingUrl } from "./order";
import { writeSetting } from "./store";
import type { NodeResult } from "./types";

/**
 * What each function does when its campaign is published.
 *
 * Every executor is safe to run again: it looks for what an earlier run made
 * (by the ids in its last result, then by what the campaign owns) before it
 * makes anything. Each returns one result in plain words; none throws for an
 * expected problem, so one function failing never stops the rest.
 */

export interface PublishContext {
  funnelId: string;
  funnelName: string;
  facility: {
    id: string;
    name: string;
    address: string | null;
    contactPhone: string | null;
  };
  graph: FunnelGraph;
  /** Results so far, this run and earlier ones. */
  results: Record<string, NodeResult>;
  /** Public site, for page links. */
  base: string;
}

type Exec = (ctx: PublishContext, node: FunnelNode, prior: NodeResult | undefined) => Promise<NodeResult>;

const now = () => new Date().toISOString();
const result = (state: NodeResult["state"], line: string, extra: Partial<NodeResult> = {}): NodeResult => ({
  state,
  line,
  at: now(),
  ...extra,
});
const done = (line: string, extra?: Partial<NodeResult>) => result("done", line, extra);
const needs = (line: string, tool?: { tool: string; label: string }, extra?: Partial<NodeResult>) =>
  result("needs", line, { ...(tool ? { fix: tool } : {}), ...extra });
const waiting = (line: string, extra?: Partial<NodeResult>) => result("waiting", line, extra);
const skipped = (line: string) => result("skipped", line);

const CONNECT_ADS = { tool: "ad-publisher", label: "Connect in Publish Ads" };
const ADDRESS = { tool: "settings", label: "Add the address" };

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function settled(r: NodeResult | undefined): boolean {
  return !!r && (r.state === "done" || r.state === "paused");
}

/** The ad copy feeding this function (written or recreated), if it was made. */
function upstreamAd(ctx: PublishContext, node: FunnelNode, hops = 1): { nodeId: string; variationId: string } | null {
  for (const n of findUpstream(ctx.graph, node.id, ["write", "proven"], hops)) {
    const r = ctx.results[n.id];
    if (settled(r) && r.ref?.variationId) return { nodeId: n.id, variationId: r.ref.variationId };
  }
  return null;
}

/** The page this channel sends people to, if it is live. */
function downstreamPage(ctx: PublishContext, node: FunnelNode): { nodeId: string; url: string; pageId: string } | null {
  for (const n of findDownstream(ctx.graph, node.id, ["page"], 1)) {
    const r = ctx.results[n.id];
    if (settled(r) && r.ref?.url && r.ref.pageId) return { nodeId: n.id, url: r.ref.url, pageId: r.ref.pageId };
  }
  return null;
}

function campaignPages(ctx: PublishContext): string[] {
  return ctx.graph.nodes
    .filter((n) => n.type === "page")
    .map((n) => ctx.results[n.id]?.ref?.pageId)
    .filter((id): id is string => !!id);
}

function radiusMiles(ctx: PublishContext, node: FunnelNode): number {
  const audience = findUpstream(ctx.graph, node.id, ["audience"], 3)[0] ?? ctx.graph.nodes.find((n) => n.type === "audience");
  const miles = Number(audience ? param(audience, "radius") : "");
  return Number.isFinite(miles) && miles > 0 ? miles : 5;
}

/** The ids a platform publish made, without its status words. */
function platformIds(response: Record<string, unknown>): Record<string, string> {
  const words = new Set(["note", "status", "campaignStatus"]);
  return Object.fromEntries(
    Object.entries(response).filter((e): e is [string, string] => typeof e[1] === "string" && !words.has(e[0])),
  );
}

function shortAddress(address: string): string {
  return address.split(",").slice(0, 2).join(",").trim();
}

async function connection(facilityId: string, platform: string): Promise<PlatformConnection | null> {
  const row = await db.platform_connections.findFirst({
    where: { facility_id: facilityId, platform, status: "connected" },
  });
  return row ? { ...row, metadata: (row.metadata as Record<string, unknown> | null) ?? null } : null;
}

/** Merge feature switches into the campaign's pages' theme (read by /lp/[slug]). */
async function setPageFeature(pageIds: string[], feature: string, value: unknown): Promise<void> {
  if (!pageIds.length) return;
  const patch = JSON.stringify({ [feature]: value });
  await db.$executeRaw`
    UPDATE landing_pages
    SET theme = coalesce(theme, '{}'::jsonb) || jsonb_build_object(
          'features', coalesce(theme->'features', '{}'::jsonb) || ${patch}::jsonb
        ),
        updated_at = now()
    WHERE id = ANY(${pageIds}::uuid[])
  `;
}

/* ── Space ─────────────────────────────────────────────────────────────── */

const units: Exec = async (_ctx, node) => {
  const n = list(node.params.sizes).length;
  return done(`Reads ${plural(n, "size")} from your unit data. Nothing is written.`);
};

const offer: Exec = async (ctx, node) => {
  const id = param(node, "offer");
  const special = id
    ? await db.facility_pms_specials.findFirst({
        where: { id, facility_id: ctx.facility.id },
        select: { name: true, active: true },
      }).catch(() => null)
    : null;
  if (!special || special.active === false) {
    return needs("That special isn't running any more. Pick one that is, or take the Offer off.", {
      tool: "canvas",
      label: "Pick a special",
    });
  }
  return done(`Names “${special.name}” in the ad and the page. Never invents one.`, { ref: { offerName: special.name } });
};

const audience: Exec = async (ctx, node) => {
  if (!ctx.facility.address) {
    return needs("Add the facility's street address so the ads run near it, not everywhere.", ADDRESS);
  }
  const miles = Number(param(node, "radius")) || 5;
  const who = param(node, "who") || "movers";
  await db.funnels.update({
    where: { id: ctx.funnelId },
    data: { target_audience: { radiusMiles: miles, who, address: ctx.facility.address } },
  });
  const whoLine = who === "past" ? ", starting with past leads" : who === "look" ? ", people like your tenants" : "";
  return done(`Within ${miles} miles of ${shortAddress(ctx.facility.address)}${whoLine}.`);
};

const waitlist: Exec = async () =>
  waiting("The waitlist form isn't on landing pages yet. Leads for a full size still come in, and you can add them by hand.");

/* ── Reach: the ad copy ────────────────────────────────────────────────── */

async function existingVariation(facilityId: string, id: string | undefined) {
  if (!id) return null;
  return db.ad_variations.findFirst({ where: { id, facility_id: facilityId }, select: { id: true, content_json: true } });
}

function headlineOf(content: unknown): string {
  const c = (content ?? {}) as Record<string, unknown>;
  return typeof c.headline === "string" && c.headline ? c.headline : "the ad";
}

const write: Exec = async (ctx, node, prior) => {
  const kept = await existingVariation(ctx.facility.id, prior?.ref?.variationId);
  if (kept) {
    return done(`Wrote “${headlineOf(kept.content_json)}”.`, {
      ref: { variationId: kept.id },
      fix: { tool: "creative-studio", label: "Open the ad" },
    });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return result("failed", "Writing isn't available right now.", { error: "ANTHROPIC_API_KEY not set" });

  const built = await buildFacilityContext(ctx.facility.id);
  if (!built) return result("failed", "The facility couldn't be read.", { error: "facility not found" });
  const parsed = (await generateMetaAds(built.context, null, apiKey, ctx.facility.id)) as {
    variations?: Record<string, unknown>[];
  };
  const variations = parsed.variations ?? [];
  const angle = param(node, "angle");
  const chosen = variations.find((v) => v.angle === angle) ?? variations[0];
  if (!chosen) return result("failed", "The ad came back empty. Try again.", { error: "no variations" });

  const briefId = await getOrCreateBrief(ctx.facility.id, built.facility, built.context, ["meta_feed"]);
  const [row] = await insertVariations([chosen], ctx.facility.id, briefId, "meta_feed", "static", await getNextVersion(ctx.facility.id));
  await db.ad_variations.update({ where: { id: row.id }, data: { funnel_id: ctx.funnelId, status: "approved" } });
  return done(`Wrote “${headlineOf(chosen)}”.`, {
    ref: { variationId: row.id },
    fix: { tool: "creative-studio", label: "Open the ad" },
  });
};

const proven: Exec = async (ctx, node, prior) => {
  const kept = await existingVariation(ctx.facility.id, prior?.ref?.variationId);
  if (kept) return done(`Recreated “${headlineOf(kept.content_json)}” for this campaign.`, { ref: { variationId: kept.id } });

  const src = param(node, "src");
  // One of the facility's own ads: copied, so the original stays as it was.
  const own = src
    ? await db.ad_variations.findFirst({ where: { id: src, facility_id: ctx.facility.id } }).catch(() => null)
    : null;
  if (own) {
    const copy = await db.ad_variations.create({
      data: {
        facility_id: ctx.facility.id,
        brief_id: own.brief_id,
        platform: own.platform,
        format: own.format,
        angle: own.angle,
        content_json: own.content_json as Prisma.InputJsonValue,
        status: "approved",
        version: own.version,
        funnel_id: ctx.funnelId,
      },
    });
    return done(`Recreated “${headlineOf(own.content_json)}” for this campaign.`, { ref: { variationId: copy.id } });
  }

  // A Proven Ads library entry: rewritten for this facility.
  const library = src ? await db.proven_ads.findUnique({ where: { id: src } }).catch(() => null) : null;
  if (!library) return needs("The ad this starts from is gone. Pick another.", { tool: "canvas", label: "Pick an ad" });
  const facility = await loadFacilitySnapshot(ctx.facility.id);
  if (!facility) return result("failed", "The facility couldn't be read.", { error: "facility snapshot missing" });
  const { copy } = await adaptForFacility(
    {
      advertiser_name: library.advertiser_name,
      headline: library.headline,
      primary_text: library.primary_text,
      description: library.description,
      cta: library.cta,
      city: library.city,
      angle: library.angle,
      offer_type: library.offer_type,
      format: library.format,
      platform: library.platform,
      read: null,
    },
    facility,
    process.env.ANTHROPIC_API_KEY ?? null,
  );
  const draft = await persistAdaptedDraft({
    facilityId: ctx.facility.id,
    provenAdId: library.id,
    copy,
    format: library.format,
    platform: library.platform,
  });
  await db.ad_variations.update({ where: { id: draft.id }, data: { funnel_id: ctx.funnelId, status: "approved" } });
  return done(`Rewrote “${copy.headline ?? "the ad"}” for ${ctx.facility.name}.`, { ref: { variationId: draft.id } });
};

/* ── Convert ───────────────────────────────────────────────────────────── */

const page: Exec = async (ctx, node, prior) => {
  const slug = node.slug || `${ctx.funnelId.slice(0, 8)}-${node.id}`;
  const linked = param(node, "page") || prior?.ref?.pageId;
  let row =
    (linked
      ? await db.landing_pages.findFirst({ where: { id: linked, facility_id: ctx.facility.id } })
      : null) ??
    (await db.landing_pages.findFirst({ where: { funnel_id: ctx.funnelId, slug: { startsWith: slug } } }));

  if (!row) {
    const ad = findUpstream(ctx.graph, node.id, ["write", "proven"], 3)
      .map((n) => ctx.results[n.id]?.ref?.variationId)
      .find(Boolean);
    const made = await generateLandingPage({
      facilityId: ctx.facility.id,
      adVariationId: ad ?? null,
      slug,
      funnelId: ctx.funnelId,
      publish: false,
    });
    row = made.page;
  }

  // Publish the draft that is there (an operator's page, or the one just
  // generated). A later edit stays a draft until this runs again.
  let live: { slug: string };
  try {
    live = await publishPage(row.id);
  } catch (err) {
    return result("failed", "The page didn’t publish.", { error: err instanceof Error ? err.message : "publish failed" });
  }

  const url = pageUrl(ctx.base, live.slug);
  const host = url.replace(/^https?:\/\//, "");
  return done(`Live at ${host}.`, {
    ref: { pageId: row.id, slug: live.slug, url },
    href: url,
    hrefLabel: "Open the page",
    external: true,
  });
};

const reserve: Exec = async (ctx, node) => {
  const pages = findUpstream(ctx.graph, node.id, ["page"], 2)
    .map((n) => ctx.results[n.id]?.ref?.pageId)
    .filter((id): id is string => !!id);
  if (!pages.length) return skipped("Waits on the page.");
  if (param(node, "src") === "hold") {
    return waiting("Holding a unit from the page isn't built yet. Leads still come in, and you hold one when you call back.");
  }
  let withWidget = await db.landing_pages.count({ where: { id: { in: pages }, storedge_widget_url: { not: null } } });
  if (!withWidget) {
    // The link lives per page; reuse the one the facility's other pages already carry.
    const known = await db.landing_pages.findFirst({
      where: { facility_id: ctx.facility.id, storedge_widget_url: { not: null } },
      select: { storedge_widget_url: true },
      orderBy: { updated_at: "desc" },
    });
    if (known?.storedge_widget_url) {
      await db.landing_pages.updateMany({
        where: { id: { in: pages }, storedge_widget_url: null },
        data: { storedge_widget_url: known.storedge_widget_url },
      });
      withWidget = pages.length;
    }
  }
  if (!withWidget) {
    return needs("Add your storEDGE reservation link to the page so people can reserve there.", {
      tool: "landing-pages",
      label: "Add the link",
    });
  }
  await setPageFeature(pages, "reserve", "storedge");
  return done("People can reserve on the page through storEDGE. Reservations come back to you by webhook.");
};

const tour: Exec = async (ctx, node) => {
  const pages = findUpstream(ctx.graph, node.id, ["page"], 4)
    .map((n) => ctx.results[n.id]?.ref?.pageId)
    .filter((id): id is string => !!id);
  const targets = pages.length ? pages : campaignPages(ctx);
  if (!targets.length) return skipped("Waits on the page.");
  await setPageFeature(targets, "tour", true);
  return done(
    messagingLive()
      ? "People can book a tour right after they ask. It's confirmed by text, with reminders."
      : "People can book a tour right after they ask. Confirmation texts start once your texting number is registered.",
  );
};

/* ── Respond ───────────────────────────────────────────────────────────── */

const textback: Exec = async (ctx, node) => {
  const phone = normalisePhone(param(node, "phone")) ?? normalisePhone(ctx.facility.contactPhone);
  if (!phone) return needs("Add the phone that should get each new lead.", { tool: "canvas", label: "Add a phone" });
  await writeSetting(ctx.funnelId, "alertPhone", phone);
  if (!messagingLive()) {
    return waiting(
      "Armed. Texts start once StorageAds registers your texting number; until then each new lead comes to you by email.",
    );
  }
  return done(`Every form gets a text within a minute, and ${phone} gets the lead to call.`);
};

const follow: Exec = async (ctx, node) => {
  const count = param(node, "steps") === "5" ? "5" : "3";
  const trigger = followUpTrigger(ctx.funnelId);
  const offerNode = ctx.graph.nodes.find((n) => n.type === "offer");
  const offerName = offerNode ? ctx.results[offerNode.id]?.ref?.offerName : undefined;
  const steps = followUpSteps(count).map((s) => ({
    ...s,
    body: s.body.replace("{offer_line}", offerName ? `${offerName} is running now.` : "").replace(/ +\n/g, "\n"),
  }));
  const data = {
    name: `${ctx.funnelName} · follow-up`,
    steps: steps as unknown as Prisma.InputJsonValue,
    status: "active",
  };
  const existing = await db.nurture_sequences.findFirst({
    where: { facility_id: ctx.facility.id, trigger_type: trigger },
    select: { id: true },
  });
  const seq = existing
    ? await db.nurture_sequences.update({ where: { id: existing.id }, data })
    : await db.nurture_sequences.create({ data: { ...data, facility_id: ctx.facility.id, trigger_type: trigger } });
  const days = followUpDays(count);
  const lead = `New leads get ${count} follow-ups over ${days} days, and they stop when someone reserves.`;
  return done(messagingLive() ? lead : `${lead} Emails go out now; texts start once your texting number is registered.`, {
    ref: { sequenceId: seq.id },
  });
};

const missed: Exec = async (ctx) => {
  const number = await db.call_tracking_numbers
    .findFirst({ where: { facility_id: ctx.facility.id, status: "active" }, select: { phone_number: true } })
    .catch(() => null);
  if (!number) return waiting("Needs a call-tracking number. StorageAds sets these up for you.");
  return messagingLive()
    ? done(`Missed calls to ${number.phone_number} get a text back within seconds.`)
    : waiting("Armed. Texts start once StorageAds registers your texting number.");
};

/* ── Reach: the channels ───────────────────────────────────────────────── */

function partialResult(platform: string, e: PartialPublish, prior: NodeResult | undefined): NodeResult {
  const ref = { ...(prior?.ref ?? {}), ...e.created };
  if (e.unknown) {
    return result("unknown", `${platform} stopped answering part-way. Look in ${platform === "Meta" ? "Ads Manager" : "Google Ads"} before trying again.`, {
      ref,
      error: e.message,
    });
  }
  return result("failed", `${platform} said: ${e.message}`, { ref, error: e.message });
}

const meta: Exec = async (ctx, node, prior) => {
  const conn = await connection(ctx.facility.id, "meta");
  if (!conn) return needs("Connect Meta to make this ad. It's made paused; nothing spends until you switch it on.", CONNECT_ADS);
  if (!ctx.facility.address) return needs("Add the facility's street address so the ad runs near it.", ADDRESS);
  const ad = upstreamAd(ctx, node);
  if (!ad) return skipped("Waits on the ad above it.");
  const target = downstreamPage(ctx, node);
  if (!target) return skipped("Waits on the page it sends people to.");

  const variation = await db.ad_variations.findUnique({ where: { id: ad.variationId } });
  if (!variation) return skipped("Waits on the ad above it.");
  const budget = Number(param(node, "budget")) || 10;
  const miles = radiusMiles(ctx, node);
  const log = await db.publish_log.create({
    data: {
      facility_id: ctx.facility.id,
      variation_id: variation.id,
      connection_id: conn.id,
      platform: "meta",
      status: "pending",
      request_payload: { funnelId: ctx.funnelId, nodeId: node.id, budget, miles },
    },
  });
  try {
    const out = await publishToMeta(
      { ...variation, content_json: variation.content_json as Record<string, unknown> },
      conn,
      {
        dailyBudget: budget,
        radius: { miles, address: ctx.facility.address },
        landingUrl: trackingUrl(target.url, "meta", ctx.funnelId, node.id),
        name: `${ctx.facility.name} · ${ctx.funnelName}`,
        resume: prior?.ref,
      },
    );
    await db.publish_log.update({
      where: { id: log.id },
      data: {
        status: "published",
        external_id: out.externalId,
        external_url: out.externalUrl,
        response_payload: out.response as Prisma.InputJsonValue,
      },
    });
    await db.ad_variations.update({ where: { id: variation.id }, data: { status: "published" } });
    const ids = platformIds(out.response);
    return result("paused", `Made in Ads Manager, paused at $${budget}/day within ${miles} miles. Nothing spends until you switch it on.`, {
      ref: { ...ids, logId: log.id },
      href: out.externalUrl ?? undefined,
      hrefLabel: "Open Ads Manager",
      external: true,
    });
  } catch (e) {
    const failed = e instanceof PartialPublish ? partialResult("Meta", e, prior) : result("failed", "Meta couldn't be reached.", { error: String(e) });
    await db.publish_log.update({
      where: { id: log.id },
      data: { status: failed.state === "unknown" ? "unknown" : "failed", error_message: failed.error ?? failed.line },
    });
    return failed;
  }
};

const google: Exec = async (ctx, node, prior) => {
  const conn = await connection(ctx.facility.id, "google_ads");
  if (!conn) return needs("Connect Google Ads to make this ad. It's made paused; nothing spends until you switch it on.", CONNECT_ADS);
  if (!ctx.facility.address) return needs("Add the facility's street address so the ad runs near it.", ADDRESS);
  const target = downstreamPage(ctx, node);
  if (!target) return skipped("Waits on the page it sends people to.");

  // A search ad is its own copy — headlines, descriptions, keywords — written for Google.
  let rsa = await existingVariation(ctx.facility.id, prior?.ref?.rsaVariationId);
  if (!rsa) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return result("failed", "Writing isn't available right now.", { error: "ANTHROPIC_API_KEY not set" });
    const built = await buildFacilityContext(ctx.facility.id);
    if (!built) return result("failed", "The facility couldn't be read.", { error: "facility not found" });
    const parsed = (await generateGoogleRSA(built.context, null, apiKey, ctx.facility.id)) as { adGroup?: Record<string, unknown> };
    if (!parsed.adGroup) return result("failed", "The search ad came back empty. Try again.", { error: "no adGroup" });
    const briefId = await getOrCreateBrief(ctx.facility.id, built.facility, built.context, ["google_search"]);
    rsa = await db.ad_variations.create({
      data: {
        facility_id: ctx.facility.id,
        brief_id: briefId,
        platform: "google_search",
        format: "text",
        angle: "rsa",
        content_json: parsed.adGroup as Prisma.InputJsonValue,
        status: "approved",
        version: await getNextVersion(ctx.facility.id),
        funnel_id: ctx.funnelId,
      },
      select: { id: true, content_json: true },
    });
  }
  const rsaRef = { ...(prior?.ref ?? {}), rsaVariationId: rsa.id };

  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return waiting("The search ad is written. Making it in Google Ads switches on once StorageAds' Google access is approved.", {
      ref: rsaRef,
    });
  }

  const budget = Number(param(node, "budget")) || 10;
  const miles = radiusMiles(ctx, node);
  const log = await db.publish_log.create({
    data: {
      facility_id: ctx.facility.id,
      variation_id: rsa.id,
      connection_id: conn.id,
      platform: "google_ads",
      status: "pending",
      request_payload: { funnelId: ctx.funnelId, nodeId: node.id, budget, miles },
    },
  });
  try {
    const out = await publishToGoogle(
      {
        id: rsa.id,
        facility_id: ctx.facility.id,
        platform: "google_search",
        angle: "rsa",
        content_json: rsa.content_json as Record<string, unknown>,
        status: "approved",
      },
      conn,
      {
        dailyBudget: budget,
        radius: { miles, address: ctx.facility.address },
        landingUrl: trackingUrl(target.url, "google", ctx.funnelId, node.id),
        name: `${ctx.facility.name} · ${ctx.funnelName}`,
        resume: prior?.ref,
      },
    );
    await db.publish_log.update({
      where: { id: log.id },
      data: {
        status: "published",
        external_id: out.externalId,
        external_url: out.externalUrl,
        response_payload: out.response as Prisma.InputJsonValue,
      },
    });
    const ids = platformIds(out.response);
    return result("paused", `Made in Google Ads, paused at $${budget}/day within ${miles} miles. Nothing spends until you switch it on.`, {
      ref: { ...rsaRef, ...ids, logId: log.id },
      href: out.externalUrl ?? undefined,
      hrefLabel: "Open Google Ads",
      external: true,
    });
  } catch (e) {
    const failed =
      e instanceof PartialPublish
        ? { ...partialResult("Google", e, { ...(prior ?? result("running", "")), ref: rsaRef }) }
        : result("failed", "Google Ads couldn't be reached.", { error: String(e), ref: rsaRef });
    await db.publish_log.update({
      where: { id: log.id },
      data: { status: failed.state === "unknown" ? "unknown" : "failed", error_message: failed.error ?? failed.line },
    });
    return failed;
  }
};

const gbp: Exec = async (ctx, node, prior) => {
  const conn = await db.gbp_connections.findFirst({
    where: { facility_id: ctx.facility.id, status: "connected" },
    select: { id: true },
  });
  if (!conn) return needs("Connect your Google Business Profile to post this.", { tool: "gbp", label: "Connect Google" });
  const target = downstreamPage(ctx, node);
  if (!target) return skipped("Waits on the page it links to.");
  if (prior?.ref?.postId) {
    const kept = await db.gbp_posts.findFirst({ where: { id: prior.ref.postId }, select: { id: true } });
    if (kept) return done("Posts to your Google profile, linking to the page.", { ref: prior.ref });
  }

  // Message-matched to the campaign's ad when it has one.
  const adNode = ctx.graph.nodes.find((n) => (n.type === "write" || n.type === "proven") && ctx.results[n.id]?.ref?.variationId);
  const ad = adNode ? await existingVariation(ctx.facility.id, ctx.results[adNode.id].ref!.variationId) : null;
  const c = (ad?.content_json ?? {}) as Record<string, unknown>;
  const headline = typeof c.headline === "string" ? c.headline : `${ctx.facility.name}: storage near you`;
  const text = typeof c.primaryText === "string" ? c.primaryText : "Reserve online in minutes.";
  const post = await db.gbp_posts.create({
    data: {
      facility_id: ctx.facility.id,
      gbp_connection_id: conn.id,
      post_type: "update",
      title: headline.slice(0, 58),
      body: `${headline}\n\n${text}`.slice(0, 1500),
      cta_type: "LEARN_MORE",
      cta_url: trackingUrl(target.url, "gbp", ctx.funnelId, node.id),
      status: "scheduled",
      scheduled_at: new Date(),
      ai_generated: true,
    },
  });
  return done("Posts to your Google profile within the hour, linking to the page.", { ref: { postId: post.id } });
};

/* ── Prove ─────────────────────────────────────────────────────────────── */

const movein: Exec = async (_ctx, node) =>
  done(
    `Counts a lead as moved in when they match a new tenant in your ${param(node, "match") === "api" ? "PMS import" : "rent-roll upload"}.`,
  );

const capi: Exec = async (ctx) => {
  const [m, g] = await Promise.all([connection(ctx.facility.id, "meta"), connection(ctx.facility.id, "google_ads")]);
  const to = [
    m && typeof m.metadata?.pixelId === "string" && m.metadata.pixelId ? "Meta" : null,
    g && typeof g.metadata?.moveInConversionActionId === "string" && g.metadata.moveInConversionActionId ? "Google" : null,
  ].filter(Boolean);
  if (!to.length) {
    return needs("Add your Meta pixel or Google move-in conversion so move-ins go back to the platforms.", {
      tool: "ad-publisher",
      label: "Add it in Publish Ads",
    });
  }
  return done(`Each move-in goes back to ${to.join(" and ")}, so they look for renters, not form fills.`);
};

const review: Exec = async () => done("Asks each new tenant for a Google review a week after they move in.");

const report: Exec = async () => done("This campaign is judged on cost per move-in, by channel and by move-in date.");

export const EXECUTORS: Record<NodeType, Exec> = {
  units,
  offer,
  waitlist,
  audience,
  proven,
  write,
  meta,
  google,
  gbp,
  page,
  reserve,
  textback,
  follow,
  tour,
  missed,
  movein,
  capi,
  review,
  report,
};
