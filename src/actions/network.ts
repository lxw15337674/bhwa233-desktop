import { ipc } from "@/ipc/manager";
import type {
  GetListeningPortsOutput,
  KillProcessOutput,
  GetProcessIOOutput,
} from "@/ipc/network/schemas";

export function getListeningPorts(): Promise<GetListeningPortsOutput> {
  return ipc.client.network.getListeningPorts();
}

export function killProcess(processId: number): Promise<KillProcessOutput> {
  return ipc.client.network.killProcess({ processId });
}

export function getProcessIO(): Promise<GetProcessIOOutput> {
  return ipc.client.network.getProcessIO();
}
