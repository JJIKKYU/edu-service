import { parseFile } from "@/lib/parsers";
import { normalizeTags, serializeTags, type Tag } from "@/lib/tags";
import type { SymbolItem } from "@/lib/symbols";

export const MIGRATION_STORAGE_KEY = "migration-board/files";
export const DEV_MIGRATION_SAMPLE_ENABLED = true;
export const MIGRATION_BOARD_STATE_VERSION = 2;

export type StoredFileSource = "upload" | "external-ios";

export interface SyncSummary {
  changedFiles: number;
  matchedCandidates: number;
  newlyCompletedSymbols: number;
  warnings: string[];
}

export interface StoredFileRecord {
  id: string;
  name: string;
  tags: string;
  createdAt: string;
  symbols: SymbolItem[];
  relativePath?: string;
  sourceRepo?: StoredFileSource;
  baselineTracked?: boolean;
  autoCompletedAt?: string;
}

export interface MigrationBoardState {
  version: number;
  repoPath: string;
  baselineCommit: string;
  lastSyncAt?: string;
  lastSyncSummary?: SyncSummary | null;
  files: StoredFileRecord[];
}

export interface BuildStoredFileOptions {
  createdAt?: string;
  completedSymbolNames?: string[];
  relativePath?: string;
  sourceRepo?: StoredFileSource;
  baselineTracked?: boolean;
  autoCompletedAt?: string;
}

export interface AutoCompleteResult {
  files: StoredFileRecord[];
  summary: SyncSummary;
  executedAt: string;
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
  return DEV_MIGRATION_SAMPLE_ENABLED && process.env.NODE_ENV !== "test";
}

export function normalizeStoredRelativePath(path: string) {
  return path
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

export function createEmptyBoardState(): MigrationBoardState {
  return {
    version: MIGRATION_BOARD_STATE_VERSION,
    repoPath: "",
    baselineCommit: "",
    lastSyncSummary: null,
    files: [],
  };
}

export function normalizeStoredFileRecord(file: unknown): StoredFileRecord | null {
  if (!file || typeof file !== "object") return null;

  const candidate = file as Partial<StoredFileRecord>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.tags !== "string" ||
    typeof candidate.createdAt !== "string" ||
    !Array.isArray(candidate.symbols)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    tags: candidate.tags,
    createdAt: candidate.createdAt,
    symbols: candidate.symbols as SymbolItem[],
    relativePath:
      typeof candidate.relativePath === "string"
        ? normalizeStoredRelativePath(candidate.relativePath)
        : undefined,
    sourceRepo: candidate.sourceRepo === "external-ios" ? candidate.sourceRepo : "upload",
    baselineTracked: candidate.baselineTracked === true,
    autoCompletedAt:
      typeof candidate.autoCompletedAt === "string"
        ? candidate.autoCompletedAt
        : undefined,
  };
}

export function normalizeSyncSummary(summary: unknown): SyncSummary | null {
  if (!summary || typeof summary !== "object") {
    return null;
  }

  const candidate = summary as Partial<SyncSummary>;
  if (
    typeof candidate.changedFiles !== "number" ||
    typeof candidate.matchedCandidates !== "number" ||
    typeof candidate.newlyCompletedSymbols !== "number" ||
    !Array.isArray(candidate.warnings)
  ) {
    return null;
  }

  return {
    changedFiles: candidate.changedFiles,
    matchedCandidates: candidate.matchedCandidates,
    newlyCompletedSymbols: candidate.newlyCompletedSymbols,
    warnings: [...new Set(candidate.warnings.filter((warning): warning is string => typeof warning === "string"))],
  };
}

export function normalizeMigrationBoardState(raw: unknown): MigrationBoardState {
  const emptyState = createEmptyBoardState();

  if (Array.isArray(raw)) {
    return {
      ...emptyState,
      files: sortFiles(
        raw
          .map((file) => normalizeStoredFileRecord(file))
          .filter((file): file is StoredFileRecord => file !== null)
      ),
    };
  }

  if (!raw || typeof raw !== "object") {
    return emptyState;
  }

  const candidate = raw as Partial<MigrationBoardState>;

  return {
    version:
      typeof candidate.version === "number"
        ? candidate.version
        : MIGRATION_BOARD_STATE_VERSION,
    repoPath: typeof candidate.repoPath === "string" ? candidate.repoPath : "",
    baselineCommit:
      typeof candidate.baselineCommit === "string" ? candidate.baselineCommit : "",
    lastSyncAt: typeof candidate.lastSyncAt === "string" ? candidate.lastSyncAt : undefined,
    lastSyncSummary: normalizeSyncSummary(candidate.lastSyncSummary),
    files: sortFiles(
      (Array.isArray(candidate.files) ? candidate.files : [])
        .map((file) => normalizeStoredFileRecord(file))
        .filter((file): file is StoredFileRecord => file !== null)
    ),
  };
}

export function parseBoardState(raw: string | null): MigrationBoardState {
  if (!raw) return createEmptyBoardState();

  try {
    return normalizeMigrationBoardState(JSON.parse(raw));
  } catch {
    return createEmptyBoardState();
  }
}

