import { ipc } from "@/ipc/manager";

export function openExternalLink(url: string) {
  return ipc.client.shell.openExternalLink({ url });
}

export function openFolder(path: string) {
  return ipc.client.shell.openFolder({ path });
}

export function showItemInFolder(path: string) {
  return ipc.client.shell.showItemInFolder({ path });
}
