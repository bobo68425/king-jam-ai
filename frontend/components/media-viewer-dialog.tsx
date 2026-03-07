"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X, Download, Maximize2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaUrl: string | null;
  isVideo: boolean;
  title?: string;
  onDownload?: () => void;
}

export function MediaViewerDialog({
  open,
  onOpenChange,
  mediaUrl,
  isVideo,
  title = "媒體檢視",
  onDownload
}: MediaViewerDialogProps) {
  if (!mediaUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-7xl h-auto max-h-[92vh] p-0 border-none bg-slate-950/95 overflow-hidden flex flex-col shadow-2xl ring-1 ring-white/10">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* Header Bar */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 rounded text-indigo-400">
              {isVideo ? <PlayCircle className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </div>
            <span className="text-sm font-medium text-white/90 truncate max-w-[200px] md:max-w-md">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onDownload && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDownload}
                className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
              >
                <Download className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="w-full h-full flex items-center justify-center p-4 md:p-8 bg-black/40 relative min-h-[50vh]">
          {isVideo ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                src={mediaUrl}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] w-auto h-auto rounded-lg shadow-2xl outline-none"
              />
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt={title}
              className="max-w-full max-h-[80vh] w-auto h-auto object-contain select-none shadow-2xl rounded-lg animate-in fade-in zoom-in duration-300"
              draggable={false}
            />
          )}
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3 bg-black/40 border-t border-white/5 flex items-center justify-center">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium">
            Givoo AI Media Engine • {isVideo ? "Video Generation" : "Image Generation"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
