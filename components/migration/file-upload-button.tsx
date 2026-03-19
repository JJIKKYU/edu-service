"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FileUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/files", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error);
    } else {
      router.refresh();
    }

    // Reset input so same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".swift,.m,.h"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button onClick={() => inputRef.current?.click()}>
        <UploadIcon data-icon="inline-start" />
        파일 업로드
      </Button>
    </>
  );
}
