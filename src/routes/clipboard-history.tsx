import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ClipboardListView from "@/components/clipboard-list-view";
import { ChevronLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

function ClipboardHistoryPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-4 p-6 pb-0">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ChevronLeft size={20} />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{t("clipboardHistory")}</h1>
      </div>

      <div className="flex-1 overflow-hidden px-6">
        <ClipboardListView autoCloseOnCopy={false} />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/clipboard-history")({
  component: ClipboardHistoryPage,
});
