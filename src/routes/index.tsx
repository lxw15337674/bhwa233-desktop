import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  batchConvert,
  batchControl,
  getHardwareInfo,
  getVideoInfo,
  selectFolder,
} from "@/actions/media";
import { openFolder, showItemInFolder } from "@/actions/shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import type {
  BatchFileStatus,
  BatchOverallProgress,
  HardwareInfo,
  SpeedPreset,
  VideoCodec,
  VideoInfo,
} from "@/ipc/media/schemas";
import {
  Trash2,
  X,
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Monitor,
  Info,
  FolderOpen,
  FolderSearch,
} from "lucide-react";
import { Input } from "../components/ui/input";

interface FileItem {
  id: string;
  file: File;
  path: string;
  status: BatchFileStatus;
  progress: number;
  error?: string;
  outputSize?: number;
  outputPath?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const StatusIcon = ({ status }: { status: BatchFileStatus }) => {
  switch (status) {
    case "pending":
      return <Clock size={16} className="text-muted-foreground" />;
    case "converting":
      return <Loader2 size={16} className="animate-spin text-blue-500" />;
    case "completed":
      return <CheckCircle size={16} className="text-green-500" />;
    case "failed":
      return <XCircle size={16} className="text-red-500" />;
    case "cancelled":
      return <X size={16} className="text-muted-foreground" />;
    default:
      return null;
  }
};

function HomePage() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [format, setFormat] = useState("mp4");
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>("balanced");
  const [parallelCount, setParallelCount] = useState(1);
  const [smartCopy, setSmartCopy] = useState(true);
  const [videoCodec, setVideoCodec] = useState<VideoCodec>("h264");
  const [outputDir, setOutputDir] = useState<string>("");
  const [filenameTemplate, setFilenameTemplate] = useState("{name}");
  const [status, setStatus] = useState<
    "idle" | "converting" | "paused" | "completed"
  >("idle");
  const [overallProgress, setOverallProgress] = useState({
    total: 0,
    completed: 0,
    failed: 0,
  });
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [videoInfoModal, setVideoInfoModal] = useState<{
    isOpen: boolean;
    info: VideoInfo | null;
    fileName: string;
    loading: boolean;
  }>({
    isOpen: false,
    info: null,
    fileName: "",
    loading: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load hardware info on mount
  useEffect(() => {
    getHardwareInfo()
      .then(setHardwareInfo)
      .catch((err) => console.error("Failed to get hardware info:", err));
  }, []);

  useEffect(() => {
    const unsubscribe = window.media.onBatchProgress(
      (progress: BatchOverallProgress) => {
        setOverallProgress({
          total: progress.total,
          completed: progress.completed,
          failed: progress.failed,
        });

        if (progress.currentFile) {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === progress.currentFile!.fileIndex
                ? {
                    ...f,
                    status: progress.currentFile!.status,
                    progress: progress.currentFile!.progress,
                    error: progress.currentFile!.error,
                    outputSize: progress.currentFile!.outputSize,
                    outputPath: progress.currentFile!.outputPath,
                  }
                : f,
            ),
          );
        }

        if (progress.isPaused) {
          setStatus("paused");
        }
      },
    );
    return unsubscribe;
  }, []);

