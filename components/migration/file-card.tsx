"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileCodeIcon,
  XIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { VALID_TAGS, type Tag } from "@/lib/tags";
import { countSymbolsByKind, type SymbolItem } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { FunctionList } from "./function-list";

interface FileCardProps {
  displayName: string;
  files: Array<{ id: string; name: string }>;
  symbols: SymbolItem[];
  tags: string[];
}

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex === -1 ? "" : filename.slice(dotIndex);
}

export function FileCard({ displayName, files, symbols, tags }: FileCardProps) {
  const router = useRouter();
  const [activeTags, setActiveTags] = useState<string[]>(tags);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setActiveTags(tags);
  }, [tags]);

  const { functionCount, variableCount, completedCount } =
    countSymbolsByKind(symbols);
  const totalSymbols = functionCount + variableCount;
  const progressRate =
    totalSymbols === 0
      ? 0
      : Math.round((completedCount / totalSymbols) * 100);

  // Get unique class names for subtitle
  const classNames = [...new Set(symbols.map((symbol) => symbol.className))];
  const subtitle = `함수 ${functionCount}개 · 변수 ${variableCount}개 · ${classNames.join(", ")}`;

  const extensions = [...new Set(files.map((f) => getExtension(f.name)))];
  const fileIds = files.map((file) => file.id);

  async function handleTagToggle(tag: Tag) {
    if (isSavingTags) return;

    const nextTags = activeTags.includes(tag)
      ? activeTags.filter((currentTag) => currentTag !== tag)
      : [...activeTags, tag];

    setIsSavingTags(true);

    try {
      const response = await fetch("/api/files/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileIds,
          tags: nextTags,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "태그 수정 실패");
      }

      setActiveTags(nextTags.sort());
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "태그 수정 실패"
      );
    } finally {
      setIsSavingTags(false);
    }
  }

  async function handleDelete() {
    if (isDeleting) return;

    setIsDeleting(true);

    try {
      const response = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "파일 삭제 실패");
      }

      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "파일 삭제 실패"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Collapsible className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "mb-2 flex flex-wrap items-center gap-1.5",
                isSavingTags && "opacity-60"
              )}
            >
              {VALID_TAGS.map((tag) => {
                const selected = activeTags.includes(tag);

                return (
                  <Badge
                    key={tag}
                    asChild
                    variant={selected ? "default" : "outline"}
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${displayName} ${tag} 태그 ${selected ? "해제" : "적용"}`}
                      disabled={isSavingTags || isDeleting}
                      className="cursor-pointer disabled:cursor-wait"
                      onClick={() => {
                        void handleTagToggle(tag);
                      }}
                    >
                      {tag}
                    </button>
                  </Badge>
                );
              })}
            </div>
            <CollapsibleTrigger className="flex w-full min-w-0 cursor-pointer items-center gap-3 text-left">
              <FileCodeIcon className="size-[18px] shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-bold">{displayName}</p>
                  {extensions.map((ext) => (
                    <Badge key={ext} variant="secondary">
                      {ext}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">{subtitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex w-[120px] items-center gap-2">
                  <Progress value={progressRate} className="flex-1" />
                  <span className="text-muted-foreground text-xs">
                    {progressRate}%
                  </span>
                </div>
              </div>
            </CollapsibleTrigger>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${displayName} 삭제`}
                disabled={isDeleting}
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <XIcon className="size-4 text-muted-foreground" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>카드를 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  {files.length > 1
                    ? `${displayName} 그룹에 포함된 파일 ${files.length}개와 심볼이 함께 삭제됩니다.`
                    : `${displayName} 파일과 연결된 심볼이 함께 삭제됩니다.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={() => {
                    void handleDelete();
                  }}
                >
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <CollapsibleContent>
        <div className="border-t">
          <FunctionList symbols={symbols} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
