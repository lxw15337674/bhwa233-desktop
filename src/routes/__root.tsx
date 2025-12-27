import BaseLayout from "@/layouts/base-layout";
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
/* import { TanStackRouterDevtools } from '@tanstack/react-router-devtools' */

/*
 * Uncomment the code in this file to enable the router devtools.
 */

function Root() {
  const routerState = useRouterState();
  const isClipboardRoute = routerState.location.pathname === "/clipboard";

  // Clipboard route: no layout wrapper (compact mode)
  if (isClipboardRoute) {
    return (
      <>
        <Outlet />
        {/* <TanStackRouterDevtools /> */}
      </>
    );
  }

  // Other routes: use BaseLayout
  return (
    <BaseLayout>
      <Outlet />
      {/* Uncomment the following line to enable the router devtools */}
      {/* <TanStackRouterDevtools /> */}
    </BaseLayout>
  );
}

export const Route = createRootRoute({
  component: Root,
});