  const handleFilesSelected = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: FileItem[] = Array.from(selectedFiles).map((file) => ({
      id: crypto.randomUUID(),
      file,
      path: window.electron.getFilePath(file),
      status: "pending" as const,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add("border-primary", "bg-primary/5");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove("border-primary", "bg-primary/5");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove("border-primary", "bg-primary/5");

    const droppedFiles = e.dataTransfer.files;
    const videoFiles = Array.from(droppedFiles).filter(
      (f) => f.type.startsWith("video/") || f.type.startsWith("audio/"),
    );

    if (videoFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      videoFiles.forEach((f) => dataTransfer.items.add(f));
      handleFilesSelected(dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleOpenFolder = async (item: FileItem) => {
    try {
      if (item.outputPath) {
        // If conversion completed, show output file in folder
        await showItemInFolder(item.outputPath);
      } else {
        // Otherwise open source file directory
        const dir = item.path.substring(
          0,
          item.path.lastIndexOf("\\") || item.path.lastIndexOf("/"),
        );
        await openFolder(dir);
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  const handleOpenOutputDir = async () => {
    try {
      if (outputDir) {
        await openFolder(outputDir);
      } else if (files.length > 0) {
        // If no output dir set, open first file's directory
        const firstFilePath = files[0].path;
        const dir = firstFilePath.substring(
          0,
          firstFilePath.lastIndexOf("\\") || firstFilePath.lastIndexOf("/"),
        );
        await openFolder(dir);
      }
    } catch (error) {
      console.error("Failed to open output directory:", error);
    }
  };

  const clearFiles = () => {
    setFiles([]);
    setStatus("idle");
    setOverallProgress({ total: 0, completed: 0, failed: 0 });
  };

  const restartConversion = () => {
    setStatus("idle");
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        status: "pending" as const,
        progress: 0,
        error: undefined,
      })),
    );
    setOverallProgress({ total: 0, completed: 0, failed: 0 });
  };

  const startConversion = async () => {
    if (files.length === 0) return;

    setStatus("converting");
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        status: "pending" as const,
        progress: 0,
        error: undefined,
      })),
    );

    const filePaths = files.map((f) => f.path);

    try {
      await batchConvert(
        filePaths,
        format,
        outputDir || undefined,
        filenameTemplate || undefined,
        speedPreset,
        parallelCount,
        smartCopy,
        videoCodec,
      );
      setStatus("completed");
    } catch (error) {
      console.error("Batch conversion error:", error);
      setStatus("idle");
    }
  };

  const pauseConversion = async () => {
    await batchControl("pause");
    setStatus("paused");
  };

  const resumeConversion = async () => {
    await batchControl("resume");
    setStatus("converting");
  };

  const cancelConversion = async () => {
    await batchControl("cancel");
    setStatus("idle");
  };

  const showVideoInfo = async (filePath: string, fileName: string) => {
    setVideoInfoModal({ isOpen: true, info: null, fileName, loading: true });
    try {
      const info = await getVideoInfo(filePath);
      setVideoInfoModal({ isOpen: true, info, fileName, loading: false });
    } catch (error) {
      console.error("Failed to get video info:", error);
      setVideoInfoModal({
        isOpen: false,
        info: null,
        fileName: "",
        loading: false,
      });
    }
  };

