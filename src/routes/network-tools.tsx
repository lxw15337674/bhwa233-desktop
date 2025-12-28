import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getListeningPorts, killProcess, getProcessIO } from "@/actions/network";
import { isAdmin } from "@/actions/filesystem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  RefreshCw,
  Trash2,
  Shield,
  ChevronLeft,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { PortInfo } from "@/ipc/network/schemas";

// Log entry interface
interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

type SortField = "port" | "protocol" | "process";
type SortOrder = "asc" | "desc";

// Process traffic data
interface ProcessTraffic {
  pid: number;
  readSpeed: number;  // Bytes per second
  writeSpeed: number; // Bytes per second
  totalSpeed: number; // Bytes per second
}

function NetworkToolsPage() {
  const { t } = useTranslation();

  // State
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isKilling, setIsKilling] = useState(false);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [protocolFilter, setProtocolFilter] = useState<"all" | "TCP" | "UDP">("all");
  const [sortField, setSortField] = useState<SortField>("port");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Traffic monitoring state
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(false);
  const [processTraffic, setProcessTraffic] = useState<Map<number, ProcessTraffic>>(new Map());
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add log entry
  const addLog = useCallback(
    (level: LogEntry["level"], message: string) => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level,
        message,
      };
      setLogs((prev) => [entry, ...prev].slice(0, 100));
    },
    []
  );

  // Check admin status on mount
  useEffect(() => {
    isAdmin().then((result) => {
      setIsAdminUser(result.isAdmin);
      if (result.platform === "win32" && !result.isAdmin) {
        addLog("warning", t("notAdminWarning"));
      } else if (result.platform !== "win32") {
        addLog("error", t("windowsOnlyFeature"));
      }
    });
  }, [t, addLog]);

  // Refresh port list
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    addLog("info", t("loadingPorts"));

    try {
      const result = await getListeningPorts();

      if (result.success) {
        setPorts(result.ports);
        addLog("success", t("loadedPorts", { count: result.ports.length }));
      } else {
        addLog("error", result.message || t("failedToLoadPorts"));
      }
    } catch (error: unknown) {
      const err = error as Error;
      addLog("error", t("loadPortsFailed", { error: err.message }));
    } finally {
      setIsLoading(false);
    }
  }, [addLog, t]);

  // Auto-load ports on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      handleRefresh();
    }, 100);

    return () => clearTimeout(timer);
  }, [handleRefresh]);

  // Get all ports used by a process
  const getProcessPorts = useCallback((pid: number): PortInfo[] => {
    return ports.filter((p) => p.process.pid === pid);
  }, [ports]);

  // Handle process selection
  const handleSelectProcess = useCallback((pid: number) => {
    setSelectedPid(pid);
    setShowConfirmDialog(true);
  }, []);

  // Confirm and kill process
  const handleConfirmKill = useCallback(async () => {
    if (!selectedPid) return;

    setShowConfirmDialog(false);
    setIsKilling(true);

    const processPorts = getProcessPorts(selectedPid);
    const processName = processPorts[0]?.process.name || "Unknown";

    addLog("info", t("attemptingKillProcess", { name: processName, pid: selectedPid }));

    try {
      const result = await killProcess(selectedPid);

      if (result.success) {
        addLog("success", t("processKilledSuccess", { name: result.name, pid: result.pid }));
        // Refresh port list
        await handleRefresh();
      } else {
        addLog("error", result.message || t("failedToKillProcess"));
      }
    } catch (error: unknown) {
      const err = error as Error;
      addLog("error", t("killProcessFailed", { error: err.message }));
    } finally {
      setIsKilling(false);
      setSelectedPid(null);
    }
  }, [selectedPid, getProcessPorts, addLog, t, handleRefresh]);

  // Handle sorting
  const handleSort = useCallback((field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        // Toggle order if same field
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        // Set new field with ascending order
        setSortOrder("asc");
      }
      return field;
    });
  }, []);

  // Format bytes to human-readable format
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 B/s";
    if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB/s`;
  }, []);

  // Get traffic for a process
  const getProcessTrafficData = useCallback((pid: number): ProcessTraffic | null => {
    return processTraffic.get(pid) || null;
  }, [processTraffic]);

  // Toggle monitoring
  const toggleMonitoring = useCallback(() => {
    setIsMonitoringEnabled((prev) => !prev);
  }, []);

  // Monitoring effect
  useEffect(() => {
    if (!isMonitoringEnabled) {
      // Clear interval and data when disabled
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
      setProcessTraffic(new Map());
      return;
    }

    // Start monitoring
    let lastData: Map<number, { read: number; write: number; timestamp: number }> = new Map();

    const fetchTraffic = async () => {
      try {
        const result = await getProcessIO();

        if (result.success) {
          const now = Date.now();
          const newTraffic = new Map<number, ProcessTraffic>();

          result.processes.forEach((proc) => {
            const last = lastData.get(proc.pid);

            if (last) {
              const timeDiff = (now - last.timestamp) / 1000; // seconds

              if (timeDiff > 0) {
                const readDiff = Math.max(0, proc.readBytes - last.read);
                const writeDiff = Math.max(0, proc.writeBytes - last.write);

                const readSpeed = readDiff / timeDiff;
                const writeSpeed = writeDiff / timeDiff;

                newTraffic.set(proc.pid, {
                  pid: proc.pid,
                  readSpeed,
                  writeSpeed,
                  totalSpeed: readSpeed + writeSpeed,
                });
              }
            }

            // Update last data
            lastData.set(proc.pid, {
              read: proc.readBytes,
              write: proc.writeBytes,
              timestamp: now,
            });
          });

          setProcessTraffic(newTraffic);
        }
      } catch (error) {
        console.error("Failed to fetch process I/O:", error);
      }
    };

    // Initial fetch
    fetchTraffic();

    // Set up interval (2 seconds)
    monitoringIntervalRef.current = setInterval(fetchTraffic, 2000);

    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
    };
  }, [isMonitoringEnabled]);

  // Filtered and sorted ports
  const filteredPorts = useMemo(() => {
    let result = [...ports];

    // Apply protocol filter
    if (protocolFilter !== "all") {
      result = result.filter((p) => p.protocol === protocolFilter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.port.toString().includes(query) ||
          p.process.name.toLowerCase().includes(query) ||
          p.process.path?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "port":
          comparison = a.port - b.port;
          break;
        case "protocol":
          comparison = a.protocol.localeCompare(b.protocol);
          break;
        case "process":
          comparison = a.process.name.localeCompare(b.process.name);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [ports, protocolFilter, searchQuery, sortField, sortOrder]);

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="ml-1 opacity-30" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={14} className="ml-1" />
    ) : (
      <ArrowDown size={14} className="ml-1" />
    );
  };

  // Render logs
  const renderLogs = () => {
    if (logs.length === 0) {
      return (
        <div className="text-muted-foreground flex items-center justify-center p-8 text-sm">
          {t("noLogsYet")}
        </div>
      );
    }

    return (
      <ScrollArea className="h-full">
        <div className="space-y-1 p-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2 rounded px-2 py-1 text-sm font-mono ${
                log.level === "error"
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : log.level === "warning"
                    ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                    : log.level === "success"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "text-muted-foreground"
              }`}
            >
              <span className="text-muted-foreground shrink-0 text-xs">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span className="flex-1">{log.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ChevronLeft size={20} />
          </Link>
        </Button>
        <div>
          <h1 className="font-mono text-2xl font-bold">{t("networkPortManager")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("networkPortManagerDesc")}
          </p>
        </div>
      </div>

      {/* Admin Warning */}
      {isAdminUser === false && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-sm text-yellow-600 dark:text-yellow-400">
          <Shield size={20} />
          <div>
            <p className="font-semibold">{t("notRunningAsAdmin")}</p>
            <p className="text-xs opacity-80">
              {t("notRunningAsAdminDesc")}
            </p>
          </div>
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Panel: Port List */}
        <div className="flex flex-col gap-4">
          {/* Toolbar */}
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              disabled={isLoading || isKilling}
              variant="outline"
            >
              {isLoading ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <RefreshCw size={16} className="mr-2" />
              )}
              {t("refresh")}
            </Button>

            {/* Protocol Filter */}
            <div className="flex rounded-md border">
              <button
                className={`px-3 py-1.5 text-sm ${protocolFilter === "all" ? "bg-secondary" : ""}`}
                onClick={() => setProtocolFilter("all")}
              >
                {t("all")}
              </button>
              <button
                className={`border-l px-3 py-1.5 text-sm ${protocolFilter === "TCP" ? "bg-secondary" : ""}`}
                onClick={() => setProtocolFilter("TCP")}
              >
                TCP
              </button>
              <button
                className={`border-l px-3 py-1.5 text-sm ${protocolFilter === "UDP" ? "bg-secondary" : ""}`}
                onClick={() => setProtocolFilter("UDP")}
              >
                UDP
              </button>
            </div>

            {/* Traffic Monitoring Toggle */}
            <Button
              onClick={toggleMonitoring}
              variant={isMonitoringEnabled ? "default" : "outline"}
              size="sm"
              className="ml-auto"
            >
              {isMonitoringEnabled ? "⏸" : "▶"} {t("trafficMonitoring")}
            </Button>
          </div>

          {/* Traffic Monitoring Info */}
          {isMonitoringEnabled && (
            <div className="text-muted-foreground rounded-md bg-blue-500/10 px-3 py-2 text-xs">
              ℹ️ {t("trafficMonitoringNote")}
            </div>
          )}

          {/* Search */}
          <Input
            placeholder={t("searchPortsPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Port Table */}
          <div className="rounded-lg border">
            <div className={`bg-secondary/50 grid items-center border-b px-4 py-2 text-sm font-semibold ${
              isMonitoringEnabled ? "grid-cols-[80px_100px_1fr_120px_80px]" : "grid-cols-[100px_120px_1fr_80px]"
            }`}>
              <button
                className="flex items-center hover:opacity-80"
                onClick={() => handleSort("port")}
              >
                {t("port")}
                {renderSortIcon("port")}
              </button>
              <button
                className="flex items-center hover:opacity-80"
                onClick={() => handleSort("protocol")}
              >
                {t("protocol")}
                {renderSortIcon("protocol")}
              </button>
              <button
                className="flex items-center hover:opacity-80"
                onClick={() => handleSort("process")}
              >
                {t("processName")}
                {renderSortIcon("process")}
              </button>
              {isMonitoringEnabled && (
                <div className="text-center text-xs">
                  {t("traffic")} <span className="text-muted-foreground">(↓/↑)</span>
                </div>
              )}
              <div className="text-center">{t("action")}</div>
            </div>

            <ScrollArea className="h-[400px]">
              {filteredPorts.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 p-8 text-sm">
                  {isLoading ? (
                    <>
                      <Loader2 size={24} className="animate-spin" />
                      <span>{t("loading")}</span>
                    </>
                  ) : ports.length === 0 ? (
                    <>
                      <RefreshCw size={24} />
                      <span>{t("clickRefreshToLoad")}</span>
                    </>
                  ) : (
                    <span>{t("noPortsFound")}</span>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredPorts.map((port, index) => (
                    <div
                      key={`${port.protocol}-${port.port}-${index}`}
                      className={`hover:bg-secondary/30 grid items-center px-4 py-3 text-sm ${
                        isMonitoringEnabled ? "grid-cols-[80px_100px_1fr_120px_80px]" : "grid-cols-[100px_120px_1fr_80px]"
                      }`}
                    >
                      <div className="font-mono font-semibold">{port.port}</div>
                      <div>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          port.protocol === "TCP"
                            ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                            : "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                        }`}>
                          {port.protocol}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{port.process.name}</span>
                          <span className="text-muted-foreground text-xs">
                            PID: {port.process.pid}
                          </span>
                          {port.process.isService && (
                            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-600 dark:text-orange-400">
                              {t("service")}
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground truncate text-xs">
                          {port.addresses.join(", ")}
                        </div>
                      </div>
                      {isMonitoringEnabled && (
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          {(() => {
                            const traffic = getProcessTrafficData(port.process.pid);
                            if (!traffic || traffic.totalSpeed === 0) {
                              return <span className="text-muted-foreground text-xs">-</span>;
                            }
                            return (
                              <>
                                <div className="text-xs text-green-600 dark:text-green-400">
                                  ↓ {formatBytes(traffic.readSpeed)}/s
                                </div>
                                <div className="text-xs text-blue-600 dark:text-blue-400">
                                  ↑ {formatBytes(traffic.writeSpeed)}/s
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      <div className="flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectProcess(port.process.pid)}
                          disabled={!port.process.canTerminate || isKilling}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="text-muted-foreground text-sm">
            {t("showingPorts", { count: filteredPorts.length, total: ports.length })}
          </div>
        </div>

        {/* Right Panel: Status Log */}
        <div className="flex flex-col rounded-lg border p-4">
          <h3 className="mb-3 text-lg font-semibold">{t("statusLog")}</h3>
          <div className="flex-1 bg-secondary/20 rounded-md border">{renderLogs()}</div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle size={20} />
              {t("confirmKillProcess")}
            </DialogTitle>
            <DialogDescription>
              {t("confirmKillProcessDesc")}
            </DialogDescription>
          </DialogHeader>
          {selectedPid && (
            <div className="space-y-3 py-4">
              <div className="bg-secondary/50 rounded-md p-3">
                <p className="text-muted-foreground text-xs">{t("processInfo")}</p>
                <p className="text-sm font-medium">
                  {getProcessPorts(selectedPid)[0]?.process.name} (PID: {selectedPid})
                </p>
              </div>
              <div className="bg-destructive/10 rounded-md border border-destructive/50 p-3">
                <p className="text-destructive text-xs font-semibold">
                  {t("processListensPorts")}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {getProcessPorts(selectedPid)
                    .map((p) => `${p.port} (${p.protocol})`)
                    .join(", ")}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  {t("unsavedDataWarning")}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmKill}>
              <Trash2 size={16} className="mr-2" />
              {t("confirmKill")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/network-tools")({
  component: NetworkToolsPage,
});
