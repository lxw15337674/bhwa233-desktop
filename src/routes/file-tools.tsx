import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  detectFileLocks,
  forceDeleteFile,
  isAdmin,
  selectFile,
} from "@/actions/filesystem";
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
import {
  AlertTriangle,
  FileSearch,
  Trash2,
  Shield,
  FolderOpen,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type {
  DetectFileLocksOutput,
  ProcessLockInfo,
} from "@/ipc/filesystem/schemas";

// Status log entry
interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

function FileToolsPage() {
  const { t } = useTranslation();

  // State
  const [filePath, setFilePath] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lockInfo, setLockInfo] = useState<DetectFileLocksOutput | null>(null);
  const [selectedProcessIds, setSelectedProcessIds] = useState<Set<number>>(
    new Set()
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Add log entry
  const addLog = useCallback(
    (level: LogEntry["level"], message: string) => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level,
        message,
      };
      setLogs((prev) => [entry, ...prev].slice(0, 100)); // Keep last 100 entries
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

  // Handle file picker
  const handlePickFile = useCallback(async () => {
    const result = await selectFile();
    if (!result.canceled && result.filePath) {
      setFilePath(result.filePath);
      addLog("info", t("selectedFile", { path: result.filePath }));
    }
  }, [addLog, t]);

  // Analyze file locks
  const handleAnalyze = useCallback(async () => {
    if (!filePath.trim()) {
      addLog("error", t("selectOrEnterFilePath"));
      return;
    }

    setIsAnalyzing(true);
    setLockInfo(null);
    setSelectedProcessIds(new Set());
    addLog("info", t("analyzingFile", { path: filePath }));

    try {
      const result = await detectFileLocks(filePath);
      setLockInfo(result);

      if (result.success) {
        if (result.isLocked) {
          addLog(
            "warning",
            t("fileLockedBy", { count: result.processes.length })
          );
          // Auto-select all terminatable processes
          const terminatable = new Set(
            result.processes
              .filter((p: ProcessLockInfo) => p.canTerminate && !p.isService)
              .map((p: ProcessLockInfo) => p.pid)
          );
          setSelectedProcessIds(terminatable);
        } else {
          addLog("success", t("fileNotLocked"));
        }
      } else {
        addLog("error", result.message || t("failedToAnalyze"));
      }
    } catch (error: unknown) {
      const err = error as Error;
      addLog("error", t("analysisFailed", { error: err.message }));
    } finally {
      setIsAnalyzing(false);
    }
  }, [filePath, addLog, t]);

  // Toggle process selection
  const toggleProcessSelection = useCallback((pid: number) => {
    setSelectedProcessIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  }, []);

  // Confirm and delete
  const handleConfirmDelete = useCallback(async () => {
    setShowConfirmDialog(false);
    setIsDeleting(true);

    const pidsToKill = Array.from(selectedProcessIds);
    addLog(
      "info",
      t("attemptingDelete", { count: pidsToKill.length })
    );

    try {
      const result = await forceDeleteFile(filePath, pidsToKill);

      // Log killed processes
      result.killedProcesses.forEach((proc) => {
        addLog("success", t("terminatedProcess", { name: proc.name, pid: proc.pid }));
      });

      // Log failed processes
      result.failedProcesses.forEach((proc) => {
        addLog("error", t("failedToTerminate", { pid: proc.pid, error: proc.error }));
      });

      if (result.success && result.deleted) {
        addLog("success", t("fileDeletedSuccess"));
        setFilePath("");
        setLockInfo(null);
        setSelectedProcessIds(new Set());
      } else {
        addLog("error", result.message || t("failedToDelete"));
      }
    } catch (error: unknown) {
      const err = error as Error;
      addLog("error", t("deleteOperationFailed", { error: err.message }));
    } finally {
      setIsDeleting(false);
    }
  }, [filePath, selectedProcessIds, addLog, t]);

  // Render process list
  const renderProcessList = () => {
    if (!lockInfo || !lockInfo.isLocked || lockInfo.processes.length === 0) {
      return null;
    }

    return (
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-lg font-semibold">
          {t("lockingProcesses")} ({lockInfo.processes.length})
        </h3>
        <div className="space-y-2">
          {lockInfo.processes.map((proc: ProcessLockInfo) => (
            <div
              key={proc.pid}
              className={`flex items-center gap-3 rounded-md border p-3 transition-colors ${
                selectedProcessIds.has(proc.pid)
                  ? "border-destructive bg-destructive/10"
                  : "bg-secondary/30"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedProcessIds.has(proc.pid)}
                onChange={() => toggleProcessSelection(proc.pid)}
                disabled={!proc.canTerminate || proc.isService}
                className="h-4 w-4"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{proc.name}</p>
                  <span className="text-muted-foreground text-xs">
                    PID: {proc.pid}
                  </span>
                  {proc.isService && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
                      {t("service")}
                    </span>
                  )}
                </div>
                {proc.path && (
                  <p className="text-muted-foreground truncate text-xs">
                    {proc.path}
                  </p>
                )}
                {!proc.canTerminate && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    {t("cannotTerminate")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render log console
  const renderLogs = () => {
    if (logs.length === 0) {
      return (
        <div className="text-muted-foreground flex items-center justify-center p-8 text-sm">
          {t("noLogsYet")}
        </div>
      );
    }

    return (
      <div className="max-h-64 space-y-1 overflow-y-auto p-2">
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
          <h1 className="font-mono text-2xl font-bold">{t("forceDeleteFile")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("forceDeleteFileDesc")}
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
        {/* Left Panel: File Selection & Analysis */}
        <div className="flex flex-col gap-4">
          {/* File Path Input */}
          <div className="rounded-lg border p-4">
            <label className="mb-2 block text-sm font-medium">{t("filePath")}</label>
            <div className="flex gap-2">
              <Input
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder={t("filePathPlaceholder")}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handlePickFile}
                title={t("selectFolder")}
              >
                <FolderOpen size={16} />
              </Button>
            </div>
          </div>

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={!filePath.trim() || isAnalyzing || isDeleting}
            size="lg"
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                {t("analyzing")}
              </>
            ) : (
              <>
                <FileSearch size={16} className="mr-2" />
                {t("analyzeFile")}
              </>
            )}
          </Button>

          {/* Process List */}
          {renderProcessList()}

          {/* Force Delete Button */}
          {lockInfo && lockInfo.isLocked && (
            <Button
              variant="destructive"
              size="lg"
              onClick={() => setShowConfirmDialog(true)}
              disabled={isDeleting || selectedProcessIds.size === 0}
              className="w-full"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  {t("deleting")}
                </>
              ) : (
                <>
                  <Trash2 size={16} className="mr-2" />
                  {t("forceDeleteWithCount", { count: selectedProcessIds.size })}
                </>
              )}
            </Button>
          )}

          {/* Simple Delete (if not locked) */}
          {lockInfo && !lockInfo.isLocked && (
            <Button
              variant="destructive"
              size="lg"
              onClick={() => setShowConfirmDialog(true)}
              disabled={isDeleting}
              className="w-full"
            >
              <Trash2 size={16} className="mr-2" />
              {t("deleteFile")}
            </Button>
          )}
        </div>

        {/* Right Panel: Status Log */}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-lg font-semibold">{t("statusLog")}</h3>
          <div className="bg-secondary/20 rounded-md border">{renderLogs()}</div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle size={20} />
              {t("confirmForceDelete")}
            </DialogTitle>
            <DialogDescription>
              {t("confirmForceDeleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="bg-secondary/50 rounded-md p-3">
              <p className="text-muted-foreground text-xs">{t("filePath")}</p>
              <p className="truncate text-sm font-medium">{filePath}</p>
            </div>
            {selectedProcessIds.size > 0 && (
              <div className="bg-destructive/10 rounded-md border border-destructive/50 p-3">
                <p className="text-destructive text-xs font-semibold">
                  {t("processesWillBeTerminated", { count: selectedProcessIds.size })}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t("unsavedDataWarning")}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              <Trash2 size={16} className="mr-2" />
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/file-tools")({
  component: FileToolsPage,
});
