import React from "react";
import DragWindowRegion from "@/components/drag-window-region";
import { Toaster } from "@/components/ui/sonner"

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DragWindowRegion title="bhwa233-tools" />
      <Toaster />
      <main className="h-screen p-2 pb-20">{children}</main>
    </>
  );
}
