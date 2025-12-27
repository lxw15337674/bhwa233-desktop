import { os } from "@orpc/server";
import { app, clipboard, nativeImage, BrowserWindow } from "electron";
import Store from "electron-store";
import path from "path";
import fs from "fs";
import {
  clipboardRecordSchema,
  getRecordsInputSchema,
  copyRecordInputSchema,
  type ClipboardRecord,
} from "./schemas";

const MAX_RECORDS = 1000;
const IMAGES_DIR = path.join(app.getPath("userData"), "clipboard-images");

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const store = new Store<{ records: ClipboardRecord[] }>({
  name: "clipboard",
  defaults: {
    records: [],
  },
});

export const getRecords = os
  .input(getRecordsInputSchema)
  .handler(({ input }) => {
    const { offset, limit, searchTerm } = input;
    let records = store.get("records", []);

    // Filter by search term (only text records)
    if (searchTerm && searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      records = records.filter(
        (record) =>
          record.type === "text" &&
          record.content.toLowerCase().includes(term)
      );
    }

    // Return paginated results
    const total = records.length;
    const paginatedRecords = records.slice(offset, offset + limit);

    return {
      records: paginatedRecords,
      total,
      hasMore: offset + limit < total,
    };
  });

export const copyRecord = os
  .input(copyRecordInputSchema)
  .handler(({ input }) => {
    const records = store.get("records", []);
    const record = records.find((r) => r.id === input.id);

    if (!record) {
      throw new Error("Record not found");
    }

    if (record.type === "text") {
      clipboard.writeText(record.content);
    } else if (record.type === "image") {
      const image = nativeImage.createFromPath(record.content);
      clipboard.writeImage(image);
    }

    return { success: true };
  });

export const clearAllRecords = os.handler(() => {
  const records = store.get("records", []);

  // Delete all image files
  records.forEach((record) => {
    if (record.type === "image" && fs.existsSync(record.content)) {
      fs.unlinkSync(record.content);
    }
  });

  // Clear store
  store.set("records", []);

  return { success: true };
});

// Helper function to add a new record (will be called by clipboard watcher)
export function addClipboardRecord(
  type: "text" | "image",
  content: string
): void {
  const records = store.get("records", []);
  const timestamp = Date.now();

  // Check for duplicates - update timestamp if content matches
  const duplicateIndex = records.findIndex(
    (r) => r.type === type && r.content === content
  );

  if (duplicateIndex !== -1) {
    // Move to front and update timestamp
    const duplicate = records[duplicateIndex];
    duplicate.timestamp = timestamp;
    records.splice(duplicateIndex, 1);
    records.unshift(duplicate);
    store.set("records", records);
    notifyClipboardUpdate();
    return;
  }

  // Create new record
  const preview =
    type === "text" ? content.substring(0, 100) : "";

  const newRecord: ClipboardRecord = {
    id: `${timestamp}-${Math.random().toString(36).substring(2, 9)}`,
    type,
    content,
    timestamp,
    preview,
  };

  // Add to front of array
  records.unshift(newRecord);

  // Enforce max records limit
  if (records.length > MAX_RECORDS) {
    const removed = records.slice(MAX_RECORDS);
    // Delete old image files
    removed.forEach((record) => {
      if (record.type === "image" && fs.existsSync(record.content)) {
        fs.unlinkSync(record.content);
      }
    });
    records.splice(MAX_RECORDS);
  }

  store.set("records", records);
  notifyClipboardUpdate();
}

// Notify all windows about clipboard update
function notifyClipboardUpdate(): void {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((win) => {
    win.webContents.send("clipboard-updated");
  });
}

// Helper function to save image and get path
export function saveClipboardImage(): string | null {
  const image = clipboard.readImage();

  if (image.isEmpty()) {
    return null;
  }

  const timestamp = Date.now();
  const id = Math.random().toString(36).substring(2, 9);
  const fileName = `${timestamp}-${id}.png`;
  const filePath = path.join(IMAGES_DIR, fileName);

  fs.writeFileSync(filePath, image.toPNG());

  return filePath;
}
