"use client";

import { useEffect, useMemo, useState } from "react";
import { GitBranchIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { DashboardSummary } from "@/components/migration/dashboard-summary";
import { EmptyState } from "@/components/migration/empty-state";
import { FileCard } from "@/components/migration/file-card";
import { UploadButton } from "@/components/migration/upload-button";
import { UploadDropZone } from "@/components/migration/upload-drop-zone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { groupFiles } from "@/lib/group-files";
import {
  applyAutoCompleteMatches,
  buildStoredCandidateRecord,
  buildStoredFileRecord,
  ensureStoredFiles,
  loadBoardState,
  matchCandidatePaths,
  saveBoardState,
  type MigrationBoardState,
  type StoredFileRecord,
} from "@/lib/migration-storage";
import {
  filterGroupsByView,
  getViewLabel,
  type MigrationView,
} from "@/lib/migration-view";
import { type Tag } from "@/lib/tags";

function countSummary(groups: ReturnType<typeof groupFiles>) {
  const functionCount = groups.reduce(
    (sum, group) =>
      sum + group.symbols.filter((symbol) => symbol.kind === "function").length,
    0
  );
  const variableCount = groups.reduce(
    (sum, group) =>
      sum + group.symbols.filter((symbol) => symbol.kind === "variable").length,
    0
  );
  const completedCount = groups.reduce(
    (sum, group) => sum + group.symbols.filter((symbol) => symbol.completed).length,
    0
  );

  return {
    fileCount: groups.length,
    functionCount,
    variableCount,
    completedCount,
  };
}

function getEmptyMessage(view: MigrationView): string {
  if (view === "all") return "등록된 파일이 없습니다";
  return `${getViewLabel(view)} 태그 파일이 없습니다`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isGitAutomationVisible() {
  return process.env.NODE_ENV === "development";
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "요청에 실패했습니다");
  }

  if (!payload) {
    throw new Error("응답을 읽지 못했습니다");
  }

  return payload;
}

