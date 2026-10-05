import { getAllPosts } from "@/lib/blog";
import { CAL_BOOKING_URL } from "@/lib/booking";
import { conversionPlans, demandEnginePlans } from "@/lib/pricing-plans";
import { HELP_FAQ_CATEGORIES } from "@/lib/public-faq/help-faqs";
import { HOMEPAGE_FAQS } from "@/lib/public-faq/homepage-faqs";

export type PublicChunk = {
  id: string;
  title: string;
  href: string;
  text: string;
};

const PRIVATE_PREFIXES = ["/admin", "/portal", "/partner", "/manage", "/api"];

const ABOUT = [
  "StorageAds is built for storage and nothing else. It is the marketing system independent storage operators use to turn ad spend into move-ins.",
  "Most independent operators have the same problem. Money goes out to ads every month, and nobody can say which of those ads actually filled a unit.",
  "StorageAds is not a general marketing tool with a storage page bolted on. It is built around move-ins, occupancy, and revenue.",
  "The REITs have run this way for years. Independents have not had the option.",
  "This is not a marketing agency. It is the marketing system the REITs already have, built for the operators who don't.",
  "A free diagnostic is available at /diagnostic. No pitch deck and no commitment. Book a call to review it.",
].join(" ");

function assertPublicHref(href: string) {
  if (PRIVATE_PREFIXES.some((prefix) => href === prefix || href.startsWith(`${prefix}/`))) {
    throw new Error(`Public FAQ corpus refused a private path: ${href}`);
  }
  if (!href.startsWith("/")) {
    throw new Error(`Public FAQ corpus href must be a site path: ${href}`);
  }
}

function pushChunk(chunks: PublicChunk[], chunk: PublicChunk) {
  assertPublicHref(chunk.href);
  const text = chunk.text.replace(/\s+/g, " ").trim();
  if (!text) return;
  chunks.push({ ...chunk, text });
}

