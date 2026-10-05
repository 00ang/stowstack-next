"use client";

import { useState, type FormEvent } from "react";
import { Plus, Minus } from "lucide-react";
import { SectionHeader, SectionMeta } from "@/components/mono/section-header";
import { useInView } from "./use-in-view";
import Cite from "./cite";
import { RevealText } from "./motion";
import { HOMEPAGE_FAQS } from "@/lib/public-faq/homepage-faqs";

/**
 * Homepage FAQ. The questions are phrased the way an operator would
 * actually ask them, not the way a marketing team would headline them.
 * Detailed billing / contract questions live on /pricing. The ask box
 * answers from the same public pages.
 */

const FAQS = HOMEPAGE_FAQS;

type AskSource = { title: string; href: string };

type AskState = {
  status: "idle" | "loading" | "done" | "error";
  answer: string;
  sources: AskSource[];
  refused: boolean;
};

const IDLE_ASK: AskState = {
  status: "idle",
  answer: "",
  sources: [],
  refused: false,
};

function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|; )__csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function FAQ() {
  const { ref, isVisible } = useInView();
  const [open, setOpen] = useState<number | null>(0);
  const [question, setQuestion] = useState("");
  const [ask, setAsk] = useState<AskState>(IDLE_ASK);

  async function onAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const honeypot = new FormData(form).get("company_website");
    const trimmed = question.trim();
    if (trimmed.length < 3 || ask.status === "loading") return;

    setAsk({ status: "loading", answer: "", sources: [], refused: false });
    try {
      const token = readCsrfToken();
      const res = await fetch("/api/public-faq", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { "x-csrf-token": token } : {}),
        },
        body: JSON.stringify({
          question: trimmed,
          company_website: typeof honeypot === "string" ? honeypot : "",
        }),
      });
      const data = (await res.json()) as {
        answer?: string;
        sources?: AskSource[];
        refused?: boolean;
        error?: string;
      };
      if (!res.ok || !data.answer) {
        setAsk({
          status: "error",
          answer: data.error || "That did not go through. Try again, or email blake@storageads.com.",
          sources: [],
          refused: false,
        });
        return;
      }
      setAsk({
        status: "done",
        answer: data.answer,
        sources: Array.isArray(data.sources) ? data.sources : [],
        refused: Boolean(data.refused),
      });
    } catch {
      setAsk({
        status: "error",
        answer: "That did not go through. Try again, or email blake@storageads.com.",
        sources: [],
        refused: false,
      });
    }
  }

  return (
    <section
      id="faq"
      aria-label="Frequently asked questions"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div ref={ref} className="section-content">
        <SectionHeader
          number="07"
          kicker="QUESTIONS"
          right={<SectionMeta text={`${FAQS.length} ANSWERS`} />}
          style={{ marginBottom: 24 }}
        />

        <div
          className={`max-w-3xl mx-auto text-center mb-10 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2
            className="font-semibold"
            style={{ fontSize: "var(--text-section-head)" }}
          >
            <RevealText>Common questions from operators.</RevealText>
          </h2>
          <p className="mt-4 mx-auto max-w-xl" style={{ color: "var(--text-secondary)" }}>
            If yours isn&apos;t here, email{" "}
            <a
              href="mailto:blake@storageads.com"
              className="font-medium underline decoration-1 underline-offset-4 transition-colors hover:text-[var(--color-dark)]"
              style={{ color: "var(--color-dark)" }}
            >
              blake@storageads.com
            </a>
            . You&apos;ll get the founder, not a help desk.
          </p>
        </div>

        <form
          onSubmit={onAsk}
          className="max-w-3xl mx-auto mb-10"
          aria-label="Ask a question"
        >
          <label
            htmlFor="faq-ask"
            className="block text-sm font-semibold mb-2"
            style={{ color: "var(--color-dark)", fontFamily: "var(--font-heading)" }}
          >
            Ask a question
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="faq-ask"
              name="question"
              type="text"
              value={question}
              maxLength={400}
              required
              minLength={3}
              autoComplete="off"
              placeholder="How much is it for one facility?"
              onChange={(event) => setQuestion(event.target.value)}
              className="w-full"
              style={{
                minHeight: 48,
                padding: "12px 14px",
                background: "var(--bg)",
                color: "var(--text)",
                border: "1px solid var(--line)",
                fontFamily: "var(--font-body)",
                fontSize: 16,
              }}
            />
            <button
              type="submit"
              disabled={ask.status === "loading" || question.trim().length < 3}
              className="font-semibold"
              style={{
                minHeight: 48,
                minWidth: 96,
                padding: "12px 18px",
                background: "var(--text)",
                color: "var(--bg)",
                border: "1px solid var(--text)",
                fontFamily: "var(--font-heading)",
                cursor: ask.status === "loading" ? "progress" : "pointer",
                opacity: ask.status === "loading" || question.trim().length < 3 ? 0.55 : 1,
              }}
            >
              {ask.status === "loading" ? "Looking" : "Ask"}
            </button>
          </div>
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            defaultValue=""
            style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
          />
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Short answers from the public site. If it is not written here, we say so.
          </p>
          {ask.status === "loading" && (
            <p className="mt-4 text-sm" role="status" style={{ color: "var(--text-secondary)" }}>
              Looking that up.
            </p>
          )}
          {(ask.status === "done" || ask.status === "error") && ask.answer && (
            <div
              className="mt-4"
              role="status"
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-alt)",
                padding: "16px 18px",
              }}
            >
              <p
                className="text-[15px]"
                style={{ color: "var(--text)", lineHeight: "var(--leading-normal)" }}
              >
                {ask.answer}
              </p>
              {ask.sources.length > 0 && (
                <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  From{" "}
                  {ask.sources.map((source, index) => (
                    <span key={source.href}>
                      {index > 0 ? ", " : ""}
                      <a
                        href={source.href}
                        className="underline decoration-1 underline-offset-4"
                        style={{ color: "var(--color-dark)" }}
                      >
                        {source.title}
                      </a>
                    </span>
                  ))}
                  .
                </p>
              )}
            </div>
          )}
        </form>

        <div className="max-w-3xl mx-auto">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div
                key={faq.q}
                className={`border-b transition-all duration-700 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                }`}
                style={{
                  borderColor: "var(--border-subtle)",
                  borderTop: i === 0 ? "1px solid var(--border-subtle)" : undefined,
                  transitionDelay: `${100 + i * 60}ms`,
                }}
              >
                <button
                  type="button"
                  id={`faq-btn-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-start justify-between gap-6 text-left py-5 transition-colors hover:bg-[var(--color-light-gray)]/30 cursor-pointer"
                >
                  <h3
                    className="text-base sm:text-lg font-semibold flex-1"
                    style={{ color: "var(--color-dark)", fontFamily: "var(--font-heading)" }}
                  >
                    {faq.q}
                  </h3>
                  <span
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-1"
                    aria-hidden="true"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                  </span>
                </button>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-btn-${i}`}
                  aria-hidden={!isOpen}
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    maxHeight: isOpen ? 400 : 0,
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <p
                    className="pb-5 pr-12 text-[15px]"
                    style={{
                      color: "var(--text-secondary)",
                      lineHeight: "var(--leading-normal)",
                    }}
                  >
                    {faq.a}
                    {faq.cite && <Cite n={faq.cite} />}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
