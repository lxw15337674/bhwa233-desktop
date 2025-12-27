import { createFileRoute } from "@tanstack/react-router";
import ClipboardCompactView from "@/components/clipboard-compact-view";
import { X, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ipc } from "@/ipc/manager";

function ClipboardPage() {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

  // Load initial always-on-top setting
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await ipc.client.settings.getSettings();
        const savedAlwaysOnTop = settings.clipboardAlwaysOnTop ?? true;
        setIsAlwaysOnTop(savedAlwaysOnTop);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  const handleClose = () => {
    window.close();
  };

  const toggleAlwaysOnTop = async () => {
    try {
      const result = await ipc.client.window.setAlwaysOnTop({
        alwaysOnTop: !isAlwaysOnTop
      });
      if (result.success) {
        setIsAlwaysOnTop(result.alwaysOnTop);
      }
    } catch (error) {
      console.error("Failed to toggle always on top:", error);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Draggable header with controls */}
      <div
        className="flex items-center justify-between border-b px-2 py-1.5"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="text-xs font-medium text-muted-foreground">
          剪贴板历史
        </div>

        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={toggleAlwaysOnTop}
            title={isAlwaysOnTop ? "取消置顶" : "置顶窗口"}
          >
            <Pin
              size={14}
              className={isAlwaysOnTop ? "fill-current" : ""}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClose}
            title="关闭"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Clipboard compact view */}
      <div className="flex-1 overflow-hidden">
        <ClipboardCompactView autoCloseOnCopy={true} />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/clipboard")({
  component: ClipboardPage,
});
