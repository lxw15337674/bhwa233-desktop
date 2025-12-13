import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import LangToggle from "@/components/lang-toggle";
import ToggleTheme from "@/components/toggle-theme";
import { ChevronLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

function SettingsPage() {
  const { t } = useTranslation();

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
      </div>
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
