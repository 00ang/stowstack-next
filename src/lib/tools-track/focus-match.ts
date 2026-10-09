import { sizeKey } from "@/lib/ontology/address";
import type { ObjectTypeKey, Ontology, OntologyObject } from "@/lib/ontology/types";

/**
 * Does this text name the object in focus? A unit matches when the copy
 * names its size, climate kept apart from the plain size. Other types match
 * on their own name, or on the record id when the row is that object.
 */

const CLIMATE = /climate|\bcc\b|heated|temperature/i;
const SIZE_RE = /(\d+(?:\.\d+)?)\s*(?:'|’|ft\.?|feet)?\s*[x×X*]\s*(\d+(?:\.\d+)?)/gi;

function fact(focus: OntologyObject, label: string): string | null {
  return focus.facts.find((f) => f.label === label)?.value ?? null;
}

/** True when `text` names `size`, and the climate of that mention agrees. */
export function mentionsSize(text: string, size: string, climate: boolean): boolean {
  for (const match of text.matchAll(SIZE_RE)) {
    if (sizeKey(match[0]) !== size) continue;
    const at = match.index ?? 0;
    const window = text.slice(Math.max(0, at - 32), Math.min(text.length, at + match[0].length + 32));
    if (CLIMATE.test(window) === climate) return true;
  }
  return false;
}

export function textNamesFocus(focus: OntologyObject, text: string, itemId?: string): boolean {
  if (focus.type === "ads" && itemId && itemId === focus.id) return true;
  if (focus.type === "units") {
    const size = sizeKey(focus.name) ?? sizeKey(focus.address);
    const climate = CLIMATE.test(`${focus.name} ${fact(focus, "Features") ?? ""}`);
    if (size) return mentionsSize(text, size, climate);
  }
  if (focus.type === "leads") {
    const wants = fact(focus, "Wants");
    if (wants && mentionsSize(text, sizeKey(wants) ?? "", CLIMATE.test(wants))) return true;
  }
  if (focus.type === "pages") {
    const slug = (fact(focus, "Lives at") ?? "").replace(/^\/lp\//, "") || focus.address.split("/")[1];
    const hay = text.toLowerCase();
    if (slug && hay.includes(slug.toLowerCase())) return true;
  }
  const name = focus.name.trim().toLowerCase();
  return name.length >= 3 && text.toLowerCase().includes(name);
}

/** Ids of objects of `type` linked to `address`. An ad linked to the unit targets it even before the copy says so. */
export function linkedIds(ontology: Ontology | null | undefined, address: string, type: ObjectTypeKey): Set<string> {
  if (!ontology) return new Set();
  const focus = ontology.objects.find((o) => o.address === address);
  if (!focus) return new Set();
  const ids = new Set<string>();
  for (const link of focus.links) {
    const other = ontology.objects.find((o) => o.address === link);
    if (other?.type === type) ids.add(other.id);
  }
  return ids;
}

export function splitByFocus<T>(
  focus: OntologyObject | null | undefined,
  items: T[],
  textOf: (item: T) => string,
  idOf: (item: T) => string = () => "",
  also: ReadonlySet<string> = new Set(),
): { named: T[]; rest: T[] } {
  if (!focus) return { named: items, rest: [] };
  const named: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    const id = idOf(item);
    if ((id && also.has(id)) || textNamesFocus(focus, textOf(item), id)) named.push(item);
    else rest.push(item);
  }
  return { named, rest };
}

/** Flatten a creative's copy fields into one string. */
export function variationText(content: unknown): string {
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(content);
  return parts.join(" ");
}
