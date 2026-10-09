import type { Block, BlockType, SectionRow, StoredBlockType } from "./types";

/** section_type values the public page and the admin builder already store. */
const SECTION_TYPE: Record<BlockType, string> = {
  hero: "hero",
  units: "unit_types",
  offer: "offer",
  reserve: "reserve",
  ask: "ask",
  location: "location_map",
  access: "features",
  faq: "faq",
  photos: "gallery",
};

const TYPE_BY_SECTION: Record<string, BlockType> = Object.fromEntries(
  (Object.entries(SECTION_TYPE) as [BlockType, string][]).map(([type, section]) => [section, type]),
);

export const BLOCK_LABEL: Record<BlockType, string> = {
  hero: "Hero",
  units: "Unit sizes",
  offer: "Offer",
  reserve: "Reserve",
  ask: "Ask",
  location: "Hours and map",
  access: "Access",
  faq: "FAQ",
  photos: "Photos",
};

let seq = 0;

export function newBlockId(type: string): string {
  seq += 1;
  return `b-${type}-${seq}-${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultConfig(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "hero":
      return { headline: "", subheadline: "", backgroundImage: "", facilityName: "" };
    case "units":
      return { headline: "Available units", live: true, sizeKeys: [] };
    case "offer":
      return { name: "", detail: "" };
    case "reserve":
      return { label: "Reserve a unit" };
    case "ask":
      return { headline: "Leave your number. We’ll get back to you." };
    case "location":
      return { headline: "Find the facility", address: "", hours: "", phone: "" };
    case "access":
      return { headline: "At the facility", items: [] as { title: string; desc: string }[] };
    case "faq":
      return { headline: "Questions", items: [] as { q: string; a: string }[] };
    case "photos":
      return { images: [] as { url: string; alt: string }[] };
  }
}

export function makeBlock(type: BlockType, config: Record<string, unknown> = {}, id?: string): Block {
  return { id: id ?? newBlockId(type), type, config: { ...defaultConfig(type), ...config } };
}

export function blocksToSections(blocks: Block[]): { section_type: string; sort_order: number; config: Record<string, unknown> }[] {
  return blocks.map((block, i) => {
    if (block.type === "custom") {
      const sectionType = typeof block.config.section_type === "string" ? block.config.section_type : "custom";
      const rest = { ...block.config };
      delete rest.section_type;
      return { section_type: sectionType, sort_order: i, config: rest };
    }
    return { section_type: SECTION_TYPE[block.type], sort_order: i, config: block.config };
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function sectionsToBlocks(sections: SectionRow[]): Block[] {
  return [...sections]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((section) => {
      const known = TYPE_BY_SECTION[section.section_type];
      const config = asRecord(section.config);
      if (!known) {
        return {
          id: section.id || newBlockId(section.section_type),
          type: "custom" as StoredBlockType,
          config: { ...config, section_type: section.section_type },
        };
      }
      return {
        id: section.id || newBlockId(known),
        type: known,
        config: { ...defaultConfig(known), ...config },
      };
    });
}

export function moveBlock(blocks: Block[], from: number, to: number): Block[] {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks;
  const next = blocks.slice();
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

export function updateBlock(blocks: Block[], id: string, patch: Record<string, unknown>): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, config: { ...b.config, ...patch } } : b));
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id);
}

export function findBlock(blocks: Block[], type: BlockType): Block | undefined {
  return blocks.find((b) => b.type === type);
}

export function textOf(block: Block | undefined, key: string): string {
  const value = block?.config[key];
  return typeof value === "string" ? value : "";
}
