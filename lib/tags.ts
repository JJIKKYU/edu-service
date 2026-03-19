export const VALID_TAGS = ["TCK", "CMP"] as const;
export type Tag = (typeof VALID_TAGS)[number];

export function normalizeTags(tags: Iterable<string>): Tag[] {
  return [...new Set(tags)]
    .filter((t): t is Tag => (VALID_TAGS as readonly string[]).includes(t))
    .sort();
}

export function serializeTags(tags: Tag[]): string {
  return normalizeTags(tags).join(",");
}

export function parseTags(raw: string): Tag[] {
  if (!raw) return [];
  return normalizeTags(raw.split(","));
}
