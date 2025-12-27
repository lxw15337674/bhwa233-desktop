import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import LangToggle from "@/components/lang-toggle";
import ToggleTheme from "@/components/toggle-theme";
import { ChevronLeft, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ipc } from "@/ipc/manager";

function SettingsPage() {
  const { t } = useTranslation();
  const [shortcut, setShortcut] = useState("CommandOrControl+Shift+V");
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await ipc.client.settings.get();
      setShortcut(settings.clipboardShortcut || "CommandOrControl+Shift+V");
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const handleShortcutChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newShortcut = e.target.value;
    setShortcut(newShortcut);

    try {
      await ipc.client.settings.set({ clipboardShortcut: newShortcut });
      // Note: User will need to restart app for shortcut to take effect
    } catch (error) {
      console.error("Failed to save shortcut:", error);
    }
  };

  const handleClearClipboard = async () => {
    if (!confirm(t("confirmClearClipboard"))) {
      return;
    }

    setIsClearing(true);
    try {
      await ipc.client.clipboard.clearAll();
      alert(t("clipboardHistoryCleared") || "Clipboard history cleared");
    } catch (error) {
      console.error("Failed to clear clipboard:", error);
      alert(t("error"));
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ChevronLeft size={20} />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{t("settings")}</h1>
      </div>

      <div className="space-y-6">
        {/* Language Setting */}
        <div className="rounded-lg border p-5">
          <h2 className="mb-4 text-lg font-semibold">{t("languageSetting")}</h2>
          <LangToggle />
        </div>

        {/* Theme Setting */}
        <div className="rounded-lg border p-5">
          <h2 className="mb-4 text-lg font-semibold">{t("themeSetting")}</h2>
          <ToggleTheme />
        </div>

        {/* Clipboard Shortcut Setting */}
        <div className="rounded-lg border p-5">
          <h2 className="mb-4 text-lg font-semibold">{t("clipboardShortcut")}</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={shortcut}
              onChange={handleShortcutChange}
              placeholder="CommandOrControl+Shift+V"
              className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              {t("shortcutHint") || "Restart app to apply changes"}
            </p>
          </div>
        </div>

        {/* Clear Clipboard History */}
        <div className="rounded-lg border p-5">
          <h2 className="mb-4 text-lg font-semibold">{t("clearClipboardHistory")}</h2>
          <Button
            variant="destructive"
            onClick={handleClearClipboard}
            disabled={isClearing}
          >
            <Trash2 size={16} className="mr-2" />
            {isClearing ? t("loading") : t("clearClipboardHistory")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
