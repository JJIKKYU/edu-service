export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { DashboardSummary } from "@/components/migration/dashboard-summary";
import { FileCard } from "@/components/migration/file-card";
import { FileUploadButton } from "@/components/migration/file-upload-button";
import { EmptyState } from "@/components/migration/empty-state";

export default async function MigrationPage() {
  const files = await prisma.file.findMany({
    include: { functions: true },
    orderBy: { createdAt: "desc" },
  });

  const totalFunctions = files.reduce((sum, f) => sum + f.functions.length, 0);
  const completedFunctions = files.reduce(
    (sum, f) => sum + f.functions.filter((fn) => fn.completed).length,
    0
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-base font-bold">Migration Progress Board</h1>
        <FileUploadButton />
      </div>

      <DashboardSummary
        fileCount={files.length}
        functionCount={totalFunctions}
        completedCount={completedFunctions}
      />

      <div className="mt-6 flex flex-col gap-3">
        {files.length === 0 ? (
          <EmptyState />
        ) : (
          files.map((file) => (
            <FileCard
              key={file.id}
              name={file.name}
              functions={file.functions}
            />
          ))
        )}
      </div>
    </div>
  );
}
