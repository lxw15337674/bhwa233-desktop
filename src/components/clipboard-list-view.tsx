import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ipc } from "@/ipc/manager";
import type { ClipboardRecord } from "@/ipc/clipboard/schemas";
import { Image as ImageIcon, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface ClipboardListViewProps {
  onCopy?: (id: string) => void;
  autoCloseOnCopy?: boolean;
}

export default function ClipboardListView({
  onCopy,
  autoCloseOnCopy = false,
}: ClipboardListViewProps) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<ClipboardRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const loadRecords = useCallback(
    async (offset: number, reset = false) => {
      setIsLoading(true);
      try {
        const result = await ipc.client.clipboard.getRecords({
          offset,
          limit: 100,
          searchTerm: searchTerm || undefined,
        });

        setRecords((prev) =>
          reset ? result.records : [...prev, ...result.records]
        );
        setHasMore(result.hasMore);
      } catch (error) {
        console.error("Failed to load clipboard records:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm]
  );

  useEffect(() => {
    loadRecords(0, true);
  }, [loadRecords]);

  // Listen for clipboard updates from main process
  useEffect(() => {
    if (window.electron?.onClipboardUpdate) {
      const cleanup = window.electron.onClipboardUpdate(() => {
        loadRecords(0, true);
      });
      return cleanup;
    }
  }, [loadRecords]);

  const virtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  const handleCopy = async (id: string) => {
    try {
      await ipc.client.clipboard.copyRecord({ id });

      toast(t("copied"));

      if (onCopy) {
        onCopy(id);
      }

      if (autoCloseOnCopy) {
        window.close();
      }
    } catch (error) {
      console.error("Failed to copy record:", error);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const recordDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (recordDate.getTime() === today.getTime()) {
      return timeStr;
    } else if (recordDate.getTime() === yesterday.getTime()) {
      return `${t("yesterday")} ${timeStr}`;
    } else {
      return date.toLocaleString([], {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const handleScroll = useCallback(() => {
    if (!parentRef.current || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadRecords(records.length);
    }
  }, [isLoading, hasMore, records.length, loadRecords]);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Search bar */}
      <div className="border-b p-3">
        <input
          type="text"
          placeholder={t("searchClipboard")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* List */}
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto"
        style={{ contain: "strict" }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const record = records[virtualRow.index];
            if (!record) return null;

            return (
              <div
                key={record.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="cursor-pointer border-b p-3 transition-colors hover:bg-accent"
                onClick={() => handleCopy(record.id)}
              >
                <div className="flex items-start gap-2">
                  {record.type === "image" ? (
                    <ImageIcon
                      size={16}
                      className="mt-1 flex-shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <FileText
                      size={16}
                      className="mt-1 flex-shrink-0 text-muted-foreground"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-xs text-muted-foreground">
                      {formatTime(record.timestamp)}
                    </div>
                    {record.type === "text" ? (
                      <div className="line-clamp-3 break-words text-sm">
                        {record.preview || record.content}
                      </div>
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded bg-muted">
                        <img
                          src={`file://${record.content}`}
                          alt="Clipboard"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="border-t p-2 text-center text-sm text-muted-foreground">
          {t("loading")}...
        </div>
      )}
    </div>
  );
}
