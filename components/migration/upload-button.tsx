"use client";

import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadDropZone } from "./upload-drop-zone";

export function UploadButton() {
  const { openModal } = useUploadDropZone();
  return (
    <Button onClick={openModal}>
      <UploadIcon data-icon="inline-start" />
      파일 업로드
    </Button>
  );
}
