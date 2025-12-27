import { createFileRoute } from "@tanstack/react-router";
import ClipboardListView from "@/components/clipboard-list-view";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

function ClipboardPage() {
  const handleClose = () => {
    window.close();
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Header with close button */}
      <div className="flex items-center justify-end border-b p-2">
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X size={20} />
        </Button>
      </div>

      {/* Clipboard list */}
      <div className="flex-1 overflow-hidden">
        <ClipboardListView autoCloseOnCopy={true} />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/clipboard")({
  component: ClipboardPage,
});
