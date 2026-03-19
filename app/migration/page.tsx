export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { groupFiles } from "@/lib/group-files";
import { DashboardSummary } from "@/components/migration/dashboard-summary";
import { FileCard } from "@/components/migration/file-card";
import { UploadDropZone } from "@/components/migration/upload-drop-zone";
import { UploadButton } from "@/components/migration/upload-button";
import { EmptyState } from "@/components/migration/empty-state";
import {
  filterGroupsByView,
  getViewLabel,
  parseMigrationView,
  type MigrationView,
} from "@/lib/migration-view";

interface MigrationPageProps {
  searchParams?: Promise<{ view?: string }>;
}

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

export default async function MigrationPage({
  searchParams,
}: MigrationPageProps = {}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = parseMigrationView(resolvedSearchParams?.view);
  const files = await prisma.file.findMany({
    include: { symbols: true },
    orderBy: { createdAt: "desc" },
  });

  const groups = groupFiles(files);
  const filteredGroups = filterGroupsByView(groups, view);
  const summary = countSummary(filteredGroups);

  return (
    <UploadDropZone>
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
              />
            ))
          )}
        </div>
      </div>
    </UploadDropZone>
  );
}
