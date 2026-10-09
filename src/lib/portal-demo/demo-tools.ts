import { demoRows, DEMO_FACILITY_ID } from "./demo-rows";
import { demoPublishAnswer } from "./demo-publish";
import { demoLedgerAnswer } from "./demo-ledger";
import { blocksToSections, publicView, sectionsToBlocks, snapshotOf } from "@/lib/page-blocks";
import { sampleFallDraft } from "@/lib/page-blocks/sample";

/**
 * The facility tools in the sample portal: Landing Pages, Tracking Links,
 * Google Business and Lead Follow-Up answer from the same invented rows the
 * ontology is built from, with the same ids, so a tool opened from an object
 * finds that object. What the operator makes (a link, a post, a reply, an
 * enrollment, a published page) is kept in this tab only and shows in the
 * tool at once; nothing reaches the server, as the sample banner says.
 */

type Answer = { status: number; body: unknown };
const ok = (body: unknown, status = 200): Answer => ({ status, body });

const DAY = 86_400_000;
const STORE = "sa-demo-tools";

interface Made {
  links: Record<string, unknown>[];
  posts: Record<string, unknown>[];
  enrollments: Record<string, unknown>[];
  pages: Record<string, Record<string, unknown>>;
  replies: Record<string, string>;
  drafts: Record<string, string>;
  sequences: Record<string, unknown>[];
  /** Setup in the sample: the steps saved, and whether it was finished. */
  onboarding: { steps: Record<string, { completed: boolean; data: Record<string, unknown> }>; completedAt: string | null } | null;
  /** The month's goal, once set in the sample's setup or settings. */
  goal: number | null;
  /** Ads written in the sample, and changes to its ads (status, copy). */
  creatives: Record<string, unknown>[];
  creativeEdits: Record<string, Record<string, unknown>>;
}

function blank(): Made {
  return { links: [], posts: [], enrollments: [], pages: {}, replies: {}, drafts: {}, sequences: [], onboarding: null, goal: null, creatives: [], creativeEdits: {} };
}

function read(): Made {
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? { ...blank(), ...(JSON.parse(raw) as Partial<Made>) } : blank();
  } catch {
    return blank();
  }
}

function write(made: Made) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(made));
  } catch {
    /* storage blocked: the answer still returns, it just won't persist */
  }
}

/** Forget what the sample's tools made (leaving the sample). */
export function clearDemoTools() {
  try {
    sessionStorage.removeItem(STORE);
    sessionStorage.removeItem("sa-demo-publish");
    sessionStorage.removeItem("sa-demo-ledger");
  } catch {
    /* nothing stored */
  }
}

function body(raw?: string): Record<string, unknown> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ─── landing pages ─── */

function liveUnits(now: Date) {
  return demoRows(now).units.map((u) => ({
    key: u.unitType,
    name: u.unitType,
    size: u.sizeLabel ?? u.unitType,
    rate: u.webRate,
    vacant: Math.max(0, u.total - u.occupied),
    total: u.total,
    features: u.features,
    climate: /climate/i.test(u.unitType),
  }));
}

function pageSections(p: { id: string; slug: string; title: string }, now: Date) {
  if (p.slug === "maple-fall-move") {
    return blocksToSections(sampleFallDraft().blocks).map((s, i) => ({ id: `${p.id}-${i}`, ...s }));
  }
  const units = demoRows(now).units.filter((u) => u.total - u.occupied > 0).slice(0, 4);
  return [
    { id: `${p.id}-hero`, section_type: "hero", sort_order: 0, config: { headline: p.title, subheadline: "Drive-up and climate units on Maple Street.", facilityName: "Maple Street Storage", backgroundImage: "" } },
    {
      id: `${p.id}-units`,
      section_type: "unit_types",
      sort_order: 1,
      config: { headline: "Available units", live: true, sizeKeys: units.map((u) => u.unitType) },
    },
    { id: `${p.id}-ask`, section_type: "ask", sort_order: 2, config: { headline: "Leave your number. We’ll get back to you." } },
    { id: `${p.id}-loc`, section_type: "location_map", sort_order: 3, config: { headline: "Find the facility", address: "Maple Street, Springfield", hours: "Office open 7 days. Gate 6am to 10pm.", phone: "" } },
  ];
}

