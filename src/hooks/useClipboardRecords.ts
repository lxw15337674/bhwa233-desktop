import { useCallback, useEffect, useRef, useState } from "react";
import { ipc } from "@/ipc/manager";
import type { ClipboardRecord } from "@/ipc/clipboard/schemas";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ClipboardUpdateEvent } from "@/preload";

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

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
        setSelectedIndex(0); // Reset to first item
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

  // Listen for clipboard updates from main process (incremental updates)
  useEffect(() => {
    if (window.electron?.onClipboardUpdate) {
      const cleanup = window.electron.onClipboardUpdate((event: ClipboardUpdateEvent) => {
        const { eventType, record } = event;

        if (!record) return;

        switch (eventType) {
          case "added":
            // Add new record to the front of the list
            setRecords((prev) => [record, ...prev]);
            break;

          case "updated":
            // Update existing record (e.g., pin/unpin, timestamp change)
            setRecords((prev) => {
              // Remove the record from its current position
              const filtered = prev.filter((r) => r.id !== record.id);
              // Add it to the front (for timestamp updates or pin changes)
              return [record, ...filtered];
            });
            break;

          case "deleted":
            // Remove record from the list
            setRecords((prev) => prev.filter((r) => r.id !== record.id));
            break;
        }
      });
      return cleanup;
    }
  }, []);

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
      // No need to reload - incremental update will handle it
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await ipc.client.clipboard.deleteRecord({ id });
      // No need to reload - incremental update will handle it
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

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Arrow Up
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      // Arrow Down
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(records.length - 1, prev + 1));
      }
      // Enter - paste selected item
      else if (e.key === "Enter") {
        e.preventDefault();
        if (records[selectedIndex]) {
          handleCopy(records[selectedIndex].id);
        }
      }
      // Cmd/Ctrl + 1~9 - paste by number
      else if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (records[index]) {
          handleCopy(records[index].id);
        }
      }
    },
    [records, selectedIndex, handleCopy]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  return {
    records,
    searchTerm,
    setSearchTerm,
    hasMore,
    isLoading,
    parentRef,
    selectedItemRef,
    selectedIndex,
    loadRecords,
    handleCopy,
    handleTogglePin,
    handleDelete,
    formatTime,
    handleScroll,
    handleKeyDown,
  };
}