export function buildStoredFileRecordFromSource(
  filename: string,
  source: string,
  selectedTags: Tag[],
  options: BuildStoredFileOptions = {}
): StoredFileRecord {
  const parseResult = parseFile(filename, source);
  const completedNames = new Set(options.completedSymbolNames ?? []);

  return {
    id: createId("file"),
    name: filename,
    tags: serializeTags(normalizeTags(selectedTags)),
    createdAt: options.createdAt ?? new Date().toISOString(),
    relativePath: options.relativePath
      ? normalizeStoredRelativePath(options.relativePath)
      : undefined,
    sourceRepo: options.sourceRepo ?? "upload",
    baselineTracked: options.baselineTracked ?? false,
    autoCompletedAt: options.autoCompletedAt,
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

export function loadBoardState(): MigrationBoardState {
  if (!canUseStorage()) return createEmptyBoardState();
  return parseBoardState(window.localStorage.getItem(MIGRATION_STORAGE_KEY));
}

export function saveBoardState(state: MigrationBoardState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    MIGRATION_STORAGE_KEY,
    JSON.stringify({
      ...normalizeMigrationBoardState(state),
      version: MIGRATION_BOARD_STATE_VERSION,
      lastSyncSummary: normalizeSyncSummary(state.lastSyncSummary),
      files: sortFiles(
        state.files
          .map((file) => normalizeStoredFileRecord(file))
          .filter((file): file is StoredFileRecord => file !== null)
      ),
    })
  );
}

export function updateBoardState(
  patch: Partial<Omit<MigrationBoardState, "version" | "files">> & {
    files?: StoredFileRecord[];
  }
) {
  const currentState = loadBoardState();
  const nextState: MigrationBoardState = {
    ...currentState,
    ...patch,
    version: MIGRATION_BOARD_STATE_VERSION,
    files: patch.files ? sortFiles(patch.files) : currentState.files,
  };
  saveBoardState(nextState);
  return nextState;
}

export function updateBoardSettings(
  updates: Partial<Pick<MigrationBoardState, "repoPath" | "baselineCommit">>
) {
  return updateBoardState(updates);
}

export function ensureStoredFiles(): StoredFileRecord[] {
  if (!canUseStorage()) return [];

  const existingState = loadBoardState();
  if (existingState.files.length > 0 || !shouldSeedDevSamples()) {
    return existingState.files;
  }

  const sampleFiles = buildDevSampleFiles();
  saveBoardState({
    ...existingState,
    files: sampleFiles,
  });
  return sampleFiles;
}

export function loadStoredFiles(): StoredFileRecord[] {
  return loadBoardState().files;
}

export function saveStoredFiles(files: StoredFileRecord[]) {
  updateBoardState({ files });
}

export function buildStoredCandidateRecord(args: {
  filename: string;
  relativePath: string;
  content: string;
  selectedTags?: Tag[];
  createdAt?: string;
}) {
  return buildStoredFileRecordFromSource(
    args.filename,
    args.content,
    args.selectedTags ?? [],
    {
      createdAt: args.createdAt,
      relativePath: args.relativePath,
      sourceRepo: "external-ios",
      baselineTracked: true,
    }
  );
}

export function matchCandidatePaths(
  files: StoredFileRecord[],
  changedPaths: string[]
) {
  const changedPathSet = new Set(changedPaths.map(normalizeStoredRelativePath));

  return [
    ...new Set(
      files
        .filter((file) => file.baselineTracked && typeof file.relativePath === "string")
        .filter((file) => changedPathSet.has(normalizeStoredRelativePath(file.relativePath!)))
        .map((file) => normalizeStoredRelativePath(file.relativePath!))
    ),
  ];
}

export function applyAutoCompleteToFiles(
  files: StoredFileRecord[],
  matchedCandidatePaths: string[],
  options?: {
    changedPaths?: string[];
    warnings?: string[];
    executedAt?: string;
  }
) {
  const executedAt = options?.executedAt ?? new Date().toISOString();
  const matchedPathSet = new Set(matchedCandidatePaths.map(normalizeStoredRelativePath));
  let newlyCompletedSymbols = 0;

  const nextFiles = files.map((file) => {
    const relativePath = file.relativePath
      ? normalizeStoredRelativePath(file.relativePath)
      : undefined;
    const isMatched =
      file.baselineTracked === true &&
      typeof relativePath === "string" &&
      matchedPathSet.has(relativePath);

    if (!isMatched) return file;

    const nextSymbols = file.symbols.map((symbol) => {
      if (symbol.completed) return symbol;
      newlyCompletedSymbols += 1;
      return { ...symbol, completed: true };
    });

    return {
      ...file,
      autoCompletedAt: executedAt,
      symbols: nextSymbols,
    };
  });

  const summary: SyncSummary = {
    changedFiles: options?.changedPaths?.length ?? matchedPathSet.size,
    matchedCandidates: matchedPathSet.size,
    newlyCompletedSymbols,
    warnings: [...new Set(options?.warnings ?? [])],
  };

  return {
    files: nextFiles,
    summary,
    executedAt,
  };
}

export function applyAutoCompleteMatches(args: {
  state: MigrationBoardState;
  matchedCandidatePaths: string[];
  changedFiles: number;
  warnings?: string[];
  completedAt?: string;
}) {
  const result = applyAutoCompleteToFiles(args.state.files, args.matchedCandidatePaths, {
    warnings: args.warnings,
    executedAt: args.completedAt,
  });
  const summary: SyncSummary = {
    ...result.summary,
    changedFiles: args.changedFiles,
  };

  return {
    state: {
      ...args.state,
      files: result.files,
      lastSyncAt: result.executedAt,
      lastSyncSummary: summary,
    },
    summary,
  };
}

export async function buildStoredFileRecord(
  file: File,
  selectedTags: Tag[],
  options: BuildStoredFileOptions = {}
): Promise<StoredFileRecord> {
  return buildStoredFileRecordFromSource(
    file.name,
    await file.text(),
    selectedTags,
    options
  );
}
