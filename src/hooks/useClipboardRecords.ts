import { useCallback, useEffect, useRef, useState } from "react";
import { ipc } from "@/ipc/manager";
import type { ClipboardRecord } from "@/ipc/clipboard/schemas";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface UseClipboardRecordsOptions {
  autoCloseOnCopy?: boolean;
  onCopy?: (id: string) => void;
}

export function useClipboardRecords(options: UseClipboardRecordsOptions = {}) {
  const { autoCloseOnCopy = false, onCopy } = options;
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

  // Reset state when window is opened
  useEffect(() => {
    if (window.electron?.onClipboardWindowOpened) {
      const cleanup = window.electron.onClipboardWindowOpened(() => {
        console.log("Clipboard window opened, resetting state");
        setSearchTerm("");
        loadRecords(0, true);
        // Scroll to top
        if (parentRef.current) {
          parentRef.current.scrollTop = 0;
        }
      });
      return cleanup;
    }
  }, [loadRecords]);

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

  const handleTogglePin = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await ipc.client.clipboard.togglePin({ id });
      loadRecords(0, true);
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await ipc.client.clipboard.deleteRecord({ id });
      loadRecords(0, true);
    } catch (error) {
      console.error("Failed to delete record:", error);
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

  return {
    records,
    searchTerm,
    setSearchTerm,
    hasMore,
    isLoading,
    parentRef,
    loadRecords,
    handleCopy,
    handleTogglePin,
    handleDelete,
    formatTime,
    handleScroll,
  };
}
