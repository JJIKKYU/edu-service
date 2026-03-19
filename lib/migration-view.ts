import type { FileGroup } from "./group-files";

export const MIGRATION_VIEWS = ["all", "tck", "cmp"] as const;
export type MigrationView = (typeof MIGRATION_VIEWS)[number];

export function parseMigrationView(raw?: string): MigrationView {
  if (raw === "tck" || raw === "cmp") return raw;
  return "all";
}

export function filterGroupsByView(
  groups: FileGroup[],
  view: MigrationView
): FileGroup[] {
  if (view === "all") return groups;

  const tag = view.toUpperCase();
  return groups.filter((group) => group.tags.includes(tag));
}

export function getViewLabel(view: MigrationView): string {
  if (view === "tck") return "TCK";
  if (view === "cmp") return "CMP";
  return "전체";
}
