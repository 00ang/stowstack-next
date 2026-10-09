"use client";

import { useEffect, useRef, useState } from "react";
import type { Block, LiveUnit } from "@/lib/page-blocks";

/**
 * The public page for a block-edited landing page, and the editor's
 * preview. The facility's name, photo and rates come first. Text can be
 * edited in place when `onText` is set; the form stays inert then.
 */

export interface BlockPageProps {
  title: string;
  blocks: Block[];
  units: LiveUnit[];
  facilityName?: string;
  phone?: string | null;
  storedgeUrl?: string | null;
  facilityId?: string;
  pageId?: string;
  /** Sample facility. The page says so, and the form is not sent. */
  sample?: boolean;
  onText?: (blockId: string, key: string, value: string) => void;
  onFaq?: (blockId: string, index: number, key: "q" | "a", value: string) => void;
}

function money(rate: number | null): string {
  if (rate == null) return "Rate not on file";
  return Number.isInteger(rate) ? `$${rate}/mo` : `$${rate.toFixed(2)}/mo`;
}

function fold(value: string): string {
  return value.toLowerCase().replace(/×/g, "x").replace(/\s+/g, "");
}

/** Two unit types can share a size label (drive-up 10x10 and climate 10x10). The form needs both, with different keys. */
export function askSizeOptions(units: LiveUnit[]): { key: string; label: string }[] {
  const sizes = units.map((u) => u.size || u.name);
  const shared = new Set(sizes.filter((s, i) => sizes.indexOf(s) !== i));
  return units.map((u, i) => {
    const size = u.size || u.name;
    const hint = u.features.find((f) => f && f !== size) || (u.name !== size ? u.name : "");
    const label = shared.has(size) && hint ? `${size} · ${hint}` : size;
    return { key: u.key || `${label}-${i}`, label };
  });
}

function unitsFor(block: Block, all: LiveUnit[]): LiveUnit[] {
  const keys = Array.isArray(block.config.sizeKeys) ? (block.config.sizeKeys as unknown[]) : [];
  const want = new Set(keys.filter((k): k is string => typeof k === "string").map(fold));
  if (!want.size) return all;
  const hit = all.filter((u) => want.has(fold(u.key)) || want.has(fold(u.name)) || want.has(fold(u.size)));
  return hit.length ? hit : all;
}

function str(block: Block, key: string): string {
  const v = block.config[key];
  return typeof v === "string" ? v : "";
}

function Inline({
  text,
  onCommit,
  className,
  label,
}: {
  text: string;
  onCommit?: (value: string) => void;
  className: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== text) el.textContent = text;
  }, [text]);
  if (!onCommit) return <div className={className}>{text}</div>;
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el && el.dataset.ready !== "1") {
          el.textContent = text;
          el.dataset.ready = "1";
        }
      }}
      role="textbox"
      aria-label={label}
      contentEditable
      suppressContentEditableWarning
      className={`${className} cursor-text outline-none focus:ring-2 focus:ring-[#141413]/30`}
      onBlur={() => onCommit(ref.current?.textContent ?? "")}
    />
  );
}

export function BlockPage({
  blocks,
  units,
  facilityName,
  phone,
  storedgeUrl,
  facilityId,
  pageId,
  sample,
  onText,
  onFaq,
}: BlockPageProps) {
  return (
    <div className="min-h-full bg-[#E0E0E5] text-[#141413]" style={{ fontFamily: 'var(--font-manrope), "Manrope", system-ui, sans-serif' }}>
      {blocks.map((block) => {
        if (block.type === "hero") return <Hero key={block.id} block={block} facilityName={facilityName} onText={onText} />;
        if (block.type === "units") return <Units key={block.id} block={block} units={unitsFor(block, units)} />;
        if (block.type === "offer") return <Offer key={block.id} block={block} onText={onText} />;
        if (block.type === "reserve") return <Reserve key={block.id} block={block} url={storedgeUrl} phone={phone} />;
        if (block.type === "ask") {
          return (
            <Ask
              key={block.id}
              block={block}
              sizes={askSizeOptions(units)}
              facilityId={facilityId}
              pageId={pageId}
              inert={!!onText || !!sample}
              sample={sample}
            />
          );
        }
        if (block.type === "location") return <Location key={block.id} block={block} />;
        if (block.type === "access") return <Access key={block.id} block={block} />;
        if (block.type === "faq") return <Faq key={block.id} block={block} onFaq={onFaq} />;
        if (block.type === "photos") return <Photos key={block.id} block={block} facilityName={facilityName} />;
        return null;
      })}
      <footer className="px-5 py-8 text-[13px] font-semibold text-[#3F4350]">
        {facilityName || "Storage"}
        {sample ? " · Sample facility. Rates and names here are sample data." : ""}
      </footer>
    </div>
  );
}

