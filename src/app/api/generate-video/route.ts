import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireManageOrAdmin,
  requireFacilityAccess,
  isAdminCredential,
} from "@/lib/api-helpers";
import { canGenerateVideo } from "@/lib/plan-limits";
import { getBrandContextForVideo } from "@/lib/brand-doctrine";
import { getStyleDirectives } from "@/lib/style-references";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";

export const maxDuration = 300;

const CORE_STYLE =
  "Deliberate, intentional composition — every element placed with purpose but not always symmetrical. Naturalistic color palette with visible film grain texture. Stop-motion-adjacent pacing — deliberate, slightly staccato movement with physical weight. Natural light appropriate to the scene (vary between daylight, overcast, window light, fluorescent, dusk). Transitions feel physical like pages turning or layers peeling away. A24 cinematography sensibility — candid, unhurried, textured. Vary the framing: wide shots, close-ups, off-center subjects, depth through layering. No digital dissolves or particle effects.";

const STYLE_PRESETS: Record<string, { name: string; suffix: string }> = {
  none: { name: "Default", suffix: "" },
  cinematic: { name: "Cinematic", suffix: "Anamorphic lens quality, shallow depth of field, 35mm film grain, rich shadow detail. Deliberate slow camera push. Intentional framing." },
  vintage: { name: "Vintage / Analog", suffix: "Analog color shift, soft halation around highlights, Super 8 texture, nostalgic and tactile. Newspaper-print tonal quality — bold blacks, crisp highlights. Physical, not filtered." },
  storybook: { name: "Storybook", suffix: "Meticulously composed framing, muted tones, flat perspective. Wes Anderson title sequence pacing — staccato, deliberate, physical transitions." },
  drone: { name: "Aerial / Drone", suffix: "Aerial overhead perspective, smooth sweeping movement, landscape scale, natural daylight from above. Film grain texture. Geometric patterns in facility layout." },
  minimal: { name: "Clean / Minimal", suffix: "Maximum negative space, earth tones, single subject focus, quiet and sparse. Architectural simplicity. Not sterile — textured and considered." },
  bold: { name: "Bold / Graphic", suffix: "High contrast newspaper-print quality. Bold warm accent colors against muted backgrounds. Porsche print ad confidence — alive and striking, not corporate." },
  moody: { name: "Moody / Atmospheric", suffix: "Deep shadows, muted tones, atmospheric haze, contemplative. Tension and stillness. Dramatic light shafts through windows. Film grain." },
  handheld: { name: "Handheld / Raw", suffix: "Slight handheld movement, natural available light, candid documentary feel. A24 sensibility — people caught in real moments, unhurried. Shallow depth of field on everyday objects." },
  timelapse: { name: "Timelapse", suffix: "Smooth accelerated motion, light shifting naturally through the day. Film grain throughout. Naturalistic palette. Steady, locked-off composition as time moves." },
  textile: { name: "Tactile / Textured", suffix: "Rich material textures, close-up surface detail — kraft paper, cardboard, wood grain. Rimowa aesthetic: beauty through use and wear. Shallow DOF, soft natural light." },
};

interface FacilityData {
  name: string;
  location: string;
  [key: string]: unknown;
}

const VIDEO_TEMPLATES: Record<
  string,
  {
    name: string;
    description: string;
    mode: string;
    skipCoreStyle?: boolean;
    model?: "wan" | "pixverse";
    promptTemplate: (f: FacilityData) => string;
  }
