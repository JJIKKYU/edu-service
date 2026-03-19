import { FileCodeIcon } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-muted-foreground">
      <FileCodeIcon className="size-8" />
      <p className="text-sm">등록된 파일이 없습니다</p>
    </div>
  );
}
