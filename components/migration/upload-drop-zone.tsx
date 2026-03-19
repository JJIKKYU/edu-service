"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { UploadIcon } from "lucide-react";
import { FileUploadModal } from "./file-upload-modal";
import type { Tag } from "@/lib/tags";

const UploadDropZoneContext = createContext<{ openModal: () => void }>({
  openModal: () => {},
});

export function useUploadDropZone() {
  return useContext(UploadDropZoneContext);
}

export function UploadDropZone({
  children,
  onUpload,
}: {
  children: React.ReactNode;
  onUpload: (files: File[], tags: Tag[]) => Promise<void> | void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    setDragCounter((c) => {
      const next = c + 1;
      if (next === 1) setIsDragging(true);
      return next;
    });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragCounter((c) => {
      const next = c - 1;
      if (next === 0) setIsDragging(false);
      return next;
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setDroppedFiles(files);
      setModalOpen(true);
    }
  }

  function handleOpenChange(open: boolean) {
    setModalOpen(open);
    if (!open) {
      setDroppedFiles([]);
    }
  }

  return (
    <UploadDropZoneContext.Provider value={{ openModal }}>
      <div
        className="relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
            <div className="flex flex-col items-center gap-2 text-primary">
              <UploadIcon className="h-10 w-10" />
              <p className="text-lg font-medium">
                파일을 여기에 놓아주세요
              </p>
            </div>
          </div>
        )}
        {children}
        <FileUploadModal
          open={modalOpen}
          onOpenChange={handleOpenChange}
          initialFiles={droppedFiles}
          onUpload={onUpload}
        />
      </div>
    </UploadDropZoneContext.Provider>
  );
}
