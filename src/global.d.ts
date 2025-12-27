interface Window {
  electron?: {
    getFilePath: (file: File) => string;
    onNavigate: (callback: (path: string) => void) => () => void;
    onClipboardUpdate: (callback: () => void) => () => void;
  };
  media?: {
    onProgress: (callback: (progress: number) => void) => () => void;
    onBatchProgress: (callback: (progress: any) => void) => () => void;
  };
}