  const handleSelectFolder = async () => {
    const folder = await selectFolder();
    if (folder) {
      setOutputDir(folder);
    }
  };

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0)
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatBitrate = (bps: number): string => {
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(2)} Mbps`;
    if (bps >= 1000) return `${(bps / 1000).toFixed(0)} Kbps`;
    return `${bps} bps`;
  };

  const overallPercent =
    overallProgress.total > 0
      ? Math.round(
          ((overallProgress.completed + overallProgress.failed) /
            overallProgress.total) *
            100,
        )
      : 0;

  const isDisabled = status === "converting" || status === "paused";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6">
          <h1 className="font-mono text-2xl font-bold">
            {t("batchConverter")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("batchDescription")}
          </p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left Panel: File List */}
          <div className="flex flex-col rounded-lg border p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("fileList")}</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={status === "converting"}
                >
                  {t("addFiles")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFiles}
                  disabled={status === "converting" || files.length === 0}
                >
                  {t("clearAll")}
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Drop Zone */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="flex-1 overflow-auto rounded-md border-2 border-dashed transition-colors"
            >
              {files.length === 0 ? (
                <div className="text-muted-foreground flex h-full min-h-[200px] flex-col items-center justify-center">
                  <p className="text-sm">{t("dropFilesHint")}</p>
                  <p className="mt-1 text-xs">{t("orClickAdd")}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {files.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3">
                      <StatusIcon status={item.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.file.name}
                        </p>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <span>{formatFileSize(item.file.size)}</span>
                          {item.status === "converting" && (
                            <span>{item.progress}%</span>
                          )}
                          {item.status === "completed" && item.outputSize && (
                            <span className="text-green-500">
                              → {formatFileSize(item.outputSize)}
                            </span>
                          )}
                          {item.status === "failed" && (
                            <span className="text-red-500">
                              {item.error || t("conversionFailed")}
                            </span>
                          )}
                        </div>
                        {item.status === "converting" && (
                          <div className="bg-secondary mt-1 h-1 w-full overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => showVideoInfo(item.path, item.file.name)}
                        title={t("viewInfo")}
                      >
                        <Info size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleOpenFolder(item)}
                        title={t("openFolder")}
                      >
                        <FolderOpen size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeFile(item.id)}
                        disabled={
                          status === "converting" &&
                          item.status === "converting"
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Settings & Controls */}
          <div className="rounded-lg border p-5">
            <h2 className="mb-4 text-lg font-semibold">
              {t("convertSettings")}
            </h2>
            <div className="space-y-4">
              {/* Output Directory */}
              <div>
                <label className="text-sm font-medium">
                  {t("outputDirectory")}
                </label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    placeholder={t("outputDirPlaceholder")}
                    disabled={isDisabled}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSelectFolder}
                    disabled={isDisabled}
                    title={t("selectFolder")}
                  >
                    <FolderSearch size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpenOutputDir}
                    disabled={!outputDir && files.length === 0}
                    title={t("openOutputDir")}
                  >
                    <FolderOpen size={16} />
                  </Button>
                </div>
              </div>
              {/* Filename Template */}
              <div>
                <div className="flex items-center gap-1.5">
                  <label className="text-sm font-medium">
                    {t("filenameTemplate")}
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info
                          size={14}
                          className="text-muted-foreground cursor-help"
                        />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold">
                            {t("templateVariables")}
                          </p>
                          <div className="space-y-0.5">
                            <p>
                              <code className="bg-secondary rounded px-1">
                                {"{name}"}
                              </code>{" "}
                              - {t("varName")}
                            </p>
                            <p>
                              <code className="bg-secondary rounded px-1">
                                {"{date}"}
                              </code>{" "}
                              - {t("varDate")}
                            </p>
                            <p>
                              <code className="bg-secondary rounded px-1">
                                {"{time}"}
                              </code>{" "}
                              - {t("varTime")}
                            </p>
                            <p>
                              <code className="bg-secondary rounded px-1">
                                {"{format}"}
                              </code>{" "}
                              - {t("varFormat")}
                            </p>
                          </div>
                          <p className="text-muted-foreground pt-1">
                            {t("templateExample")}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  value={filenameTemplate}
                  onChange={(e) => setFilenameTemplate(e.target.value)}
                  placeholder="{name}"
                  disabled={isDisabled}
                  className="mt-1.5"
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  {t("templateHint")}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("outputFormat")}
                </label>
                <Select
                  value={format}
                  onValueChange={setFormat}
                  disabled={isDisabled}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{t("videoFormats")}</SelectLabel>
                      <SelectItem value="mp4">MP4</SelectItem>
                      <SelectItem value="webm">WebM</SelectItem>
                      <SelectItem value="avi">AVI</SelectItem>
                      <SelectItem value="mov">MOV</SelectItem>
                      <SelectItem value="mkv">MKV</SelectItem>
                      <SelectItem value="flv">FLV</SelectItem>
                      <SelectItem value="wmv">WMV</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>{t("otherFormats")}</SelectLabel>
                      <SelectItem value="gif">GIF</SelectItem>
                      <SelectItem value="mp3">
                        MP3 ({t("audioOnly")})
                      </SelectItem>
                      <SelectItem value="wav">
                        WAV ({t("audioOnly")})
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              {/* Video Codec (only for compatible formats) */}
              {["mp4", "mkv", "mov", "avi", "flv"].includes(format) && (
                <div>
                  <label className="text-sm font-medium">
                    {t("videoCodec")}
                  </label>
                  <Select
                    value={videoCodec}
                    onValueChange={(v) => setVideoCodec(v as VideoCodec)}
                    disabled={isDisabled}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="h264">H.264 (AVC)</SelectItem>
                      <SelectItem
                        value="hevc"
                        disabled={hardwareInfo && !hardwareInfo.hevcSupport}
                      >
                        H.265 (HEVC){" "}
                        {hardwareInfo &&
                          !hardwareInfo.hevcSupport &&
                          `(${t("notSupported")})`}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t("hevcHint")}
                  </p>
                </div>
              )}
              {/* Speed Preset */}
              <div>
                <label className="text-sm font-medium">
                  {t("speedPreset")}
                </label>
                <Select
                  value={speedPreset}
                  onValueChange={(v) => setSpeedPreset(v as SpeedPreset)}
                  disabled={isDisabled}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">{t("presetFast")}</SelectItem>
                    <SelectItem value="balanced">
                      {t("presetBalanced")}
                    </SelectItem>
                    <SelectItem value="quality">
                      {t("presetQuality")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Smart Copy Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t("smartCopy")}
                  </label>
                  <p className="text-muted-foreground text-xs">
                    {t("smartCopyDesc")}
                  </p>
                </div>
                <Switch
                  checked={smartCopy}
                  onCheckedChange={setSmartCopy}
                  disabled={isDisabled}
                />
              </div>
              {/* Parallel Count */}
              <div>
                <label className="text-sm font-medium">
                  {t("parallelCount")}
                </label>
                <Select
                  value={parallelCount.toString()}
                  onValueChange={(v) => setParallelCount(Number(v))}
                  disabled={isDisabled}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 ({t("serial")})</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Hardware Info */}
              {hardwareInfo && (
                <div className="flex items-center gap-2 text-sm">
                  <Monitor
                    size={14}
                    className={
                      hardwareInfo.gpuAccel !== "none"
                        ? "text-green-500"
                        : "text-muted-foreground"
                    }
                  />
                  <span className="text-muted-foreground">
                    {t("gpuAcceleration")}:
                  </span>
                  <span
                    className={
                      hardwareInfo.gpuAccel !== "none"
                        ? "font-medium text-green-500"
                        : ""
                    }
                  >
                    {hardwareInfo.gpuAccel !== "none"
                      ? t("enabled")
                      : t("disabled")}
                  </span>
                </div>
              )}
              {/* Overall Progress */}
              {(status === "converting" ||
                status === "paused" ||
                status === "completed") && (
                <div className="bg-secondary/50 rounded-md p-4">
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{t("overallProgress")}</span>
                    <span>
                      {overallProgress.completed + overallProgress.failed}/
                      {overallProgress.total}
                    </span>
                  </div>
                  <div className="bg-secondary h-3 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${overallPercent}%` }}
                    />
                  </div>
                  <div className="text-muted-foreground mt-2 flex gap-4 text-xs">
                    <span className="text-green-500">
                      {t("completed")}: {overallProgress.completed}
                    </span>
                    {overallProgress.failed > 0 && (
                      <span className="text-red-500">
                        {t("failed")}: {overallProgress.failed}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {/* Control Buttons */}
              <div className="flex gap-2">
                {status === "idle" && (
                  <Button
                    onClick={startConversion}
                    disabled={files.length === 0}
                    className="flex-1"
                    size="lg"
                  >
                    <Play size={16} className="mr-2" />
                    {t("startConversion")}
                  </Button>
                )}
                {status === "converting" && (
                  <>
                    <Button
                      onClick={pauseConversion}
                      variant="outline"
                      className="flex-1"
                      size="lg"
                    >
                      <Pause size={16} className="mr-2" />
                      {t("pause")}
                    </Button>
                    <Button
                      onClick={cancelConversion}
                      variant="destructive"
                      size="lg"
                    >
                      <Square size={16} className="mr-2" />
                      {t("cancel")}
                    </Button>
                  </>
                )}
                {status === "paused" && (
                  <>
                    <Button
                      onClick={resumeConversion}
                      className="flex-1"
                      size="lg"
                    >
                      <Play size={16} className="mr-2" />
                      {t("resume")}
                    </Button>
                    <Button
                      onClick={cancelConversion}
                      variant="destructive"
                      size="lg"
                    >
                      <Square size={16} className="mr-2" />
                      {t("cancel")}
                    </Button>
                  </>
                )}
                {status === "completed" && (
                  <>
                    <Button
                      onClick={clearFiles}
                      variant="outline"
                      className="flex-1"
                      size="lg"
                    >
                      <Square size={16} className="mr-2" />
                      {t("clearAll")}
                    </Button>
                    <Button
                      onClick={restartConversion}
                      className="flex-1"
                      size="lg"
                    >
                      <Play size={16} className="mr-2" />
                      {t("restart")}
                    </Button>
                  </>
                )}
              </div>
              {/* Status Messages */}
              {status === "completed" && (
                <div className="rounded-md bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400">
                  <p className="font-semibold">{t("batchComplete")}</p>
                  <p className="mt-1 text-xs opacity-80">
                    {t("completedCount", { count: overallProgress.completed })}
                    {overallProgress.failed > 0 &&
                      `, ${t("failedCount", { count: overallProgress.failed })}`}
                  </p>
                </div>
              )}
              {status === "paused" && (
                <div className="rounded-md bg-yellow-500/10 p-4 text-sm text-yellow-600 dark:text-yellow-400">
                  <p className="font-semibold">{t("conversionPaused")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Video Info Modal */}
      <Dialog
        open={videoInfoModal.isOpen}
        onOpenChange={(open) =>
          !open &&
          setVideoInfoModal({
            isOpen: false,
            info: null,
            fileName: "",
            loading: false,
          })
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sourceInfo")}</DialogTitle>
          </DialogHeader>
          {videoInfoModal.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : videoInfoModal.info ? (
            <div className="space-y-3">
              <div className="bg-secondary/50 rounded-md p-3">
                <p className="text-muted-foreground text-xs">{t("fileName")}</p>
                <p className="truncate text-sm font-medium">
                  {videoInfoModal.fileName}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-muted-foreground text-xs">{t("format")}</p>
                  <p className="text-sm font-medium">
                    {videoInfoModal.info.format.toUpperCase()}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-muted-foreground text-xs">
                    {t("duration")}
                  </p>
                  <p className="text-sm font-medium">
                    {formatDuration(videoInfoModal.info.duration)}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-muted-foreground text-xs">
                    {t("resolution")}
                  </p>
                  <p className="text-sm font-medium">
                    {videoInfoModal.info.width}x{videoInfoModal.info.height}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-muted-foreground text-xs">{t("codec")}</p>
                  <p className="text-sm font-medium">
                    {videoInfoModal.info.codec}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-muted-foreground text-xs">
                    {t("bitrate")}
                  </p>
                  <p className="text-sm font-medium">
                    {formatBitrate(videoInfoModal.info.bitrate)}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-md p-3">
                  <p className="text-muted-foreground text-xs">
                    {t("frameRate")}
                  </p>
                  <p className="text-sm font-medium">
                    {videoInfoModal.info.fps} fps
                  </p>
                </div>
                <div className="bg-secondary/50 col-span-2 rounded-md p-3">
                  <p className="text-muted-foreground text-xs">
                    {t("fileSize")}
                  </p>
                  <p className="text-sm font-medium">
                    {formatFileSize(videoInfoModal.info.size)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