export function MigrationBoard({ view }: { view: MigrationView }) {
  const [boardState, setBoardState] = useState<MigrationBoardState | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [candidatePath, setCandidatePath] = useState("");
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingHead, setIsLoadingHead] = useState(false);

  useEffect(() => {
    ensureStoredFiles();
    setBoardState(loadBoardState());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || !boardState) return;
    saveBoardState(boardState);
  }, [boardState, isHydrated]);

  const files = boardState?.files ?? [];
  const groups = useMemo(() => groupFiles(files), [files]);
  const filteredGroups = filterGroupsByView(groups, view);
  const summary = countSummary(filteredGroups);
  const gitAutomationVisible = isGitAutomationVisible();

  function updateFiles(updater: (currentFiles: StoredFileRecord[]) => StoredFileRecord[]) {
    setBoardState((currentState) => {
      if (!currentState) return currentState;
      return {
        ...currentState,
        files: updater(currentState.files),
      };
    });
  }

  function updateSettings(updates: Partial<Pick<MigrationBoardState, "repoPath" | "baselineCommit">>) {
    setBoardState((currentState) => {
      if (!currentState) return currentState;
      return {
        ...currentState,
        ...updates,
      };
    });
  }

  async function handleUpload(uploadedFiles: File[], selectedTags: Tag[]) {
    const existingNames = new Set(files.map((file) => file.name));
    const nextFiles = [...files];

    for (const file of uploadedFiles) {
      if (existingNames.has(file.name)) {
        toast.error("이미 등록된 파일입니다");
        continue;
      }

      try {
        const storedFile = await buildStoredFileRecord(file, selectedTags);
        nextFiles.unshift(storedFile);
        existingNames.add(file.name);
      } catch (error) {
        toast.error(getErrorMessage(error, "업로드 실패"));
      }
    }

    updateFiles(() => nextFiles);
  }

  function handleToggleSymbol(symbolId: string) {
    updateFiles((currentFiles) =>
      currentFiles.map((file) => ({
        ...file,
        symbols: file.symbols.map((symbol) =>
          symbol.id === symbolId
            ? { ...symbol, completed: !symbol.completed }
            : symbol
        ),
      }))
    );
  }

  function handleUpdateTags(fileIds: string[], tags: Tag[]) {
    const serializedTags = [...tags].sort().join(",");

    updateFiles((currentFiles) =>
      currentFiles.map((file) =>
        fileIds.includes(file.id)
          ? { ...file, tags: serializedTags }
          : file
      )
    );
  }

  function handleDeleteFiles(fileIds: string[]) {
    updateFiles((currentFiles) =>
      currentFiles.filter((file) => !fileIds.includes(file.id))
    );
  }

  async function handleLoadHeadCommit() {
    if (!boardState?.repoPath) {
      toast.error("iOS repo 경로를 먼저 입력해주세요");
      return;
    }

    setIsLoadingHead(true);

    try {
      const payload = await readJsonOrThrow<{ headCommit: string }>(
        await fetch("/api/git/head", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoPath: boardState.repoPath }),
        })
      );

      updateSettings({ baselineCommit: payload.headCommit });
    } catch (error) {
      toast.error(getErrorMessage(error, "HEAD 커밋 조회 실패"));
    } finally {
      setIsLoadingHead(false);
    }
  }

  async function handleAddCandidate() {
    if (!boardState?.repoPath || !boardState.baselineCommit || !candidatePath.trim()) {
      toast.error("repo 경로, 기준 커밋, 후보 파일 경로를 입력해주세요");
      return;
    }

    setIsAddingCandidate(true);

    try {
      const response = await fetch("/api/git/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath: boardState.repoPath,
          baselineCommit: boardState.baselineCommit,
          candidatePath: candidatePath.trim(),
        }),
      });

      const payload = await readJsonOrThrow<StoredFileRecord & {
        relativePath?: string;
        content?: string;
      }>(response);

      const candidateFile =
        Array.isArray(payload.symbols)
          ? {
              ...payload,
              relativePath: payload.relativePath ?? candidatePath.trim(),
              sourceRepo: "external-ios" as const,
              baselineTracked: true,
            }
          : buildStoredCandidateRecord({
              filename: payload.name,
              relativePath: payload.relativePath ?? candidatePath.trim(),
              content: payload.content ?? "",
            });

      const normalizedPath = candidateFile.relativePath ?? candidatePath.trim();

      updateFiles((currentFiles) => {
        const remainingFiles = currentFiles.filter(
          (file) => (file.relativePath ?? file.name) !== normalizedPath
        );
        return [candidateFile, ...remainingFiles];
      });
      setCandidatePath("");
    } catch (error) {
      toast.error(getErrorMessage(error, "후보 파일 추가 실패"));
    } finally {
      setIsAddingCandidate(false);
    }
  }

  async function handleSync() {
    if (!boardState?.repoPath || !boardState.baselineCommit) {
      toast.error("repo 경로와 기준 커밋을 먼저 입력해주세요");
      return;
    }

    setIsSyncing(true);

    try {
      const candidatePaths = files.map((file) => file.relativePath ?? file.name);
      const response = await fetch("/api/git/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath: boardState.repoPath,
          baselineCommit: boardState.baselineCommit,
          candidatePaths,
        }),
      });

      const payload = await readJsonOrThrow<{
        changedPaths?: string[];
        matchedCandidatePaths?: string[];
        warnings?: string[];
        summary?: {
          changedFiles: number;
          matchedCandidates: number;
          newlyCompletedSymbols: number;
          warnings: string[];
        };
        changedFilesCount?: number;
        matchedCandidatesCount?: number;
        newlyCompletedSymbolsCount?: number;
        completedSymbolIds?: string[];
      }>(response);

      if (payload.completedSymbolIds?.length) {
        const completedIds = new Set(payload.completedSymbolIds);
        const nextFiles = boardState.files.map((file) => ({
          ...file,
          symbols: file.symbols.map((symbol) =>
            completedIds.has(symbol.id)
              ? { ...symbol, completed: true }
              : symbol
          ),
        }));

        setBoardState({
          ...boardState,
          files: nextFiles,
          lastSyncAt: new Date().toISOString(),
          lastSyncSummary: {
            changedFiles: payload.changedFilesCount ?? 0,
            matchedCandidates: payload.matchedCandidatesCount ?? 0,
            newlyCompletedSymbols: payload.newlyCompletedSymbolsCount ?? 0,
            warnings: payload.summary?.warnings ?? payload.warnings ?? [],
          },
        });

        return;
      }

      const matchedCandidatePaths =
        payload.matchedCandidatePaths ??
        matchCandidatePaths(boardState.files, payload.changedPaths ?? []);
      const result = applyAutoCompleteMatches({
        state: boardState,
        matchedCandidatePaths,
        changedFiles:
          payload.summary?.changedFiles ??
          payload.changedFilesCount ??
          payload.changedPaths?.length ??
          0,
        warnings: payload.summary?.warnings ?? payload.warnings ?? [],
        completedAt: new Date().toISOString(),
      }).state;

      setBoardState(result);
    } catch (error) {
      toast.error(getErrorMessage(error, "Git diff 갱신 실패"));
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <UploadDropZone onUpload={handleUpload}>
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Migration Progress Board</h1>
          <UploadButton />
        </div>

        <DashboardSummary
          view={view}
          fileCount={summary.fileCount}
          functionCount={summary.functionCount}
          variableCount={summary.variableCount}
          completedCount={summary.completedCount}
        />

        {gitAutomationVisible && boardState ? (
          <Card className="mt-6">
            <CardHeader className="gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <GitBranchIcon className="size-4" />
                로컬 Git 자동화
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <label className="space-y-1 text-sm">
                  <span>iOS repo 경로</span>
                  <Input
                    aria-label="iOS repo 경로"
                    value={boardState.repoPath}
                    onChange={(event) => updateSettings({ repoPath: event.target.value })}
                    placeholder="/Users/you/project/ios"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>기준 커밋</span>
                  <Input
                    aria-label="기준 커밋"
                    value={boardState.baselineCommit}
                    onChange={(event) =>
                      updateSettings({ baselineCommit: event.target.value })
                    }
                    placeholder="abc1234"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void handleLoadHeadCommit();
                    }}
                    disabled={isLoadingHead}
                  >
                    <RefreshCwIcon data-icon="inline-start" className="size-4" />
                    HEAD 저장
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <label className="space-y-1 text-sm">
                  <span>후보 파일 경로</span>
                  <Input
                    aria-label="후보 파일 경로"
                    value={candidatePath}
                    onChange={(event) => setCandidatePath(event.target.value)}
                    placeholder="Sources/HomeViewModel.swift"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void handleAddCandidate();
                    }}
                    disabled={isAddingCandidate}
                  >
                    후보군 추가
                  </Button>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={() => {
                      void handleSync();
                    }}
                    disabled={isSyncing}
                  >
                    Git diff로 갱신
                  </Button>
                </div>
              </div>

              {boardState.lastSyncSummary ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">자동 갱신 결과</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-muted-foreground">
                    <span>변경 파일 {boardState.lastSyncSummary.changedFiles}개</span>
                    <span>후보군 매칭 {boardState.lastSyncSummary.matchedCandidates}개</span>
                    <span>새 완료 항목 {boardState.lastSyncSummary.newlyCompletedSymbols}개</span>
                  </div>
                  {boardState.lastSyncAt ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      마지막 실행: {boardState.lastSyncAt}
                    </p>
                  ) : null}
                  {boardState.lastSyncSummary.warnings.length > 0 ? (
                    <p className="mt-2 text-xs text-amber-700">
                      {boardState.lastSyncSummary.warnings.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {filteredGroups.length === 0 ? (
            <EmptyState message={getEmptyMessage(view)} />
          ) : (
            filteredGroups.map((group) => (
              <FileCard
                key={group.key}
                displayName={group.displayName}
                files={group.files}
                symbols={group.symbols}
                tags={group.tags}
                onDeleteFiles={handleDeleteFiles}
                onToggleSymbol={handleToggleSymbol}
                onUpdateTags={handleUpdateTags}
              />
            ))
          )}
        </div>
      </div>
    </UploadDropZone>
  );
}
