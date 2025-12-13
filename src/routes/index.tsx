import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { convertVideo, getVideoInfo, VideoInfo } from "@/actions/media";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatBitrate = (bps: number): string => {
  if (bps === 0) return "N/A";
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(2)} Mbps`;
  return `${(bps / 1000).toFixed(0)} Kbps`;
};

function HomePage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string>("");
  const [format, setFormat] = useState("mp4");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "converting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [output, setOutput] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  useEffect(() => {
    const unsubscribe = window.media.onProgress((p) => {
      setProgress(p);
    });
    return unsubscribe;
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setStatus("loading");
      setProgress(0);
      setOutput("");
      setVideoInfo(null);
      setErrorMsg("");

      try {
        const path = window.electron.getFilePath(selectedFile);
        setFilePath(path);
        const info = await getVideoInfo(path);
        setVideoInfo(info);
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setErrorMsg((err as Error).message || "Failed to load video info");
      }
    }
  };

  const handleConvert = async () => {
    if (!file || !filePath) return;
    setStatus("converting");
    setProgress(0);
    setErrorMsg("");
    try {
      const result = await convertVideo(filePath, format);
      if (result.success) {
        setStatus("success");
        setOutput(result.outputPath);
      }
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg((e as Error).message || "Unknown error");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6">
          <h1 className="font-mono text-2xl font-bold">{t("videoConverter")}</h1>
          <p className="text-muted-foreground text-sm">{t("convertDescription")}</p>
        </div>

          {/* File Input */}
          <div className="mb-6">
            <label className="text-sm font-medium">{t("selectVideoFile")}</label>
            <input
              type="file"
              accept="video/*,audio/*"
              onChange={handleFileChange}
              className="border-input bg-background ring-offset-background file:bg-primary file:text-primary-foreground placeholder:text-muted-foreground focus-visible:ring-ring mt-1.5 flex h-10 w-full rounded-md border px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-1 file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Main Content: Left-Right Layout */}
          <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2">
            {/* Left Panel: Video Source Info */}
            <div className="rounded-lg border p-5">
              <h2 className="mb-4 text-lg font-semibold">{t("sourceInfo")}</h2>
              {status === "loading" && (
                <div className="text-muted-foreground flex h-40 items-center justify-center">
                  <span>{t("loadingVideoInfo")}</span>
                </div>
              )}
              {!file && status !== "loading" && (
                <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
                  {t("selectFileHint")}
                </div>
              )}
              {file && videoInfo && status !== "loading" && (
                <div className="space-y-3">
                  <div className="rounded-md bg-secondary/50 p-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{t("fileName")}</p>
                    <p className="truncate text-sm font-medium">{file.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">{t("format")}</p>
                      <p className="text-sm font-medium uppercase">{videoInfo.format}</p>
                    </div>
                    <div className="rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">{t("duration")}</p>
                      <p className="text-sm font-medium">{formatDuration(videoInfo.duration)}</p>
                    </div>
                    <div className="rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">{t("resolution")}</p>
                      <p className="text-sm font-medium">
                        {videoInfo.width > 0 ? `${videoInfo.width} x ${videoInfo.height}` : "N/A"}
                      </p>
                    </div>
                    <div className="rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">{t("codec")}</p>
                      <p className="text-sm font-medium uppercase">{videoInfo.codec}</p>
                    </div>
                    <div className="rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">{t("bitrate")}</p>
                      <p className="text-sm font-medium">{formatBitrate(videoInfo.bitrate)}</p>
                    </div>
                    <div className="rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">{t("frameRate")}</p>
                      <p className="text-sm font-medium">{videoInfo.fps > 0 ? `${videoInfo.fps} fps` : "N/A"}</p>
                    </div>
                  </div>
                  <div className="rounded-md bg-secondary/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground">{t("fileSize")}</p>
                    <p className="text-sm font-medium">{formatFileSize(videoInfo.size)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Operation Panel */}
            <div className="rounded-lg border p-5">
              <h2 className="mb-4 text-lg font-semibold">{t("convertOptions")}</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t("outputFormat")}</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1.5 flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <optgroup label="Video Formats">
                      <option value="mp4">MP4</option>
                      <option value="webm">WebM</option>
                      <option value="avi">AVI</option>
                      <option value="mov">MOV</option>
                      <option value="mkv">MKV</option>
                      <option value="flv">FLV</option>
                      <option value="wmv">WMV</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="gif">GIF</option>
                      <option value="mp3">MP3 (Audio Only)</option>
                      <option value="wav">WAV (Audio Only)</option>
                    </optgroup>
                  </select>
                </div>

                <Button
                  onClick={handleConvert}
                  disabled={!file || status === "converting" || status === "loading"}
                  className="w-full"
                  size="lg"
                >
                  {status === "converting" ? t("converting") : t("convertVideo")}
                </Button>

                {status === "converting" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="bg-secondary h-3 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full transition-all duration-300 ease-in-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {status === "success" && (
                  <div className="rounded-md bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400">
                    <p className="font-semibold">{t("conversionComplete")}</p>
                    <p className="mt-1 break-all text-xs opacity-80">{t("savedTo")}: {output}</p>
                  </div>
                )}

                {status === "error" && (
                  <div className="rounded-md bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                    <p className="font-semibold">{t("error")}</p>
                    <p className="mt-1 text-xs opacity-80">{errorMsg}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});