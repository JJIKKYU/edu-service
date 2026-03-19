import { describe, expect, it } from "vitest";
import {
  applyAutoCompleteMatches,
  applyAutoCompleteToFiles,
  buildStoredCandidateRecord,
  createEmptyBoardState,
  matchCandidatePaths,
  normalizeMigrationBoardState,
  normalizeStoredRelativePath,
  type MigrationBoardState,
  type StoredFileRecord,
} from "@/lib/migration-storage";

function makeStoredFile(overrides: Partial<StoredFileRecord> = {}): StoredFileRecord {
  return {
    id: overrides.id ?? "file-1",
    name: overrides.name ?? "HomeViewModel.swift",
    tags: overrides.tags ?? "",
    createdAt: overrides.createdAt ?? "2026-03-19T00:00:00.000Z",
    symbols: overrides.symbols ?? [
      {
        id: "symbol-1",
        name: "loadData",
        className: "HomeViewModel",
        kind: "function",
        completed: false,
      },
    ],
    relativePath: overrides.relativePath,
    sourceRepo: overrides.sourceRepo,
    baselineTracked: overrides.baselineTracked,
    autoCompletedAt: overrides.autoCompletedAt,
  };
}

describe("migration-storage automation helpers", () => {
  it("migrates legacy array storage into board state defaults", () => {
    const state = normalizeMigrationBoardState([
      makeStoredFile({
        relativePath: "./ios\\HomeViewModel.swift",
      }),
    ]);

    expect(state.repoPath).toBe("");
    expect(state.baselineCommit).toBe("");
    expect(state.lastSyncSummary).toBeNull();
    expect(state.files[0].relativePath).toBe("ios/HomeViewModel.swift");
    expect(state.files[0].sourceRepo).toBe("upload");
  });

  it("builds candidate records with external repo metadata", () => {
    const record = buildStoredCandidateRecord({
      filename: "NetworkManager.m",
      relativePath: "./Sources\\NetworkManager.m",
      content: `
        @interface NetworkManager
        - (void)fetchDeviceList {}
        @end
      `,
      selectedTags: ["CMP"],
      createdAt: "2026-03-19T10:00:00.000Z",
    });

    expect(record.relativePath).toBe("Sources/NetworkManager.m");
    expect(record.sourceRepo).toBe("external-ios");
    expect(record.baselineTracked).toBe(true);
    expect(record.createdAt).toBe("2026-03-19T10:00:00.000Z");
    expect(record.symbols).toHaveLength(1);
  });

  it("matches only tracked candidate paths and deduplicates normalized paths", () => {
    const files = [
      makeStoredFile({
        id: "tracked-a",
        relativePath: "./Sources\\HomeViewModel.swift",
        baselineTracked: true,
        sourceRepo: "external-ios",
      }),
      makeStoredFile({
        id: "tracked-b",
        relativePath: "Sources/HomeViewModel.swift",
        baselineTracked: true,
        sourceRepo: "external-ios",
      }),
      makeStoredFile({
        id: "upload-file",
        relativePath: "Sources/Other.swift",
        baselineTracked: false,
      }),
    ];

    const matches = matchCandidatePaths(files, [
      "Sources/HomeViewModel.swift",
      "./Sources\\HomeViewModel.swift",
      "Sources/Other.swift",
    ]);

    expect(matches).toEqual(["Sources/HomeViewModel.swift"]);
  });

  it("applies auto completion cumulatively to matched tracked files only", () => {
    const files = [
      makeStoredFile({
        id: "matched",
        relativePath: "Sources/HomeViewModel.swift",
        sourceRepo: "external-ios",
        baselineTracked: true,
        symbols: [
          {
            id: "symbol-1",
            name: "loadData",
            className: "HomeViewModel",
            kind: "function",
            completed: true,
          },
          {
            id: "symbol-2",
            name: "refresh",
            className: "HomeViewModel",
            kind: "function",
            completed: false,
          },
        ],
      }),
      makeStoredFile({
        id: "unmatched",
        relativePath: "Sources/DeviceRepository.swift",
        sourceRepo: "external-ios",
        baselineTracked: true,
      }),
      makeStoredFile({
        id: "not-tracked",
        relativePath: "Sources/UploadOnly.swift",
        sourceRepo: "upload",
        baselineTracked: false,
      }),
    ];

    const result = applyAutoCompleteToFiles(files, ["./Sources\\HomeViewModel.swift"], {
      changedPaths: ["Sources/HomeViewModel.swift", "Sources/Other.swift"],
      warnings: ["missing file", "missing file"],
      executedAt: "2026-03-19T12:00:00.000Z",
    });

    expect(result.executedAt).toBe("2026-03-19T12:00:00.000Z");
    expect(result.summary).toEqual({
      changedFiles: 2,
      matchedCandidates: 1,
      newlyCompletedSymbols: 1,
      warnings: ["missing file"],
    });
    expect(result.files[0].symbols.every((symbol) => symbol.completed)).toBe(true);
    expect(result.files[0].autoCompletedAt).toBe("2026-03-19T12:00:00.000Z");
    expect(result.files[1].autoCompletedAt).toBeUndefined();
    expect(result.files[2].symbols[0].completed).toBe(false);
  });

  it("applies auto completion to board state and stores sync summary", () => {
    const state: MigrationBoardState = {
      ...createEmptyBoardState(),
      repoPath: "/tmp/ios-repo",
      baselineCommit: "abc123",
      files: [
        makeStoredFile({
          relativePath: "Sources/HomeViewModel.swift",
          sourceRepo: "external-ios",
          baselineTracked: true,
        }),
      ],
    };

    const result = applyAutoCompleteMatches({
      state,
      matchedCandidatePaths: ["Sources/HomeViewModel.swift"],
      changedFiles: 3,
      warnings: ["deleted file"],
      completedAt: "2026-03-19T13:00:00.000Z",
    });

    expect(result.state.lastSyncAt).toBe("2026-03-19T13:00:00.000Z");
    expect(result.summary).toEqual({
      changedFiles: 3,
      matchedCandidates: 1,
      newlyCompletedSymbols: 1,
      warnings: ["deleted file"],
    });
    expect(result.state.lastSyncSummary).toEqual(result.summary);
    expect(result.state.files[0].symbols[0].completed).toBe(true);
  });

  it("normalizes relative paths consistently", () => {
    expect(normalizeStoredRelativePath("./Sources\\HomeViewModel.swift")).toBe(
      "Sources/HomeViewModel.swift"
    );
    expect(normalizeStoredRelativePath("/Sources/HomeViewModel.swift")).toBe(
      "Sources/HomeViewModel.swift"
    );
  });
});