> = {
  facility_showcase: {
    name: "Facility Showcase",
    description: "Storage facility hallway — depth, repetition, hypnotic",
    mode: "image_to_video",
    promptTemplate: (f) =>
      `Camera glides slowly through ${f.name} storage facility hallway in ${f.location}. Rows of unit doors line both sides, fluorescent lights overhead cast rhythmic shadows on concrete floor. Visible film grain. The camera moves with deliberate weight, not fluid smoothness. The beauty of repetition in an industrial space. No people. Quiet.`,
  },
  hero_shot: {
    name: "Hero B-Roll",
    description: "Contemplative exterior — considered framing, analog grain",
    mode: "text_to_video",
    promptTemplate: (f) =>
      `Wide establishing shot of ${f.name} storage facility exterior in ${f.location}. Clear natural daylight across rows of unit doors. Crisp shadows on concrete. Film grain texture throughout. Camera holds steady, then pushes forward with deliberate weight — not a smooth glide. Newspaper-print contrast: bold shadows, bright highlights. No people.`,
  },
  seasonal_promo: {
    name: "Seasonal Promo",
    description: "Messy home with clutter — relatable and stressful",
    mode: "text_to_video",
    skipCoreStyle: true,
    promptTemplate: () =>
      `A residential living room that is overwhelmed with clutter. Carpet floor, window with curtains, a couch with laundry on it, cardboard boxes stacked on the floor, kids toys scattered, books piled on a coffee table. The camera slowly pans across the mess. It is clearly someone's home — not a warehouse or storage unit. Natural window light. Film grain. No people. The feeling of a space that needs relief.`,
  },
  quick_cta: {
    name: "Quick CTA",
    description: "5-second visual punch — door reveals bright clean interior",
    mode: "image_to_video",
    promptTemplate: (f) =>
      `A storage unit door at ${f.name} rolls up with physical weight — not smooth, slightly staccato, you feel the mechanism. It reveals a bright, clean interior. Camera holds. Film grain visible. The contrast between the closed door and the open, well-lit space inside is dramatic. No people.`,
  },
  packing_asmr: {
    name: "Packing ASMR",
    description: "Satisfying close-up of someone packing boxes for storage",
    mode: "text_to_video",
    skipCoreStyle: true,
    model: "pixverse",
    promptTemplate: () =>
      `Close-up overhead shot of someone packing a cardboard moving box. Hands placing folded clothes, books, and picture frames into the box. Crumpled packing paper tucked around items for protection. Then hands fold the box flaps closed and run packing tape across the top with a satisfying pull and tear. A black marker writes a label on the side of the box. Shallow depth of field. Natural indoor lighting. Film grain. Satisfying, methodical, real. The feeling of getting organized for a move into storage.`,
  },
  before_after: {
    name: "Before & After",
    description: "Cluttered home cuts to organized storage unit",
    mode: "text_to_video",
    skipCoreStyle: true,
    promptTemplate: () =>
      `First half of video: A normal residential living room with carpet and a window. A couch with laundry piled on one end. A few cardboard boxes on the floor. Kids toys scattered around. A guitar leaning against the wall. Books and shoes on the coffee table. Not a hoarder house — just a regular lived-in home running out of room. The camera slowly pans across the mess. Then hard cut to second half: A completely different location — a bright, clean commercial self-storage unit with bare metal walls, smooth concrete floor, and bright white fluorescent tube lights on the ceiling. A large metal roll-up garage door visible. Inside are only a few items placed with perfect precision — three boxes stacked neatly, one piece of furniture against the wall, a bicycle hanging from a hook. Mostly empty floor space. Spacious, orderly, calm. No people in either scene. Film grain.`,
  },
  custom: {
    name: "Custom Prompt",
    description: "Write your own prompt — full creative control over the generated video",
    mode: "text_to_video",
    promptTemplate: (f) =>
      `A beautifully composed scene at ${f.name} in ${f.location}. Naturalistic tones, visible film grain. Stop-motion-adjacent pacing — deliberate, weighted movement. Natural daylight. Every element in the frame placed with intention.`,
  },
};

async function buildFacilityVideoContext(facilityId: string): Promise<string> {
  const lines: string[] = [];
  try {
    const [pmsSnapshot, pmsSpecials, placesRows] = await Promise.all([
      db.facility_pms_snapshots.findFirst({
        where: { facility_id: facilityId },
        orderBy: { snapshot_date: "desc" },
        select: { occupancy_pct: true },
      }).catch(() => null),
      db.facility_pms_specials.findMany({
        where: { facility_id: facilityId, active: true },
        take: 3,
        select: { name: true },
      }).catch(() => []),
      db.$queryRaw<Array<Record<string, unknown>>>`
        SELECT rating, review_count FROM places_data
        WHERE facility_id = ${facilityId}::uuid
        ORDER BY fetched_at DESC LIMIT 1
      `.catch(() => []),
    ]);

    if (pmsSnapshot?.occupancy_pct) {
      const occ = parseFloat(String(pmsSnapshot.occupancy_pct));
      lines.push(`Occupancy: ${occ}%`);
      if (occ < 70) lines.push("Strategy: facility needs to fill units — video should feel welcoming and available");
      else if (occ > 90) lines.push("Strategy: nearly full — video should feel premium and exclusive");
    }
    if (pmsSpecials.length > 0) lines.push(`Active specials: ${pmsSpecials.map(s => s.name).join(", ")}`);
    const places = placesRows?.[0];
    if (places?.rating) lines.push(`Google rating: ${places.rating} stars (${places.review_count} reviews)`);
  } catch { /* non-fatal */ }
  return lines.join("\n");
}

