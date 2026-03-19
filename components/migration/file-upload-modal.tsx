"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { VALID_TAGS, type Tag } from "@/lib/tags";
import { cn } from "@/lib/utils";

interface FileUploadModalProps {
  initialFiles?: File[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUpload?: (files: File[], tags: Tag[]) => Promise<void> | void;
}

export function FileUploadModal({
  initialFiles,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onUpload,
}: FileUploadModalProps = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (v: boolean) => controlledOnOpenChange?.(v)
    : setInternalOpen;

  const [prevInitialFiles, setPrevInitialFiles] = useState(initialFiles);
  if (initialFiles !== prevInitialFiles) {
    setPrevInitialFiles(initialFiles);
    if (initialFiles && initialFiles.length > 0) {
      setSelectedFiles(initialFiles);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setSelectedFiles(Array.from(fileList));
  }

  function handleTagToggle(tag: Tag, checked: boolean) {
    setSelectedTags((prev) =>
      checked ? [...prev, tag] : prev.filter((t) => t !== tag)
    );
  }

  async function handleConfirm() {
    try {
      await onUpload?.(selectedFiles, selectedTags);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "업로드 실패");
      return;
    }

    setOpen(false);
    setSelectedFiles([]);
    setSelectedTags([]);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSelectedFiles([]);
      setSelectedTags([]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button>
            <UploadIcon data-icon="inline-start" />
            파일 업로드
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>파일 업로드</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              파일 선택
            </Button>
            {selectedFiles.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedFiles.map((f) => f.name).join(", ")}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">태그</p>
            <div className="flex flex-wrap gap-2">
              {VALID_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag);

                return (
                  <div key={tag}>
                    <input
                      id={`tag-${tag}`}
                      type="checkbox"
                      className="sr-only"
                      checked={selected}
                      onChange={(event) =>
                        handleTagToggle(tag, event.target.checked)
                      }
                    />
                    <Badge asChild variant={selected ? "default" : "outline"}>
                      <Label
                        htmlFor={`tag-${tag}`}
                        className={cn(
                          "cursor-pointer px-3 py-1.5 text-sm transition-colors",
                          selected && "shadow-sm"
                        )}
                      >
                        {tag}
                      </Label>
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button
            disabled={selectedFiles.length === 0}
            onClick={handleConfirm}
          >
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
