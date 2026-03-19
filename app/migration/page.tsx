export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { groupFiles } from "@/lib/group-files";
import { DashboardSummary } from "@/components/migration/dashboard-summary";
import { FileCard } from "@/components/migration/file-card";
import { FileUploadModal } from "@/components/migration/file-upload-modal";
import { EmptyState } from "@/components/migration/empty-state";

export default async function MigrationPage() {
  const files = await prisma.file.findMany({
    include: { functions: true },
    orderBy: { createdAt: "desc" },
  });

  const groups = groupFiles(files);

  const totalFunctions = groups.reduce((sum, g) => sum + g.functions.length, 0);
  const completedFunctions = groups.reduce(
    (sum, g) => sum + g.functions.filter((fn) => fn.completed).length,
    0
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-base font-bold">Migration Progress Board</h1>
        <FileUploadModal />
      </div>

      <DashboardSummary
        fileCount={groups.length}
        functionCount={totalFunctions}
        completedCount={completedFunctions}
      />

      <div className="mt-6 flex flex-col gap-3">
        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          groups.map((group) => (
            <FileCard
              key={group.key}
              displayName={group.displayName}
              files={group.files}
              functions={group.functions}
              tags={group.tags}
            />
          ))
        )}
      </div>
    </div>
  );
}