async function generateVideoPrompt(
  template: (typeof VIDEO_TEMPLATES)[string],
  facility: FacilityData,
  facilityId: string,
  customNotes?: string,
  copyContext?: string,
): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return template.promptTemplate(facility);
  }

  const client = new Anthropic({ apiKey: anthropicKey });
  const basePrompt = template.promptTemplate(facility);
  const styleDirectives = await getStyleDirectives(facilityId);
  const facilityContext = await buildFacilityVideoContext(facilityId);
  const brandVideo = await getBrandContextForVideo();

  Sentry.addBreadcrumb({ category: "external_api", message: "Calling Anthropic API", level: "info" });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `You are enhancing a video generation prompt for a self-storage facility's advertising. Adapt the video to this facility's situation and any ad copy it accompanies.

FACILITY CONTEXT:
Facility: ${facility.name} in ${facility.location}
${facilityContext}
${customNotes ? `Admin notes: ${customNotes}` : ""}

${copyContext ? `AD COPY THIS VIDEO WILL ACCOMPANY — the video MUST visually reinforce this message:\n${copyContext}\n` : ""}
ADAPT THE VIDEO based on context:
- Low occupancy → welcoming, spacious, available feeling
- High occupancy → premium, exclusive, quality feeling
- Active specials → energetic, promotional feeling
- Security-focused copy → clean, bright, secure spaces
- Moving/lifestyle copy → relatable human moments
- Social proof copy → established, trustworthy feeling

${brandVideo.slice(0, 800)}

VISUAL RULES:
- Vary lighting naturally — not always golden hour
- Intentional composition, not always symmetrical
- Film grain texture. Naturalistic tones.
- No business names or text on screen
- No people talking. Hands-only if people needed.
- Under 120 words
${styleDirectives}

Template: ${template.name}
Base prompt: ${basePrompt}

Enhance into a visually specific prompt. Return ONLY the prompt, nothing else.`,
      },
    ],
  });

  return (
    (message.content[0] as { type: "text"; text: string }).text.trim() ||
    basePrompt
  );
}

/* ── FAL.ai PixVerse V6 (for close-up/human action shots) ── */

async function callPixVerse(prompt: string): Promise<{ videoUrl: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("NO_FAL_KEY");

  const res = await fetch("https://fal.run/fal-ai/pixverse/v6/text-to-video", {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: prompt.slice(0, 1000),
      aspect_ratio: "9:16",
      resolution: "540p",
      duration: 5,
      negative_prompt: "blurry, distorted, extra fingers, deformed hands, abstract, surreal, cartoon, anime",
    }),
  });

  const responseText = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`PixVerse returned non-JSON (${res.status}): ${responseText.slice(0, 200)}`);
  }

  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail
      : data.message || JSON.stringify(data);
    throw new Error(`PixVerse error (${res.status}): ${detail}`);
  }

  const videoUrl = (data.video as Record<string, string>)?.url;
  if (!videoUrl) throw new Error("PixVerse returned no video URL");

  return { videoUrl };
}

/* ── FAL.ai Two-Clip Merge (for before/after) ── */

