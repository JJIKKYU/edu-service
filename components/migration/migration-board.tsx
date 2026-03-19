"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { groupFiles } from "@/lib/group-files";
import {
  buildStoredFileRecord,
  ensureStoredFiles,
  saveStoredFiles,
  type StoredFileRecord,
} from "@/lib/migration-storage";
import {
  filterGroupsByView,
  getViewLabel,
  type MigrationView,
} from "@/lib/migration-view";
import { DashboardSummary } from "@/components/migration/dashboard-summary";
import { FileCard } from "@/components/migration/file-card";
import { UploadDropZone } from "@/components/migration/upload-drop-zone";
import { UploadButton } from "@/components/migration/upload-button";
import { EmptyState } from "@/components/migration/empty-state";
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

export function MigrationBoard({ view }: { view: MigrationView }) {
  const [files, setFiles] = useState<StoredFileRecord[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setFiles(ensureStoredFiles());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    saveStoredFiles(files);
  }, [files, isHydrated]);

  const groups = groupFiles(files);
  const filteredGroups = filterGroupsByView(groups, view);
  const summary = countSummary(filteredGroups);

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
        toast.error(
          error instanceof Error ? error.message : "업로드 실패"
        );
      }
    }

    setFiles(nextFiles);
  }

  function handleToggleSymbol(symbolId: string) {
    setFiles((currentFiles) =>
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

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        fileIds.includes(file.id)
          ? { ...file, tags: serializedTags }
          : file
      )
    );
  }

  function handleDeleteFiles(fileIds: string[]) {
    setFiles((currentFiles) =>
      currentFiles.filter((file) => !fileIds.includes(file.id))
    );
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