function pageRecords(now: Date, made: Made) {
  const rows = demoRows(now);
  const base = rows.pages.map((p) => {
    const sections = pageSections(p, now);
    const published = p.status === "published";
    const snapshot = published
      ? snapshotOf({
          title: p.slug === "maple-fall-move" ? sampleFallDraft().title : p.title,
          metaTitle: p.title,
          metaDescription: `${p.title}. Sample page for Maple Street Storage.`,
          storedgeWidgetUrl: null,
          editor: "blocks",
          blocks: sectionsToBlocks(sections),
        })
      : null;
    return {
      id: p.id,
      facility_id: DEMO_FACILITY_ID,
      funnel_id: p.funnelId,
      slug: p.slug,
      title: p.slug === "maple-fall-move" ? sampleFallDraft().title : p.title,
      status: p.status,
      variation_ids: p.variationIds,
      meta_title: p.title,
      meta_description: `${p.title}. Sample page for Maple Street Storage.`,
      theme: { editor: "blocks" },
      storedge_widget_url: null as string | null,
      version: 0,
      created_at: p.createdAt,
      updated_at: p.publishedAt ?? p.createdAt,
      published_at: p.publishedAt ?? undefined,
      published_snapshot: snapshot,
      sections,
    };
  });
  const madePages = Object.values(made.pages).filter((p) => !base.some((b) => b.id === p.id));
  return [...madePages, ...base].map((p) => ({ ...p, ...(made.pages[String(p.id)] ?? {}) }));
}

function landingPages(url: URL, method: string, raw: string | undefined, now: Date): Answer {
  const made = read();
  const id = url.searchParams.get("id");
  if (method === "GET") {
    const pages = pageRecords(now, made);
    const slug = url.searchParams.get("slug");
    if (slug) {
      const page = pages.find((p) => p.slug === slug);
      if (!page) return { status: 404, body: { error: "Page not found" } };
      const view = publicView({
        status: String(page.status ?? "draft"),
        title: String(page.title ?? ""),
        metaTitle: typeof page.meta_title === "string" ? page.meta_title : null,
        metaDescription: typeof page.meta_description === "string" ? page.meta_description : null,
        storedgeWidgetUrl: typeof page.storedge_widget_url === "string" ? page.storedge_widget_url : null,
        themeEditor: "blocks",
        sections: Array.isArray(page.sections) ? page.sections : [],
        snapshot: page.published_snapshot,
      });
      if (!view) return { status: 404, body: { error: "Page not found" } };
      return ok({
        page: {
          ...page,
          title: view.title,
          meta_title: view.metaTitle,
          meta_description: view.metaDescription,
          storedge_widget_url: view.storedgeWidgetUrl,
          theme: { editor: "blocks" },
          sections: view.sections.map((s, i) => ({ id: `live-${i}`, ...s })),
          liveUnits: liveUnits(now),
        },
      });
    }
    if (id) {
      const page = pages.find((p) => p.id === id);
      return page ? ok({ page: { ...page, liveUnits: liveUnits(now) } }) : { status: 404, body: { error: "Page not found" } };
    }
    return ok({ pages });
  }
  if (method === "PATCH" && id) {
    const patch = body(raw);
    const at = new Date().toISOString();
    made.pages[id] = {
      ...(made.pages[id] ?? {}),
      ...patch,
      id,
      updated_at: at,
      ...(patch.status === "published" ? { published_at: at } : {}),
    };
    write(made);
    return ok({ page: pageRecords(now, made).find((p) => p.id === id) });
  }
  if (method === "POST") {
    const input = body(raw);
    const pageId = newId("demo-page");
    const title = typeof input.title === "string" && input.title ? input.title : "New page";
    const slug = typeof input.slug === "string" && input.slug ? input.slug : `maple-${pageId.slice(-5)}`;
    const at = new Date().toISOString();
    made.pages[pageId] = {
      id: pageId,
      facility_id: DEMO_FACILITY_ID,
      funnel_id: typeof input.funnelId === "string" ? input.funnelId : null,
      slug,
      title,
      status: "draft",
      theme: input.theme ?? { editor: "blocks" },
      storedge_widget_url: typeof input.storedgeWidgetUrl === "string" ? input.storedgeWidgetUrl : null,
      sections: input.sections ?? [],
      created_at: at,
      updated_at: at,
    };
    write(made);
    return ok({ page: made.pages[pageId] }, 201);
  }
  if (method === "DELETE") return ok({ ok: true });
  return { status: 405, body: { error: "Not in the sample portal." } };
}