function stripMarkdown(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function windows(text: string, size = 700, max = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const out: string[] = [];
  let index = 0;
  while (index < words.length && out.length < max) {
    let length = 0;
    let end = index;
    while (end < words.length && length < size) {
      length += words[end].length + 1;
      end += 1;
    }
    out.push(words.slice(index, end).join(" "));
    if (end >= words.length) break;
    index = Math.max(end - 20, index + 1);
  }
  return out;
}

function planText(plan: {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  bestFor?: string;
}): string {
  const period = plan.period ? plan.period.trim() : "";
  const bits = [
    `${plan.name} costs ${plan.price}${period}.`,
    plan.description || "",
    `Includes: ${plan.features.join(". ")}.`,
    plan.bestFor ? `Best for: ${plan.bestFor}` : "",
    "Ad spend is paid directly to Meta or Google and is separate from the StorageAds fee.",
    "Paid media plans are a monthly retainer.",
  ];
  return bits.filter(Boolean).join(" ");
}

let cached: PublicChunk[] | null = null;

/** Published marketing pages, help, pricing, and blog posts. No private data. */
export function getPublicChunks(): PublicChunk[] {
  if (cached) return cached;
  const chunks: PublicChunk[] = [];

  for (const faq of HOMEPAGE_FAQS) {
    pushChunk(chunks, {
      id: `home:${faq.q.slice(0, 48)}`,
      title: "Homepage FAQ",
      href: "/#faq",
      text: `Question: ${faq.q} Answer: ${faq.a}`,
    });
  }

  for (const plan of demandEnginePlans) {
    pushChunk(chunks, {
      id: `pricing:${plan.name}`,
      title: "Pricing",
      href: "/pricing",
      text: `Paid media plan. ${planText(plan)}`,
    });
  }

  for (const plan of conversionPlans) {
    pushChunk(chunks, {
      id: `site:${plan.name}`,
      title: "Pricing",
      href: "/pricing",
      text: `Site build package. ${planText(plan)}`,
    });
  }

  pushChunk(chunks, {
    id: "pricing:math",
    title: "Pricing",
    href: "/pricing",
    text: "A single move-in at a typical self-storage facility generates $100-150 per month. The average tenant stays 12 months. That is $1,200-1,800 in lifetime value from one move-in. If StorageAds produces 5 additional move-ins in a month, that is $6,000-9,000 in annualized revenue.",
  });

  for (const category of HELP_FAQ_CATEGORIES) {
    for (const item of category.items) {
      pushChunk(chunks, {
        id: `help:${item.question.slice(0, 48)}`,
        title: "Help",
        href: "/help",
        text: `${category.title}. Question: ${item.question} Answer: ${item.answer}`,
      });
    }
  }

  pushChunk(chunks, {
    id: "about",
    title: "About",
    href: "/about",
    text: ABOUT,
  });

  pushChunk(chunks, {
    id: "contact",
    title: "Contact",
    href: "/contact",
    text: `Talk to StorageAds by email at blake@storageads.com. You get the founder, not a help desk. Book a call at ${CAL_BOOKING_URL}. A free facility diagnostic is at /diagnostic.`,
  });

  pushChunk(chunks, {
    id: "diagnostic",
    title: "Free facility diagnostic",
    href: "/diagnostic",
    text: "A full diagnostic of your self-storage facility. Occupancy, marketing, digital presence, revenue. Free, confidential, in your inbox in minutes.",
  });

  for (const post of getAllPosts()) {
    const body = stripMarkdown(post.content);
    const lead = `${post.title}. ${post.description} ${body}`;
    windows(lead).forEach((text, i) => {
      pushChunk(chunks, {
        id: `blog:${post.slug}:${i}`,
        title: post.title,
        href: `/blog/${post.slug}`,
        text,
      });
    });
  }

  cached = chunks;
  return chunks;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "is", "it",
  "we", "you", "your", "our", "do", "does", "how", "what", "why", "when",
  "with", "this", "that", "are", "be", "at", "from", "can", "i", "my", "me",
  "if", "so", "not", "just", "about", "into", "than", "then", "there",
  "much", "many", "list", "every", "any", "all", "show", "give", "tell",
  "please", "stored", "number", "numbers", "data", "info", "information",
]);

export function questionTokens(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

export type ScoredChunk = PublicChunk & { score: number };

function tokenWeight(token: string, chunks: PublicChunk[]): number {
  let docs = 0;
  for (const chunk of chunks) {
    if (`${chunk.title} ${chunk.text}`.toLowerCase().includes(token)) docs += 1;
  }
  return Math.log((chunks.length + 1) / (docs + 1)) + 1;
}

export function retrievePublicChunks(question: string, limit = 4): ScoredChunk[] {
  const tokens = [...new Set(questionTokens(question))];
  if (tokens.length === 0) return [];
  const chunks = getPublicChunks();
  const weights = new Map(tokens.map((token) => [token, tokenWeight(token, chunks)]));

  const ranked = chunks
    .map((chunk) => {
      const hay = `${chunk.title} ${chunk.text}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (!hay.includes(token)) continue;
        score += weights.get(token) ?? 1;
        if (chunk.title.toLowerCase().includes(token)) score += 0.5;
      }
      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit);
}

/**
 * Grounded when one public chunk covers most of the question's weight.
 * A stray common word (tenant, phone) is not enough if the rare term is missing.
 */
export function retrievalIsGrounded(question: string, hits: ScoredChunk[]): boolean {
  const tokens = [...new Set(questionTokens(question))];
  if (hits.length === 0 || tokens.length === 0) return false;
  const chunks = getPublicChunks();
  const weights = new Map(tokens.map((token) => [token, tokenWeight(token, chunks)]));
  const total = tokens.reduce((sum, token) => sum + (weights.get(token) ?? 0), 0);
  if (total <= 0) return false;
  const hay = `${hits[0].title} ${hits[0].text}`.toLowerCase();
  const covered = tokens.reduce(
    (sum, token) => sum + (hay.includes(token) ? (weights.get(token) ?? 0) : 0),
    0,
  );
  return covered / total >= 0.55;
}