async function generateBeforeAfter(): Promise<{ videoUrl: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("NO_FAL_KEY");

  const beforePrompt = `A normal residential living room with carpet and a window. A couch with laundry piled on one end. A few cardboard boxes on the floor. Kids toys scattered around. A guitar leaning against the wall. Books and shoes on the coffee table. Not a hoarder house — just a regular lived-in home running out of room. The camera slowly pans across the room. Film grain. No people.`;

  const afterPrompt = `The inside of a bright, clean commercial self-storage unit. Bare metal walls, smooth concrete floor, bright white fluorescent tube lights on the ceiling. A large metal roll-up garage door visible at the top. Only a few items placed with perfect precision — three boxes stacked neatly, one piece of furniture against the wall, a bicycle hanging from a hook. Mostly empty floor space visible. The camera slowly pans across the tidy, spacious unit. Film grain. No people.`;

  // Generate both clips in parallel
  const [beforeResult, afterResult] = await Promise.all([
    callFal(beforePrompt, null, "text_to_video"),
    callFal(afterPrompt, null, "text_to_video"),
  ]);

  // Merge with FAL FFmpeg
  const mergeRes = await fetch("https://fal.run/fal-ai/ffmpeg-api/merge-videos", {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      video_urls: [beforeResult.videoUrl, afterResult.videoUrl],
      target_fps: 16,
      resolution: { width: 720, height: 1280 },
    }),
  });

  const mergeText = await mergeRes.text();
  let mergeData: Record<string, unknown>;
  try {
    mergeData = JSON.parse(mergeText);
  } catch {
    throw new Error(`FFmpeg merge returned non-JSON (${mergeRes.status}): ${mergeText.slice(0, 200)}`);
  }

  if (!mergeRes.ok) {
    const detail = typeof mergeData.detail === "string" ? mergeData.detail
      : mergeData.message || JSON.stringify(mergeData);
    throw new Error(`FFmpeg merge error (${mergeRes.status}): ${detail}`);
  }

  const videoUrl = (mergeData.video as Record<string, string>)?.url;
  if (!videoUrl) throw new Error("FFmpeg merge returned no video URL");

  return { videoUrl };
}

/* ── FAL.ai Wan2.2 Video Generation ── */

/**
 * Synchronous FAL call — blocks until video is ready. Only used by the
 * composite `before_after` flow that needs two videos + a merge in a
 * single orchestration. Subject to Vercel's 300s cap; for the normal
 * path use submitFalJob + the /status polling endpoint instead.
 */
async function callFal(
  prompt: string,
  imageUrl: string | null,
  mode: string,
): Promise<{ videoUrl: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("NO_FAL_KEY");
  const app = mode === "image_to_video" ? "fal-ai/wan-i2v" : "fal-ai/wan-t2v";
  const input: Record<string, unknown> = {
    prompt: prompt.slice(0, 500),
    num_frames: 81,
    frames_per_second: 16,
    resolution: "480p",
    aspect_ratio: "9:16",
    num_inference_steps: 27,
    guidance_scale: 3.5,
  };
  if (mode === "image_to_video" && imageUrl) input.image_url = imageUrl;

  const res = await fetch(`https://fal.run/${app}`, {
    method: "POST",
    headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const responseText = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(responseText); }
  catch { throw new Error(`FAL returned non-JSON (${res.status}): ${responseText.slice(0, 200)}`); }
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail
      : Array.isArray(data.detail) ? data.detail.map((d: Record<string, string>) => d.msg).join(', ')
      : data.message || JSON.stringify(data);
    throw new Error(`FAL error (${res.status}): ${detail}`);
  }
  const videoUrl = (data.video as Record<string, string>)?.url;
  if (!videoUrl) throw new Error("FAL returned no video URL");
  return { videoUrl };
}

/**
 * Submit a video-generation job to FAL's async queue.
 * Returns immediately with a request_id that the UI can poll.
 * Same model + params as the sync call — zero quality difference.
 */