function generatePage(raw: string | undefined, now: Date): Answer {
  const input = body(raw);
  const made = read();
  const rows = demoRows(now);
  const ad = rows.ads.find((a) => a.id === input.adVariationId);
  const pageId = newId("demo-page");
  const at = new Date().toISOString();
  const title = ad ? ad.headline : "Storage on Maple Street";
  const slug = `maple-${(ad?.headline ?? "storage").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28)}`;
  made.pages[pageId] = {
    id: pageId,
    facility_id: DEMO_FACILITY_ID,
    slug,
    title,
    status: "draft",
    variation_ids: ad ? [ad.id] : [],
    meta_title: title,
    meta_description: `${title}. Reserve online at Maple Street Storage.`,
    created_at: at,
    updated_at: at,
    sections: [
      { id: `${pageId}-hero`, section_type: "hero", sort_order: 0, config: { headline: title, subheadline: ad?.text ?? "Drive-up and climate units. Reserve online in two minutes.", ctaText: "Reserve now", ctaUrl: "#cta", badgeText: "", style: "light" } },
    ],
  };
  write(made);
  return ok({ page: made.pages[pageId] }, 201);
}

/* ─── tracking links ─── */

function links(url: URL, method: string, raw: string | undefined, now: Date): Answer {
  const made = read();
  const rows = demoRows(now);
  const pages = rows.pages;
  if (method === "GET") {
    const base = rows.links.map((l) => {
      const page = pages.find((p) => p.id === l.landingPageId);
      return {
        id: l.id,
        short_code: l.shortCode,
        label: l.label,
        landing_page_id: l.landingPageId ?? undefined,
        landing_page_slug: page?.slug,
        landing_page_title: page?.title,
        utm_source: l.utmSource,
        utm_medium: l.utmMedium,
        utm_campaign: l.utmCampaign ?? undefined,
        click_count: l.clickCount,
        last_clicked_at: l.lastClickedAt ?? undefined,
        created_at: l.createdAt,
      };
    });
    return ok({ links: [...made.links, ...base] });
  }
  if (method === "POST") {
    const input = body(raw);
    const page = pages.find((p) => p.id === input.landingPageId);
    const link = {
      id: newId("demo-link"),
      short_code: `MAPLE${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
      label: String(input.label ?? "New link"),
      landing_page_id: page?.id,
      landing_page_slug: page?.slug,
      landing_page_title: page?.title,
      utm_source: String(input.utmSource ?? ""),
      utm_medium: String(input.utmMedium ?? ""),
      utm_campaign: input.utmCampaign ? String(input.utmCampaign) : undefined,
      utm_content: input.utmContent ? String(input.utmContent) : undefined,
      utm_term: input.utmTerm ? String(input.utmTerm) : undefined,
      click_count: 0,
      created_at: new Date().toISOString(),
    };
    made.links.unshift(link);
    write(made);
    return ok({ link }, 201);
  }
  if (method === "DELETE") return ok({ ok: true });
  return { status: 405, body: { error: "Not in the sample portal." } };
}

/* ─── google business ─── */

const REPLY_DRAFTS: Record<number, (name: string) => string> = {
  1: (n) => `${n}, thank you for telling us. This isn't the visit we want anyone to have. Please call the office and ask for the manager so we can put it right.`,
  2: (n) => `${n}, thank you for telling us. A gate code that fails with no one answering isn't good enough. Please call the office so we can sort out your code and make sure it doesn't happen again.`,
  3: (n) => `Thanks for the honest review, ${n}. We'd like to hear what would have made it a five. The office is open seven days.`,
  4: (n) => `Thank you, ${n}. Glad the unit is working for you, and we've passed your note to the team.`,
  5: (n) => `Thank you, ${n}! We're glad Maple Street made the move easier. See you at the gate.`,
};

function gbpPosts(url: URL, method: string, raw: string | undefined, now: Date): Answer {
  const made = read();
  if (method === "GET") {
    const base = demoRows(now)
      .posts.filter((p) => p.channel === "google")
      .map((p) => ({
        id: p.id,
        facility_id: DEMO_FACILITY_ID,
        post_type: p.offerCode ? "offer" : "update",
        title: p.title,
        body: p.body,
        cta_type: "LEARN_MORE",
        cta_url: null,
        image_url: null,
        offer_code: p.offerCode,
        status: p.status,
        scheduled_at: p.scheduledAt,
        published_at: p.publishedAt,
        ai_generated: false,
        error_message: null,
        created_at: p.createdAt,
      }));
    return ok({ posts: [...made.posts, ...base] });
  }
  if (method === "POST" && url.searchParams.get("action") === "generate-content") {
    const input = body(raw);
    const context = String(input.promptContext ?? "").trim();
    const offer = input.postType === "offer";
    return ok({
      generated: {
        title: offer ? context.split(/[.:]/)[0]?.slice(0, 58) || "This month at Maple Street" : "This week at Maple Street",
        body: context
          ? `${context.replace(/\.$/, "")}. Reserve online in two minutes at Maple Street Storage, open seven days.`
          : "Drive-up and climate units on Maple Street. Reserve online in two minutes; the gate opens at 6am, seven days a week.",
      },
    });
  }
  if (method === "POST") {
    const input = body(raw);
    const at = new Date().toISOString();
    const post = {
      id: newId("demo-post"),
      facility_id: DEMO_FACILITY_ID,
      post_type: String(input.postType ?? "update"),
      title: (input.title as string | null) ?? null,
      body: String(input.body ?? ""),
      cta_type: (input.ctaType as string | null) ?? null,
      cta_url: (input.ctaUrl as string | null) ?? null,
      image_url: null,
      offer_code: (input.offerCode as string | null) ?? null,
      status: input.publish ? "published" : "draft",
      scheduled_at: (input.scheduledAt as string | null) ?? null,
      published_at: input.publish ? at : null,
      ai_generated: false,
      error_message: null,
      created_at: at,
    };
    made.posts.unshift(post);
    write(made);
    return ok({ post }, 201);
  }
  if (method === "DELETE") return ok({ ok: true });
  return { status: 405, body: { error: "Not in the sample portal." } };
}

function gbpReviews(url: URL, method: string, raw: string | undefined, now: Date): Answer {
  const made = read();
  const rows = demoRows(now).reviews;
  if (method === "GET") {
    const reviews = rows.map((r) => {
      const reply = made.replies[r.id];
      const draft = made.drafts[r.id];
      const answered = r.hasResponse || !!reply;
      return {
        id: r.id,
        rating: r.rating,
        author_name: r.author,
        review_text: r.text,
        review_time: r.reviewTime,
        response_status: answered ? "published" : draft ? "ai_drafted" : "pending",
        response_text: reply ?? (r.hasResponse ? "Thank you for the review!" : null),
        ai_draft: draft ?? null,
      };
    });
    const responded = reviews.filter((r) => r.response_status === "published").length;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
    const avg = reviews.reduce((n, r) => n + r.rating, 0) / Math.max(1, reviews.length);
    return ok({
      reviews,
      stats: {
        total: reviews.length,
        avg_rating: Math.round(avg * 10) / 10,
        responded,
        response_rate: Math.round((responded / Math.max(1, reviews.length)) * 100),
        distribution,
      },
    });
  }
  const action = url.searchParams.get("action");
  const input = body(raw);
  const review = rows.find((r) => r.id === input.reviewId);
  if (method === "POST" && action === "generate-response") {
    if (!review) return { status: 404, body: { error: "Review not found" } };
    const first = review.author?.split(" ")[0] || "there";
    const draft = (REPLY_DRAFTS[review.rating] ?? REPLY_DRAFTS[5])(first);
    made.drafts[review.id] = draft;
    write(made);
    return ok({ aiDraft: draft });
  }
  if (method === "POST" && action === "approve-response") {
    if (!review) return { status: 404, body: { error: "Review not found" } };
    made.replies[review.id] = String(input.responseText ?? "");
    write(made);
    return ok({ ok: true });
  }
  if (method === "POST") return ok({ ok: true });
  return { status: 405, body: { error: "Not in the sample portal." } };
}

function gbpSync(now: Date): Answer {
  return ok({
    connection: {
      id: "demo-gbp",
      facility_id: DEMO_FACILITY_ID,
      status: "connected",
      location_name: "Maple Street Storage",
      google_account_id: "sample",
      last_sync_at: new Date(now.getTime() - 2 * 3_600_000).toISOString(),
      created_at: new Date(now.getTime() - 200 * DAY).toISOString(),
      sync_config: { reviews: true, posts: true, questions: true, insights: true },
    },
    syncLog: [{ id: "demo-sync-1", sync_type: "reviews", status: "success", error_message: null, created_at: new Date(now.getTime() - 2 * 3_600_000).toISOString() }],
  });
}

/* ─── lead follow-up ─── */

const SEQUENCE_STEPS = [
  { step_number: 1, delay_minutes: 1, channel: "sms", subject: null, body: "Hi {first_name}, it's Maple Street Storage. Still looking for a {unit_size}? Reply here or reserve online.", send_window: null },
  { step_number: 2, delay_minutes: 1440, channel: "email", subject: "Your {unit_size} at Maple Street", body: "Here's the unit you asked about, the price, and a link to reserve in two minutes.", send_window: { start: "09:00", end: "19:00" } },
  { step_number: 3, delay_minutes: 4320, channel: "sms", subject: null, body: "Last check-in from Maple Street: your {unit_size} is still open. Want us to hold it?", send_window: { start: "09:00", end: "19:00" } },
];

function nurture(url: URL, method: string, raw: string | undefined, now: Date): Answer {
  const made = read();
  const rows = demoRows(now);
  const at = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  const sequences = [
    {
      id: "demo-seq-1",
      facility_id: DEMO_FACILITY_ID,
      name: "New lead: 3 touches over 3 days",
      trigger_type: "new_lead",
      status: "active",
      steps: SEQUENCE_STEPS,
      exit_conditions: ["reserved", "moved_in", "unsubscribed"],
      created_at: at(60),
      updated_at: at(60),
    },
    ...made.sequences,
  ];
  if (method === "GET") {
    const contacted = rows.leads.filter((l) => l.firstResponseAt && l.status !== "moved_in" && l.status !== "lost");
    const base = contacted.map((l, i) => ({
      id: `demo-enr-${i + 1}`,
      sequence_id: "demo-seq-1",
      facility_id: DEMO_FACILITY_ID,
      lead_id: l.id,
      tenant_id: null,
      contact_name: l.name,
      contact_email: null,
      contact_phone: null,
      current_step: 2,
      status: "active",
      enrolled_at: l.firstResponseAt,
      next_send_at: new Date(now.getTime() + (i + 1) * 3_600_000).toISOString(),
      completed_at: null,
      exit_reason: null,
      metadata: {},
    }));
    const enrollments = [...made.enrollments, ...base];
    return ok({
      templates: [
        { key: "new_lead", name: "New lead: 3 touches over 3 days", trigger_type: "new_lead", stepCount: 3 },
        { key: "abandoned", name: "Started a reservation and stopped", trigger_type: "abandoned", stepCount: 2 },
      ],
      sequences,
      enrollments,
      recentMessages: [],
      stats: {
        totalSequences: sequences.length,
        activeEnrollments: enrollments.filter((e) => e.status === "active").length,
        converted: 2,
        totalMessages: 41,
        smsSent: 27,
        emailSent: 14,
        deliveryRate: 97,
      },
    });
  }
  if (method === "POST") {
    const input = body(raw);
    if (input.action === "enroll") {
      const lead = rows.leads.find((l) => l.id === input.leadId);
      if (input.leadId && !lead) return { status: 404, body: { error: "Lead not found" } };
      const name = (input.contactName as string) || lead?.name || null;
      const enrollment = {
        id: newId("demo-enr"),
        sequence_id: String(input.sequenceId ?? "demo-seq-1"),
        facility_id: DEMO_FACILITY_ID,
        lead_id: lead?.id ?? null,
        tenant_id: null,
        contact_name: name,
        contact_email: (input.contactEmail as string) || null,
        contact_phone: (input.contactPhone as string) || null,
        current_step: 0,
        status: "active",
        enrolled_at: new Date().toISOString(),
        next_send_at: new Date(Date.now() + 60_000).toISOString(),
        completed_at: null,
        exit_reason: null,
        metadata: {},
      };
      made.enrollments.unshift(enrollment);
      write(made);
      return ok({ enrollment }, 201);
    }
    if (input.action === "create_from_template") {
      const sequence = {
        id: newId("demo-seq"),
        facility_id: DEMO_FACILITY_ID,
        name: input.templateKey === "abandoned" ? "Started a reservation and stopped" : "New lead: 3 touches over 3 days",
        trigger_type: String(input.templateKey ?? "new_lead"),
        status: "active",
        steps: SEQUENCE_STEPS.slice(0, input.templateKey === "abandoned" ? 2 : 3),
        exit_conditions: ["reserved", "moved_in", "unsubscribed"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      made.sequences.push(sequence);
      write(made);
      return ok({ sequence }, 201);
    }
  }
  if (method === "PATCH" || method === "DELETE") return ok({ ok: true });
  return { status: 405, body: { error: "Not in the sample portal." } };
}

/* ─── creative studio ─── */

const ANGLE_LABELS: Record<string, string> = {
  convenience: "Easy Move",
  social_proof: "Trusted Choice",
  urgency: "Last Chance",
  lifestyle: "Fresh Start",
  proximity: "Close By",
  price: "Fair Price",
};

function creativeRow(ad: ReturnType<typeof demoRows>["ads"][number], edit: Record<string, unknown> | undefined) {
  const google = ad.platform === "google_search";
  const content = google
    ? {
        name: ad.headline,
        headlines: [{ text: ad.headline }, { text: "Storage on Maple Street" }, { text: "Reserve online today" }],
        descriptions: [{ text: ad.text }],
        finalUrl: "https://storageads.com/lp/maple-fall-move",
        sitelinks: [],
      }
    : {
        angle: ad.angle ?? "",
        angleLabel: (ad.angle && ANGLE_LABELS[ad.angle]) || ad.angle || "",
        primaryText: ad.text,
        headline: ad.headline,
        description: "Reserve online in two minutes.",
        cta: "LEARN_MORE",
        targetingNote: "Within 5 miles, people moving soon",
      };
  return {
    id: ad.id,
    facility_id: DEMO_FACILITY_ID,
    brief_id: null,
    created_at: ad.createdAt,
    platform: ad.platform,
    format: google ? "rsa" : "single_image",
    angle: ad.angle,
    content_json: content,
    asset_urls: null,
    status: ad.status,
    feedback: null,
    version: 1,
    compliance_status: "passed",
    compliance_flags: null,
    ...(edit ?? {}),
  };
}

/** A sample "generation": two Meta drafts written from the direction, without a model. */
function writtenFromDirection(direction: string, now: Date) {
  const rows = demoRows(now);
  const size = /(\d+\s*[x×]\s*\d+(?:\s*climate)?)/i.exec(direction)?.[1]?.replace(/\s*[x×]\s*/, "x") ?? "10x10";
  const unit = rows.units.find((u) => u.unitType.toLowerCase() === size.toLowerCase());
  const price = unit ? `$${unit.webRate} a month online` : "a fair price";
  const at = new Date().toISOString();
  // Climate units are inside the building: never "drive right up".
  const climate = /climate/i.test(size);
  const plain = size.replace(/\s*climate/i, "");
  return (
    climate
      ? [
          { angle: "convenience", headline: `A climate-controlled ${plain}, inside and dry`, text: `Climate-controlled ${plain} units on Maple Street, ${price}. Reserve online in two minutes.` },
          { angle: "urgency", headline: `Climate ${plain}s are going this month`, text: `Moving soon? There are still climate-controlled ${plain} units open on Maple Street at ${price}. Hold one online today.` },
        ]
      : [
          { angle: "convenience", headline: `A ${size} you can drive right up to`, text: `${size} units open on Maple Street, ${price}. Reserve online in two minutes; the gate opens at 6am.` },
          { angle: "urgency", headline: `${size}s are going this month`, text: `Moving soon? There are still ${size} units open on Maple Street at ${price}. Hold one online today.` },
        ]
  ).map((c, i) => ({
    id: newId(`demo-ad-${i}`),
    facility_id: DEMO_FACILITY_ID,
    brief_id: null,
    created_at: at,
    platform: "meta_feed",
    format: "single_image",
    angle: c.angle,
    content_json: {
      angle: c.angle,
      angleLabel: ANGLE_LABELS[c.angle],
      primaryText: c.text,
      headline: c.headline,
      description: "Reserve online in two minutes.",
      cta: "LEARN_MORE",
      targetingNote: "Within 5 miles, people moving soon",
    },
    asset_urls: null,
    status: "draft",
    feedback: null,
    version: 1,
    compliance_status: "passed",
    compliance_flags: null,
  }));
}

function creatives(url: URL, method: string, raw: string | undefined, now: Date): Answer {
  const made = read();
  const base = demoRows(now).ads.map((ad) => creativeRow(ad, made.creativeEdits[ad.id]));
  const all = [...made.creatives.map((c) => ({ ...c, ...(made.creativeEdits[String(c.id)] ?? {}) })), ...base];
  if (method === "GET") return ok({ variations: all });
  const input = body(raw);
  if (method === "POST") {
    const written = writtenFromDirection(String(input.feedback ?? ""), now);
    made.creatives = [...written, ...made.creatives];
    write(made);
    return ok({ variations: written }, 201);
  }
  if (method === "PATCH") {
    const id = String(input.variationId ?? "");
    const current = all.find((v) => v.id === id);
    if (!current) return { status: 404, body: { error: "Ad not found" } };
    const { variationId: _ignored, ...changes } = input;
    void _ignored;
    made.creativeEdits[id] = { ...(made.creativeEdits[id] ?? {}), ...changes };
    write(made);
    return ok({ variation: { ...current, ...made.creativeEdits[id] } });
  }
  if (method === "DELETE") return ok({ ok: true });
  return { status: 405, body: { error: "Not in the sample portal." } };
}

/* ─── setup and the goal ─── */

function onboarding(method: string, raw: string | undefined, now: Date): Answer {
  const made = read();
  const record = made.onboarding ?? { steps: {}, completedAt: new Date(now.getTime() - 100 * DAY).toISOString() };
  if (method === "GET") {
    return ok({ onboarding: { accessCode: "demo", updatedAt: now.toISOString(), ...record }, completionPct: 100 });
  }
  if (method === "PATCH") {
    const input = body(raw);
    const step = typeof input.step === "string" ? input.step : null;
    if (step && input.data && typeof input.data === "object") {
      record.steps = { ...record.steps, [step]: { completed: true, data: input.data as Record<string, unknown> } };
    }
    if (input.finish) {
      const goal = (record.steps.adPreferences?.data as Record<string, unknown> | undefined)?.primaryGoal;
      if (!goal) return { status: 400, body: { error: "Pick what you want StorageAds to get you first." } };
      record.completedAt = new Date().toISOString();
    }
    made.onboarding = record;
    write(made);
    return ok({ success: true, onboarding: { accessCode: "demo", updatedAt: new Date().toISOString(), ...record }, completionPct: 100 });
  }
  return { status: 405, body: { error: "Not in the sample portal." } };
}

/** The sample's goal for this month: the one set in its setup, else 12. */
export function demoGoalTarget(): number {
  return read().goal ?? 12;
}

/**
 * The sample's answer for a tool route, or null when the route is not one of
 * these tools (the caller then answers it, or says it is not in the sample).
 */
export function demoToolAnswer(url: URL, method: string, raw: string | undefined, now: Date): Answer | null {
  switch (url.pathname) {
    case "/api/landing-pages":
      return landingPages(url, method, raw, now);
    case "/api/landing-pages/publish": {
      if (method !== "POST") return { status: 405, body: { error: "Not in the sample portal." } };
      const input = body(raw);
      const id = typeof input.id === "string" ? input.id : "";
      const made = read();
      const page = pageRecords(now, made).find((p) => p.id === id);
      if (!page) return { status: 404, body: { error: "Page not found" } };
      const sections = Array.isArray(page.sections) ? page.sections : [];
      const snapshot = snapshotOf({
        title: String(page.title ?? "Page"),
        metaTitle: typeof page.meta_title === "string" ? page.meta_title : null,
        metaDescription: typeof page.meta_description === "string" ? page.meta_description : null,
        storedgeWidgetUrl: typeof page.storedge_widget_url === "string" ? page.storedge_widget_url : null,
        editor: "blocks",
        blocks: sectionsToBlocks(sections),
      });
      const prev = typeof page.version === "number" ? page.version : 0;
      const version = prev + 1;
      made.pages[id] = { ...page, status: "published", published_snapshot: snapshot, published_at: new Date().toISOString(), version, theme: { editor: "blocks" } };
      write(made);
      return ok({ ok: true, slug: page.slug, version, title: page.title, href: `/lp/${page.slug}` });
    }
    case "/api/landing-pages/generate":
      return method === "POST" ? generatePage(raw, now) : null;
    case "/api/utm-links":
      return links(url, method, raw, now);
    case "/api/gbp-posts":
      return gbpPosts(url, method, raw, now);
    case "/api/gbp-reviews":
      return gbpReviews(url, method, raw, now);
    case "/api/gbp-sync":
      return method === "GET" ? gbpSync(now) : ok({ ok: true });
    case "/api/gbp-questions":
      return method === "GET" ? ok({ questions: [], stats: { total: 0, answered: 0, unanswered: 0 } }) : ok({ ok: true });
    case "/api/gbp-insights":
      return method === "GET"
        ? ok({
            insights: [],
            summary: { period: "Last 30 days (sample)", search_views: 1840, maps_views: 2210, website_clicks: 241, direction_clicks: 96, phone_calls: 58, total_impressions: 4050, total_actions: 395 },
          })
        : ok({ ok: true });
    case "/api/gbp-review-settings":
      return method === "GET" ? ok({ settings: null }) : ok({ ok: true });
    case "/api/facility-assets":
      return method === "GET" ? ok({ assets: [] }) : null;
    case "/api/nurture-sequences":
      return nurture(url, method, raw, now);
    case "/api/facility-creatives":
      return creatives(url, method, raw, now);
    case "/api/funnels/publish":
      return demoPublishAnswer(url, method, raw, now);
    case "/api/attribution/ledger":
      return demoLedgerAnswer(url, method, raw, now);
    case "/api/funnels/flow": {
      if (method !== "GET") return null;
      // The sample's counts for one campaign, from the same rows: visits to its
      // pages (split by channel in fixed sample shares, since the sample rows
      // carry no channel per visit), then what happened to its leads.
      const rows = demoRows(now);
      const id = url.searchParams.get("id") ?? "";
      const pages = rows.pages.filter((p) => p.funnelId === id);
      const pageIds = new Set(pages.map((p) => p.id));
      const total = pages.reduce((n, p) => n + p.visits30, 0);
      const meta = Math.round(total * 0.6);
      const gbp = Math.round(total * 0.25);
      const google = Math.round(total * 0.1);
      const leads = rows.leads.filter((l) => l.funnelId === id || (l.landingPageId && pageIds.has(l.landingPageId)));
      const leadIds = new Set(leads.map((l) => l.id));
      return ok({
        counts: {
          days: 30,
          visits: { meta, google, gbp, tiktok: 0, other: Math.max(0, total - meta - gbp - google) },
          leads: leads.length,
          answered: leads.filter((l) => l.firstResponseAt).length,
          enrolled: leads.filter((l) => l.firstResponseAt && l.status !== "moved_in" && l.status !== "lost").length,
          toured: new Set(rows.tours.filter((t) => t.leadId && leadIds.has(t.leadId)).map((t) => t.leadId)).size,
          holds: leads.filter((l) => l.status === "reserved").length,
          moveIns: leads.filter((l) => l.status === "moved_in" || l.converted).length,
        },
      });
    }
    case "/api/market-intel": {
      if (method !== "GET") return ok({ ok: true });
      const rows = demoRows(now);
      return ok({
        intel: {
          id: "demo-intel",
          facility_id: DEMO_FACILITY_ID,
          last_scanned: new Date(now.getTime() - 6 * DAY).toISOString(),
          competitors: rows.competitors.map((c) => ({
            name: c.name,
            address: "Springfield, IL",
            rating: c.rating,
            reviewCount: c.reviewCount ?? 0,
            distance_miles: c.distanceMiles,
            mapsUrl: null,
            website: c.website,
            source: "sample",
            units: c.units,
            promotions: c.promotions.map((text) => ({ text })),
          })),
          demand_drivers: [],
          demographics: { zip: "62701", population: 31200, median_income: 61800, renter_pct: 41, source: "sample" },
          manual_notes: null,
          operator_overrides: {},
        },
      });
    }
    case "/api/client-onboarding":
      return onboarding(method, raw, now);
    case "/api/client-data": {
      if (method !== "PATCH") return null;
      const input = body(raw);
      if (typeof input.monthlyGoal === "number" && input.monthlyGoal >= 0) {
        const made = read();
        made.goal = Math.floor(input.monthlyGoal);
        write(made);
      }
      return ok({ success: true });
    }
    case "/api/portal-upload":
      return method === "POST"
        ? { status: 403, body: { error: "The sample portal doesn't import files. In your own portal a clean CSV imports in seconds." } }
        : null;
    default:
      return null;
  }
}
