import { getPlatform } from "@/actions/app";
import { closeWindow, maximizeWindow, minimizeWindow } from "@/actions/window";
import { type ReactNode, useEffect, useState } from "react";
import { Settings, ChevronDown, Video, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";

interface DragWindowRegionProps {
  title?: ReactNode;
}

export default function DragWindowRegion({ title }: DragWindowRegionProps) {
  const [platform, setPlatform] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    let active = true;

    getPlatform()
      .then((value) => {
        if (!active) {
          return;
        }

        setPlatform(value);
      })
      .catch((error) => {
        console.error("Failed to detect platform", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const isMacOS = platform === "darwin";

  return (
    <div className="flex w-screen items-stretch justify-between">
      <div className="draglayer flex w-full items-center">
        {isMacOS && <div className="w-16" />}
        {/* App Title */}
        <div className="flex items-center gap-1 p-2 text-sm font-medium select-none">
          {title}
        </div>

        {/* Function Menu Dropdown */}
        <div
          className="relative"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            type="button"
            className="hover:bg-secondary flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {t("functions")}
            <ChevronDown
              size={14}
              className={`transition-transform ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="bg-background absolute top-full left-0 z-50 mt-1 min-w-[160px] rounded-md border p-1 shadow-lg">
                <Link
                  to="/"
                  className="hover:bg-secondary flex items-center gap-2 rounded-sm px-3 py-2 text-sm"
                  onClick={() => setMenuOpen(false)}
                >
                  <Video size={16} />
                  {t("batchConverter")}
                </Link>
                <Link
                  to="/clipboard-history"
                  className="hover:bg-secondary flex items-center gap-2 rounded-sm px-3 py-2 text-sm"
                  onClick={() => setMenuOpen(false)}
                >
                  <Clock size={16} />
                  {t("clipboardHistory")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Section: Settings + Window Buttons */}
      <div className="flex items-center">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link to="/settings">
            <Settings size={16} />
          </Link>
        </Button>
        {!isMacOS && <WindowButtons />}
      </div>
    </div>
  );
}

function WindowButtons() {
  return (
    <div className="flex">
      <button
        title="Minimize"
        type="button"
        className="p-2 hover:bg-slate-300 dark:hover:bg-slate-700"
        onClick={minimizeWindow}
      >
        <svg
          aria-hidden="true"
          role="img"
          width="12"
          height="12"
          viewBox="0 0 12 12"
        >
          <rect fill="currentColor" width="10" height="1" x="1" y="6"></rect>
        </svg>
      </button>
      <button
        title="Maximize"
        type="button"
        className="p-2 hover:bg-slate-300 dark:hover:bg-slate-700"
        onClick={maximizeWindow}
      >
        <svg
          aria-hidden="true"
          role="img"
          width="12"
          height="12"
          viewBox="0 0 12 12"
        >
          <rect
            width="9"
            height="9"
            x="1.5"
            y="1.5"
            fill="none"
            stroke="currentColor"
          ></rect>
        </svg>
      </button>
      <button
        type="button"
        title="Close"
        className="p-2 hover:bg-red-300 dark:hover:bg-red-700"
        onClick={closeWindow}
      >
        <svg
          aria-hidden="true"
          role="img"
          width="12"
          height="12"
          viewBox="0 0 12 12"
        >
          <polygon
            fill="currentColor"
            fillRule="evenodd"
            points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"
          ></polygon>
        </svg>
      </button>
    </div>
  );
}
