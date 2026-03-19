import { FileCodeIcon } from "lucide-react";

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({
  message = "등록된 파일이 없습니다",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-muted-foreground">
      <FileCodeIcon className="size-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
