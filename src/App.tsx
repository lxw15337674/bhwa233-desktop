import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { syncWithLocalTheme } from "./actions/theme";
import { useTranslation } from "react-i18next";
import { updateAppLanguage } from "./actions/language";
import { RouterProvider, useNavigate, useRouterState } from "@tanstack/react-router";
import { router } from "./utils/routes";
import { Toaster } from "sonner";
import { ipc } from "./ipc/manager";
import "./localization/i18n";

function NavigationHandler() {
  const navigate = useNavigate();
  const routerState = useRouterState();

  // Handle external navigation requests
  useEffect(() => {
    if (window.electron?.onNavigate) {
      const cleanup = window.electron.onNavigate((path: string) => {
        navigate({ to: path });
      });
      return cleanup;
    }
  }, [navigate]);

  // Save route on every navigation (exclude /clipboard)
  useEffect(() => {
    const currentPath = routerState.location.pathname;
    if (currentPath !== "/clipboard") {
      ipc.client.settings.updateSettings({ lastRoute: currentPath }).catch((err) => {
        console.error("Failed to save last route:", err);
      });
    }
  }, [routerState.location.pathname]);

  return null;
}

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    (async () => {
      await syncWithLocalTheme();
      await updateAppLanguage(i18n);

      // Restore last route (skip for clipboard route as it's ephemeral)
      try {
        const currentPath = window.location.hash.replace("#", "");
        if (currentPath === "/clipboard") {
          console.log("Clipboard route detected, skipping route restoration");
          return;
        }

        const settings = await ipc.client.settings.getSettings();
        const lastRoute = settings.lastRoute || "/";

        // Only navigate if not already on that route and it's not /clipboard
        if (lastRoute !== "/clipboard" && currentPath !== lastRoute) {
          router.navigate({ to: lastRoute }).catch((err) => {
            console.error("Failed to restore last route:", err);
            // Fallback to home on error
            router.navigate({ to: "/" }).catch(console.error);
          });
        }
      } catch (err) {
        console.error("Failed to get last route:", err);
      }
    })();
  }, [i18n]);

  return (
    <>
      <RouterProvider router={router}>
        <NavigationHandler />
      </RouterProvider>
      <Toaster />
    </>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