function Hero({
  block,
  facilityName,
  onText,
}: {
  block: Block;
  facilityName?: string;
  onText?: BlockPageProps["onText"];
}) {
  const photo = str(block, "backgroundImage");
  const name = str(block, "facilityName") || facilityName || "";
  const headline = str(block, "headline");
  const sub = str(block, "subheadline");
  return (
    <section className="relative min-h-[20rem] overflow-hidden">
      {photo ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${photo})` }} role="img" aria-label={name || "Facility"} />
      ) : (
        <div className="absolute inset-0 bg-[#E0E0E5]" />
      )}
      {photo && <div className="absolute inset-0 bg-[#141413]/45" />}
      <div className={`relative flex min-h-[20rem] flex-col justify-center px-5 py-10 md:px-12 md:py-16 ${photo ? "text-white" : "text-[#141413]"}`}>
        {name && <div className="text-[12px] font-bold uppercase tracking-[0.18em]">{name}</div>}
        <Inline
          text={headline}
          label="Headline"
          onCommit={onText ? (v) => onText(block.id, "headline", v) : undefined}
          className="mt-3 max-w-3xl text-[34px] font-extrabold leading-[1.05] tracking-tight md:text-6xl"
        />
        {(sub || onText) && (
          <Inline
            text={sub}
            label="Subhead"
            onCommit={onText ? (v) => onText(block.id, "subheadline", v) : undefined}
            className={`mt-4 max-w-2xl text-[17px] font-semibold leading-snug md:text-xl ${photo ? "text-white/90" : "text-[#3F4350]"}`}
          />
        )}
      </div>
    </section>
  );
}

function Units({ block, units }: { block: Block; units: LiveUnit[] }) {
  const headline = str(block, "headline") || "Available units";
  return (
    <section className="border-t border-[#141413]/10 bg-white px-5 py-12 md:px-12 md:py-16">
      <h2 className="text-[28px] font-extrabold tracking-tight md:text-4xl">{headline}</h2>
      {units.length === 0 ? (
        <p className="mt-4 text-[16px] font-semibold text-[#3F4350]">Rates appear here from the facility’s units.</p>
      ) : (
        <ul className="mt-6 divide-y divide-[#141413]/10 border-y border-[#141413]/10">
          {units.map((u) => (
            <li key={u.key} className="flex flex-wrap items-baseline justify-between gap-2 py-4">
              <div>
                <div className="text-[18px] font-extrabold">{u.name}</div>
                <div className="text-[14px] font-semibold text-[#3F4350]">
                  {u.size !== u.name ? `${u.size} · ` : ""}
                  {u.vacant > 0 ? `${u.vacant} open` : "Full"}
                  {u.features.length ? ` · ${u.features.join(", ")}` : ""}
                </div>
              </div>
              <div className="text-[20px] font-extrabold">{money(u.rate)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Offer({ block, onText }: { block: Block; onText?: BlockPageProps["onText"] }) {
  const name = str(block, "name");
  const detail = str(block, "detail");
  if (!name && !onText) return null;
  return (
    <section className="bg-[#1E3C74] px-5 py-10 text-white md:px-12">
      <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/80">Current offer</div>
      <Inline
        text={name}
        label="Offer"
        onCommit={onText ? (v) => onText(block.id, "name", v) : undefined}
        className="mt-2 text-[28px] font-extrabold tracking-tight md:text-4xl"
      />
      {(detail || onText) && (
        <Inline
          text={detail}
          label="Offer detail"
          onCommit={onText ? (v) => onText(block.id, "detail", v) : undefined}
          className="mt-2 max-w-xl text-[16px] font-semibold text-white/90"
        />
      )}
    </section>
  );
}

function Reserve({ block, url, phone }: { block: Block; url?: string | null; phone?: string | null }) {
  const label = str(block, "label") || "Reserve a unit";
  const tel = phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : "";
  return (
    <section id="reserve" className="bg-[#E0E0E5] px-5 py-12 md:px-12">
      <h2 className="text-[28px] font-extrabold tracking-tight">{label}</h2>
      <p className="mt-2 max-w-xl text-[16px] font-semibold text-[#3F4350]">
        {url ? "Reservations go through storEDGE." : "Call the office to reserve. A storEDGE link can go here."}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center bg-[#141413] px-6 py-4 text-[16px] font-extrabold text-[#E0E0E5]">
            {label}
          </a>
        )}
        {tel && (
          <a href={tel} className="inline-flex items-center justify-center border border-[#141413] px-6 py-4 text-[16px] font-extrabold">
            Call {phone}
          </a>
        )}
      </div>
    </section>
  );
}

function Ask({
  block,
  sizes,
  facilityId,
  pageId,
  inert,
  sample,
}: {
  block: Block;
  sizes: { key: string; label: string }[];
  facilityId?: string;
  pageId?: string;
  inert?: boolean;
  sample?: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [size, setSize] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const headline = str(block, "headline") || "Leave your number. We’ll get back to you.";
  const field = "mt-1 w-full border border-[#141413]/25 bg-white px-3 py-3 text-[16px] font-semibold text-[#141413]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inert) {
      setSent(true);
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          unitSize: size,
          facilityId,
          landingPageId: pageId,
          sessionId: typeof sessionStorage !== "undefined" ? sessionStorage.getItem("storageads_session_id") : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That didn’t go through. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("That didn’t go through. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="ask" className="border-t border-[#141413]/10 bg-white px-5 py-12 md:px-12 md:py-16">
      <div className="mx-auto max-w-xl">
        {sent ? (
          <h2 className="text-[28px] font-extrabold tracking-tight">
            {sample || inert ? "That’s the form. Nothing was sent." : `Thanks${name ? `, ${name.split(" ")[0]}` : ""}.`}
          </h2>
        ) : (
          <form onSubmit={submit}>
            <h2 className="text-[28px] font-extrabold leading-tight tracking-tight md:text-4xl">{headline}</h2>
            <label className="mt-6 block text-[14px] font-extrabold">
              Name
              <input required className={field} style={{ fontSize: 16 }} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-[14px] font-extrabold">
                Phone
                <input required className={field} style={{ fontSize: 16 }} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" />
              </label>
              <label className="block text-[14px] font-extrabold">
                Email
                <input required className={field} style={{ fontSize: 16 }} value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
              </label>
            </div>
            {sizes.length > 0 && (
              <label className="mt-4 block text-[14px] font-extrabold">
                Size
                <select className={field} style={{ fontSize: 16 }} value={size} onChange={(e) => setSize(e.target.value)}>
                  <option value="">Not sure yet</option>
                  {sizes.map((s) => (
                    <option key={s.key} value={s.label}>{s.label}</option>
                  ))}
                </select>
              </label>
            )}
            {error && (
              <div role="alert" className="mt-4 border-l-4 border-[#A12A2A] pl-3 text-[15px] font-semibold">
                {error}
              </div>
            )}
            <button type="submit" disabled={sending} className="mt-6 bg-[#141413] px-6 py-4 text-[16px] font-extrabold text-[#E0E0E5] disabled:opacity-60">
              {sending ? "Sending" : "Ask about a unit"}
            </button>
            <p className="mt-3 text-[13px] font-semibold text-[#3F4350]">
              {sample ? "Sample page. This form is not sent." : "By sending this you agree to a text or call about storage."}
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

function Location({ block }: { block: Block }) {
  const address = str(block, "address");
  const hours = str(block, "hours");
  const phone = str(block, "phone");
  const map = address ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed` : "";
  return (
    <section className="border-t border-[#141413]/10 bg-[#E0E0E5] px-5 py-12 md:px-12">
      <h2 className="text-[28px] font-extrabold tracking-tight">{str(block, "headline") || "Find the facility"}</h2>
      {address && <p className="mt-3 text-[18px] font-extrabold">{address}</p>}
      {hours && <p className="mt-1 text-[16px] font-semibold text-[#3F4350]">{hours}</p>}
      {phone && (
        <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="mt-2 inline-block text-[16px] font-extrabold underline underline-offset-4">
          {phone}
        </a>
      )}
      {map && (
        <div className="mt-5 overflow-hidden border border-[#141413]/15 bg-white">
          <iframe title={`Map of ${address}`} src={map} className="h-64 w-full" loading="lazy" />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2 text-[14px] font-extrabold underline underline-offset-4"
          >
            Directions
          </a>
        </div>
      )}
    </section>
  );
}

function Access({ block }: { block: Block }) {
  const items = Array.isArray(block.config.items) ? (block.config.items as { title?: string; desc?: string }[]) : [];
  const shown = items.filter((i) => i.title);
  if (!shown.length) return null;
  return (
    <section className="border-t border-[#141413]/10 bg-white px-5 py-12 md:px-12">
      <h2 className="text-[28px] font-extrabold tracking-tight">{str(block, "headline") || "At the facility"}</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {shown.map((item) => (
          <li key={item.title} className="border border-[#141413]/15 px-4 py-3">
            <div className="text-[16px] font-extrabold">{item.title}</div>
            {item.desc && <div className="mt-1 text-[14px] font-semibold text-[#3F4350]">{item.desc}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Faq({ block, onFaq }: { block: Block; onFaq?: BlockPageProps["onFaq"] }) {
  const items = Array.isArray(block.config.items) ? (block.config.items as { q?: string; a?: string }[]) : [];
  if (!items.length) return null;
  return (
    <section className="border-t border-[#141413]/10 bg-white px-5 py-12 md:px-12">
      <h2 className="text-[28px] font-extrabold tracking-tight">{str(block, "headline") || "Questions"}</h2>
      <div className="mt-4 divide-y divide-[#141413]/10 border-y border-[#141413]/10">
        {items.map((item, i) => (
          <details key={`${item.q}-${i}`} className="py-3" open={!!onFaq}>
            <summary className="cursor-pointer text-[16px] font-extrabold">
              {onFaq ? (
                <Inline text={item.q ?? ""} label="Question" onCommit={(v) => onFaq(block.id, i, "q", v)} className="inline" />
              ) : (
                item.q
              )}
            </summary>
            {onFaq ? (
              <Inline text={item.a ?? ""} label="Answer" onCommit={(v) => onFaq(block.id, i, "a", v)} className="mt-2 text-[15px] font-semibold text-[#3F4350]" />
            ) : (
              <p className="mt-2 text-[15px] font-semibold text-[#3F4350]">{item.a}</p>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}

function Photos({ block, facilityName }: { block: Block; facilityName?: string }) {
  const images = Array.isArray(block.config.images) ? (block.config.images as { url?: string; alt?: string }[]) : [];
  const shown = images.filter((i) => i.url);
  if (!shown.length) return null;
  return (
    <section className="border-t border-[#141413]/10 bg-[#E0E0E5] px-5 py-12 md:px-12">
      <h2 className="text-[28px] font-extrabold tracking-tight">Photos</h2>
      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3">
        {shown.map((img) => (
          <div
            key={img.url}
            role="img"
            aria-label={img.alt || facilityName || "Facility photo"}
            className="aspect-[4/3] w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${img.url})` }}
          />
        ))}
      </div>
    </section>
  );
}
