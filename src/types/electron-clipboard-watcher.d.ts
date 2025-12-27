declare module "electron-clipboard-watcher" {
  import { EventEmitter } from "events";

  class ClipboardWatcher extends EventEmitter {
    constructor();
    start(): void;
    stop(): void;
    on(event: "change", listener: () => void): this;
  }

  export default ClipboardWatcher;
}