async function submitFalJob(
  prompt: string,
  imageUrl: string | null,
  mode: string,
): Promise<{ requestId: string; app: string; statusUrl: string; responseUrl: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("NO_FAL_KEY");

  const app =
    mode === "image_to_video"
      ? "fal-ai/wan-i2v"
      : "fal-ai/wan-t2v";

  const input: Record<string, unknown> = {
    prompt: prompt.slice(0, 500),
    num_frames: 81,
    frames_per_second: 16,
    resolution: "480p",
    aspect_ratio: "9:16",
    num_inference_steps: 27,
    guidance_scale: 3.5,
  };

  if (mode === "image_to_video" && imageUrl) {
    input.image_url = imageUrl;
  }

  // Queue mode — FAL returns a request_id in under a second; the video
  // is generated asynchronously and we poll /status for completion.
  // Decouples generation time from Vercel's 300s function cap entirely.
  const res = await fetch(`https://queue.fal.run/${app}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const responseText = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`FAL returned non-JSON (${res.status}): ${responseText.slice(0, 200)}`);
  }

  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail
      : Array.isArray(data.detail) ? data.detail.map((d: Record<string, string>) => d.msg).join(', ')
      : data.message || JSON.stringify(data);
    throw new Error(`FAL error (${res.status}): ${detail}`);
  }

  const requestId = data.request_id as string;
  const statusUrl = data.status_url as string;
  const responseUrl = data.response_url as string;
  if (!requestId || !statusUrl || !responseUrl) {
    throw new Error(`FAL submission response missing fields: ${responseText.slice(0, 200)}`);
  }

  return { requestId, app, statusUrl, responseUrl };
}


/* ── Generate video — routes to appropriate model ──
   FAL (Wan 2.2) paths submit async to FAL's queue; PixVerse and the
   composite before_after flow remain synchronous (they're faster and
   use different provider endpoints). */

type VideoResult =
  | { kind: "sync"; videoUrl: string }
  | { kind: "async"; requestId: string; app: string; statusUrl: string; responseUrl: string };

async function generateVideo(
  prompt: string,
  imageUrl: string | null,
  mode: string,
  templateId?: string,
  model?: string,
): Promise<VideoResult> {
  if (templateId === "before_after") {
    const r = await generateBeforeAfter();
    return { kind: "sync", videoUrl: r.videoUrl };
  }
  if (model === "pixverse") {
    const r = await callPixVerse(prompt);
    return { kind: "sync", videoUrl: r.videoUrl };
  }
  const submission = await submitFalJob(prompt, imageUrl, mode);
  return { kind: "async", ...submission };
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const origin = getOrigin(req);
  const denied = await requireManageOrAdmin(req);
  if (denied) return denied;

  const templates = Object.entries(VIDEO_TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description,
    mode: t.mode,
  }));
  const styles = Object.entries(STYLE_PRESETS).map(([id, s]) => ({
    id,
    name: s.name,
  }));

  return jsonResponse(
    { templates, styles, configured: !!process.env.FAL_KEY, provider: "fal" },
    200,
    origin,
  );
}

export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const {
      templateId,
      facilityId,
      imageUrl,
      customNotes,
      promptOverride,
      stylePreset,
      copyContext,
    } = body;

    if (!templateId || !facilityId) {
      return errorResponse(
        "templateId and facilityId required",
        400,
        origin,
      );
    }

    const denied = await requireFacilityAccess(req, facilityId);
    if (denied) return denied;

    // Owners get video on the top plan only (every generation is a paid FAL
    // job); admins are never gated.
    if (!(await isAdminCredential(req))) {
      const gate = await canGenerateVideo(facilityId);
      if (!gate.ok) return errorResponse(gate.reason ?? "Video generation is not on your plan", 403, origin);
    }

    const template = VIDEO_TEMPLATES[templateId];
    if (!template) return errorResponse("Invalid template", 400, origin);

    const facility = await db.facilities.findUnique({
      where: { id: facilityId },
    });
    if (!facility) return errorResponse("Facility not found", 404, origin);

    const facilityData: FacilityData = {
      name: facility.name,
      location: facility.location,
    };

    let prompt =
      promptOverride?.trim() ||
      (await generateVideoPrompt(template, facilityData, facilityId, customNotes, copyContext));

    if (!template.skipCoreStyle) {
      prompt = `${prompt} ${CORE_STYLE}`;
      const style = STYLE_PRESETS[stylePreset];
      if (style?.suffix) {
        prompt = `${prompt} ${style.suffix}`;
      }
    }
    prompt = prompt.slice(0, 1000);

    const sourceImage = imageUrl || null;
    if (template.mode === "image_to_video" && !sourceImage) {
      const asset = await db.assets.findFirst({
        where: { facility_id: facilityId, type: "photo" },
        orderBy: { created_at: "desc" },
        select: { url: true },
      });
      if (!asset) {
        return errorResponse(
          "This template requires an image. Upload or scrape facility images first.",
          400,
          origin,
        );
      }
    }

    const result = await generateVideo(prompt, sourceImage, template.mode, templateId, template.model);

    if (result.kind === "sync") {
      return jsonResponse(
        {
          videoUrl: result.videoUrl,
          prompt,
          template: templateId,
          status: "SUCCEEDED",
        },
        200,
        origin,
      );
    }

    // Async queue job — UI polls /api/generate-video/status to completion.
    return jsonResponse(
      {
        requestId: result.requestId,
        app: result.app,
        statusUrl: result.statusUrl,
        responseUrl: result.responseUrl,
        prompt,
        template: templateId,
        status: "IN_QUEUE",
      },
      202,
      origin,
    );
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Video generation failed",
      500,
      origin,
    );
  }
}
