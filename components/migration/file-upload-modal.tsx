"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { VALID_TAGS, serializeTags, type Tag } from "@/lib/tags";

interface FileUploadModalProps {
  initialFiles?: File[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FileUploadModal({
  initialFiles,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: FileUploadModalProps = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
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
    const tags = serializeTags(selectedTags);

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tags", tags);

      const res = await fetch("/api/files", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        try {
          const data = await res.json();
          toast.error(data.error || "업로드 실패");
        } catch {
          toast.error("업로드 실패");
        }
      }
    }

    router.refresh();
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
            <div className="flex gap-4">
              {VALID_TAGS.map((tag) => (
                <div key={tag} className="flex items-center gap-2">
                  <Checkbox
                    id={`tag-${tag}`}
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={(checked) =>
                      handleTagToggle(tag, checked === true)
                    }
                  />
                  <Label htmlFor={`tag-${tag}`}>{tag}</Label>
                </div>
              ))}
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
