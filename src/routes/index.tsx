import ToggleTheme from "@/components/toggle-theme";
import LangToggle from "@/components/lang-toggle";
import { createFileRoute } from "@tanstack/react-router";
import NavigationMenu from "@/components/navigation-menu";
import { useEffect, useState } from "react";
import { convertVideo } from "@/actions/media";
import { Button } from "@/components/ui/button";

function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState("mp4");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "converting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [output, setOutput] = useState("");

  useEffect(() => {
    const unsubscribe = window.media.onProgress((p) => {
      setProgress(p);
    });
    return unsubscribe;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("idle");
      setProgress(0);
      setOutput("");
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    setStatus("converting");
    setProgress(0);
    setErrorMsg("");
    try {
      // Electron exposes the full path property on File objects
      const path = window.electron.getFilePath(file);
      const result = await convertVideo(path, format);
      if (result.success) {
        setStatus("success");
        setOutput(result.outputPath);
      }
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg((e as Error).message || "Unknown error");
    } finally {
      if (status !== "success") {
         // Should we reset status? Maybe keep it as error or success
      }
    }
  };

  return (
    <>
      <NavigationMenu />
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
          <div className="text-center">
            <h1 className="font-mono text-4xl font-bold">Video Converter</h1>
            <p className="text-muted-foreground mt-2">Convert your videos to different formats</p>
          </div>

          <div className="w-full max-w-md space-y-4 rounded-lg border p-6 shadow-sm">
            <div className="grid w-full items-center gap-1.5">
              <label htmlFor="video" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Video File</label>
              <input
                id="video"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid w-full items-center gap-1.5">
               <label htmlFor="format" className="text-sm font-medium leading-none">Output Format</label>
               <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
               >
                 <option value="mp4">MP4</option>
                 <option value="webm">WebM</option>
                 <option value="avi">AVI</option>
                 <option value="mov">MOV</option>
                 <option value="gif">GIF</option>
                 <option value="mp3">MP3 (Audio)</option>
               </select>
            </div>

            <Button 
              onClick={handleConvert} 
              disabled={!file || status === "converting"} 
              className="w-full"
            >
              {status === "converting" ? "Converting..." : "Convert Video"}
            </Button>

            {status === "converting" && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-in-out" 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="rounded-md bg-green-500/10 p-4 text-sm text-green-500">
                <p className="font-bold">Conversion Complete!</p>
                <p className="mt-1 text-xs break-all">Saved to: {output}</p>
              </div>
            )}

            {status === "error" && (
               <div className="rounded-md bg-red-500/10 p-4 text-sm text-red-500">
                <p className="font-bold">Error</p>
                <p className="mt-1 text-xs">{errorMsg}</p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
             <LangToggle />
             <ToggleTheme />
          </div>
        </div>
      </div>
    </>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});