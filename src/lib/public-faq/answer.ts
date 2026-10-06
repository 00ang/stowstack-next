import {
  isCommercialPricingQuestion,
  retrievePublicChunks,
  retrievalIsGrounded,
  type ScoredChunk,
} from "@/lib/public-faq/corpus";

export type PublicFaqSource = { title: string; href: string };

export type PublicFaqAnswer = {
  answer: string;
  sources: PublicFaqSource[];
  grounded: boolean;
  refused: boolean;
};

const REFUSAL =
  "The public site does not cover that. Email blake@storageads.com and you will get the founder.";

const SYSTEM = `You answer questions about StorageAds for independent self-storage operators.
Use ONLY the excerpts. They are public pages on storageads.com.
If the excerpts do not contain the answer, set refused to true and say the public site does not cover it. Tell them to email blake@storageads.com.
Do not use outside knowledge. Do not invent prices, features, counts, or names.
Do not mention private operator data, customer records, facility internals, passwords, or API keys.
Write 2 or 3 short sentences. Plain language. No em dashes.
Reply as JSON only: {"answer":"...","refused":false}`;

const MODEL = "claude-haiku-4-5-20251001";

export type Completer = (userPrompt: string) => Promise<string | null>;

function plain(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function shortExcerpt(text: string, max = 420): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
  if (stop > 140) return cut.slice(0, stop + 1);
  return `${cut.trim()}.`;
}

function sourcesFrom(hits: ScoredChunk[]): PublicFaqSource[] {
  const seen = new Set<string>();
  const sources: PublicFaqSource[] = [];
  for (const hit of hits) {
    if (seen.has(hit.href)) continue;
    seen.add(hit.href);
    sources.push({ title: hit.title, href: hit.href });
    if (sources.length === 3) break;
  }
  return sources;
}

function firstSentences(text: string, count = 2): string {
  const parts = text.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (!parts || parts.length === 0) return shortExcerpt(text, 320);
  return parts.slice(0, count).join(" ").trim();
}

const PLAN_SENTENCE =
  /\b(Launch|Growth|Portfolio|Single Site|Site \+ Landing Pages|Portfolio Build) costs [^.]+\./;

function extractive(hits: ScoredChunk[]): string {
  let text = hits[0].text;
  const answerAt = text.indexOf("Answer: ");
  if (answerAt >= 0) text = text.slice(answerAt + "Answer: ".length);
  text = text.replace(/^(Paid media plan|Site build package)\.\s*/i, "");
  return plain(firstSentences(text));
}

/**
 * Price questions quote the public plan cards. A general "one facility"
 * question names Launch and Growth. A named plan stays on that plan.
 */
function commercialPricingAnswer(question: string, hits: ScoredChunk[]): string | null {
  if (!isCommercialPricingQuestion(question)) return null;
  const named = question.match(/\b(launch|growth|portfolio|single site|portfolio build)\b/i);
  const sentences: string[] = [];
  for (const hit of hits) {
    if (hit.href !== "/pricing") continue;
    const sentence = hit.text.match(PLAN_SENTENCE)?.[0];
    if (!sentence) continue;
    if (named && !sentence.toLowerCase().includes(named[1].toLowerCase())) continue;
    if (!named && !/\$\d[\d,]*\/mo per facility/i.test(sentence)) continue;
    if (!sentences.includes(sentence)) sentences.push(sentence);
  }
  if (sentences.length === 0) return null;
  return plain(sentences.slice(0, 2).join(" "));
}

function dollarAmounts(text: string): string[] {
  return text.match(/\$\d[\d,]*/g) ?? [];
}

function dollarsStayInExcerpts(answer: string, excerpts: string): boolean {
  const allowed = new Set(dollarAmounts(excerpts));
  return dollarAmounts(answer).every((amount) => allowed.has(amount));
}

function parseModel(raw: string): { answer: string; refused: boolean } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      answer?: unknown;
      refused?: unknown;
    };
    if (typeof parsed.answer !== "string" || !parsed.answer.trim()) return null;
    return { answer: plain(parsed.answer), refused: parsed.refused === true };
  } catch {
    return null;
  }
}

export async function completeWithAnthropic(userPrompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 320,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}

function buildPrompt(question: string, hits: ScoredChunk[]): string {
  const excerpts = hits
    .map((hit, i) => `[${i + 1}] ${hit.title} (${hit.href})\n${hit.text}`)
    .join("\n\n");
  return `EXCERPTS:\n${excerpts}\n\nQUESTION:\n${question}`;
}

export async function answerPublicQuestion(
  question: string,
  complete: Completer = completeWithAnthropic,
): Promise<PublicFaqAnswer> {
  const hits = retrievePublicChunks(question);
  if (!retrievalIsGrounded(question, hits)) {
    return { answer: REFUSAL, sources: [], grounded: false, refused: true };
  }

  const sources = sourcesFrom(hits);
  const excerpts = hits.map((hit) => hit.text).join("\n");
  const fallback = commercialPricingAnswer(question, hits) ?? extractive(hits);

  const raw = await complete(buildPrompt(question, hits));
  const parsed = raw ? parseModel(raw) : null;
  if (!parsed || parsed.refused) {
    if (parsed?.refused && !(isCommercialPricingQuestion(question) && fallback)) {
      return { answer: REFUSAL, sources: [], grounded: false, refused: true };
    }
    return { answer: fallback, sources, grounded: true, refused: false };
  }

  if (!dollarsStayInExcerpts(parsed.answer, excerpts)) {
    return { answer: fallback, sources, grounded: true, refused: false };
  }

  if (isCommercialPricingQuestion(question) && dollarAmounts(parsed.answer).length === 0) {
    return { answer: fallback, sources, grounded: true, refused: false };
  }

  return {
    answer: parsed.answer.slice(0, 700),
    sources,
    grounded: true,
    refused: false,
  };
}
