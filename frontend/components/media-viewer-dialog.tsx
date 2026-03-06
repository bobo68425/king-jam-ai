"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MediaViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaUrl: string | null;
  isVideo: boolean;
  title?: string;
}

export function MediaViewerDialog({
  open,
  onOpenChange,
  mediaUrl,
  isVideo,
  title = "媒體檢視"
}: MediaViewerDialogProps) {
  if (!mediaUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-[85vw] lg:max-w-[75vw] h-auto max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden flex flex-col justify-center items-center shadow-2xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="w-full h-full flex items-center justify-center bg-transparent relative">
          {isVideo ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              controlsList="nodownload"
              className="max-w-full max-h-[95vh] w-auto h-auto object-contain outline-none"
            />
          ) : (
            <img
              src={mediaUrl}
              alt={title}
              className="max-w-full max-h-[95vh] w-auto h-auto object-contain select-none shadow-xl"
              draggable={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
