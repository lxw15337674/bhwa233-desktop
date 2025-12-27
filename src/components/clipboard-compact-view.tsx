import { Pin, MoreVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { useClipboardRecords } from "@/hooks/useClipboardRecords";

interface ClipboardCompactViewProps {
  onCopy?: (id: string) => void;
  autoCloseOnCopy?: boolean;
}

export default function ClipboardCompactView({
  onCopy,
  autoCloseOnCopy = false,
}: ClipboardCompactViewProps) {
  const { t } = useTranslation();
  const {
    records,
    searchTerm,
    setSearchTerm,
    isLoading,
    parentRef,
    handleCopy,
    handleTogglePin,
    handleDelete,
    formatTime,
    handleScroll,
  } = useClipboardRecords({ autoCloseOnCopy, onCopy });

  return (
    <div className="flex h-full w-full flex-col">
      {/* Search bar - compact */}
      <div className="border-b p-2">
        <input
          type="text"
          placeholder={t("searchClipboard")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* List - optimized with ScrollArea */}
      <ScrollArea className="flex-1">
        <div ref={parentRef} onScroll={handleScroll}>
          {records.map((record) => (
            <div
              key={record.id}
              className="group cursor-pointer border-b border-border/50 px-3 py-2 transition-colors hover:bg-accent/50"
              onClick={() => handleCopy(record.id)}
            >
              <div className="flex items-start gap-3">
                {/* Content */}
                <div className="min-w-0 flex-1">
                  {record.type === "text" ? (
                    <div className="line-clamp-3 break-words text-sm leading-relaxed">
                      {record.preview || record.content}
                    </div>
                  ) : (
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <div className="flex h-12 w-12 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded bg-muted">
                          <img
                            src={`file://${record.content}`}
                            alt="Clipboard"
                            className="h-full w-full object-contain"
                          />
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-auto max-w-lg p-2" side="right" align="start">
                        <img
                          src={`file://${record.content}`}
                          alt="Clipboard Preview"
                          className="max-h-[500px] max-w-full rounded object-contain"
                        />
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </div>

                {/* Right side: Time + Actions */}
                <div className="flex flex-shrink-0 items-start gap-1">
                  {/* Time */}
                  <div className="text-[11px] leading-none text-muted-foreground">
                    {formatTime(record.timestamp)}
                  </div>

                  {/* Pin button - fade in on hover */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => handleTogglePin(record.id, e)}
                  >
                    <Pin
                      size={13}
                      className={record.isPinned ? "fill-current" : ""}
                    />
                  </Button>

                  {/* Menu - fade in on hover */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical size={13} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e: any) => handleTogglePin(record.id, e)}>
                        <Pin size={13} className="mr-2" />
                        {record.isPinned ? "Unpin" : "Pin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e: any) => handleDelete(record.id, e)}>
                        <Trash2 size={13} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Loading indicator */}
      {isLoading && (
        <div className="border-t p-1.5 text-center text-xs text-muted-foreground">
          {t("loading")}...
        </div>
      )}
    </div>
  );
}
