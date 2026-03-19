export const VALID_TAGS = ["TCK", "CMP"] as const;
export type Tag = (typeof VALID_TAGS)[number];

export function serializeTags(tags: Tag[]): string {
  return [...new Set(tags)]
    .filter((t) => (VALID_TAGS as readonly string[]).includes(t))
    .sort()
    .join(",");
}

export function parseTags(raw: string): Tag[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((t): t is Tag => (VALID_TAGS as readonly string[]).includes(t));
}
