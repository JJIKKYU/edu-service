"use client";

import { parseFile } from "@/lib/parsers";
import { normalizeTags, serializeTags, type Tag } from "@/lib/tags";
import type { SymbolItem } from "@/lib/symbols";

export const MIGRATION_STORAGE_KEY = "migration-board/files";
export const DEV_MIGRATION_SAMPLE_ENABLED = true;

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

function shouldSeedDevSamples() {
  return DEV_MIGRATION_SAMPLE_ENABLED && process.env.NODE_ENV === "development";
}

function buildStoredFileRecordFromSource(
  filename: string,
  source: string,
  selectedTags: Tag[],
  options?: {
    createdAt?: string;
    completedSymbolNames?: string[];
  }
): StoredFileRecord {
  const parseResult = parseFile(filename, source);
  const completedNames = new Set(options?.completedSymbolNames ?? []);

  return {
    id: createId("file"),
    name: filename,
    tags: serializeTags(normalizeTags(selectedTags)),
    createdAt: options?.createdAt ?? new Date().toISOString(),
    symbols: parseResult.groups.flatMap((group) =>
      group.symbols.map((symbol) => ({
        id: createId("symbol"),
        name: symbol.name,
        className: group.className,
        kind: symbol.kind,
        completed: completedNames.has(`${group.className}:${symbol.name}`),
      }))
    ),
  };
}

function buildDevSampleFiles(): StoredFileRecord[] {
  return sortFiles([
    buildStoredFileRecordFromSource(
      "HomeViewModel.swift",
      `
      import Foundation

      final class HomeViewModel {
        let title = "ThinQ Home"
        var selectedTab = 0

        func loadDashboard() {}
        func refreshDevices() {}
      }

      func makeGreetingMessage() -> String { "Welcome" }
      `,
      ["TCK"],
      {
        createdAt: "2026-03-19T07:00:00.000Z",
        completedSymbolNames: ["HomeViewModel:loadDashboard"],
      }
    ),
    buildStoredFileRecordFromSource(
      "DeviceRepository.swift",
      `
      protocol DeviceRepository {
        func fetchDevices()
        func fetchScenes()
      }
      `,
      ["CMP"],
      {
        createdAt: "2026-03-19T06:00:00.000Z",
      }
    ),
    buildStoredFileRecordFromSource(
      "NetworkManager.h",
      `
      @interface NetworkManager
      @property (nonatomic, strong) NSString *baseURL;
      - (void)fetchDeviceList;
      - (void)cancelAllRequests;
      @end
      `,
      ["CMP"],
      {
        createdAt: "2026-03-19T05:00:00.000Z",
      }
    ),
    buildStoredFileRecordFromSource(
      "NetworkManager.m",
      `
      @interface NetworkManager
      - (void)fetchDeviceList {}
      - (void)cancelAllRequests {}
      @end
      `,
      ["CMP"],
      {
        createdAt: "2026-03-19T04:59:00.000Z",
        completedSymbolNames: ["NetworkManager:fetchDeviceList"],
      }
    ),
  ]);
}

export function ensureStoredFiles(): StoredFileRecord[] {
  if (!canUseStorage()) return [];

  const existingFiles = loadStoredFiles();
  if (existingFiles.length > 0 || !shouldSeedDevSamples()) {
    return existingFiles;
  }

  const sampleFiles = buildDevSampleFiles();
  saveStoredFiles(sampleFiles);
  return sampleFiles;
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
  return buildStoredFileRecordFromSource(
    file.name,
    await file.text(),
    selectedTags
  );
}
