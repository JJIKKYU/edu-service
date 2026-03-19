"use client";

import { parseFile } from "@/lib/parsers";
import { normalizeTags, serializeTags, type Tag } from "@/lib/tags";
import type { SymbolItem } from "@/lib/symbols";

export const MIGRATION_STORAGE_KEY = "migration-board/files";

export interface StoredFileRecord {
  id: string;
  name: string;
  tags: string;
  createdAt: string;
  symbols: SymbolItem[];
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortFiles(files: StoredFileRecord[]) {
  return [...files].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function loadStoredFiles(): StoredFileRecord[] {
  if (!canUseStorage()) return [];

  const raw = window.localStorage.getItem(MIGRATION_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoredFileRecord[];
    if (!Array.isArray(parsed)) return [];

    return sortFiles(
      parsed.filter(
        (file): file is StoredFileRecord =>
          !!file &&
          typeof file.id === "string" &&
          typeof file.name === "string" &&
          typeof file.tags === "string" &&
          typeof file.createdAt === "string" &&
          Array.isArray(file.symbols)
      )
    );
  } catch {
    return [];
  }
}

export function saveStoredFiles(files: StoredFileRecord[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(MIGRATION_STORAGE_KEY, JSON.stringify(sortFiles(files)));
}

export async function buildStoredFileRecord(
  file: File,
  selectedTags: Tag[]
): Promise<StoredFileRecord> {
  const parseResult = parseFile(file.name, await file.text());
  const createdAt = new Date().toISOString();
  const tags = serializeTags(normalizeTags(selectedTags));

  return {
    id: createId("file"),
    name: file.name,
    tags,
    createdAt,
    symbols: parseResult.groups.flatMap((group) =>
      group.symbols.map((symbol) => ({
        id: createId("symbol"),
        name: symbol.name,
        className: group.className,
        kind: symbol.kind,
        completed: false,
      }))
    ),
  };
}

