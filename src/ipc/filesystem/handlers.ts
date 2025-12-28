import { os } from "@orpc/server";
import {
  detectFileLocksInputSchema,
  forceDeleteFileInputSchema,
  type DetectFileLocksOutput,
  type ForceDeleteFileOutput,
  type IsAdminOutput,
  type SelectFileOutput,
} from "./schemas";
import execa from "execa";
import path from "path";
import fs from "fs";
import log from "electron-log";
import { dialog } from "electron";

// Determine script paths (bundled or development)
function getScriptPath(scriptName: string): string {
  // In production, scripts should be in resources/scripts
  // In development, scripts are in src/ipc/filesystem/scripts
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // In development, use the source directory
    // Go up from current working directory to find src/ipc/filesystem/scripts
    return path.join(process.cwd(), "src", "ipc", "filesystem", "scripts", scriptName);
  } else {
    // In production Electron app
    return path.join(process.resourcesPath, "scripts", scriptName);
  }
}

// Check if running as administrator (Windows only)
export const isAdmin = os.handler(async (): Promise<IsAdminOutput> => {
  const platform = process.platform;

  if (platform !== "win32") {
    return {
      isAdmin: false,
      platform,
    };
  }

  try {
    const { stdout } = await execa(
      'powershell',
      ['-Command', '"[Security.Principal.WindowsIdentity]::GetCurrent().Owner.IsWellKnown(\'BuiltInAdministratorsSid\')"'],
      { timeout: 5000 }
    );

    const isAdmin = stdout.trim().toLowerCase() === "true";
    log.info(`Admin check: ${isAdmin}`);

    return {
      isAdmin,
      platform,
    };
  } catch (error: unknown) {
    const err = error as Error;
    log.error("Failed to check admin status:", err);
    return {
      isAdmin: false,
      platform,
    };
  }
});

// Open file picker dialog
export const selectFile = os.handler(async (): Promise<SelectFileOutput> => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Select File to Delete",
      properties: ["openFile"],
      filters: [
        { name: "All Files", extensions: ["*"] }
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return {
        canceled: true,
      };
    }

    return {
      canceled: false,
      filePath: result.filePaths[0],
    };
  } catch (error: unknown) {
    const err = error as Error;
    log.error("Error in file picker:", err);
    return {
      canceled: true,
    };
  }
});

// Detect file locks using PowerShell + Restart Manager
export const detectFileLocks = os
  .input(detectFileLocksInputSchema)
  .handler(async ({ input }): Promise<DetectFileLocksOutput> => {
    const { filePath } = input;

    // Validate platform
    if (process.platform !== "win32") {
      return {
        success: false,
        filePath,
        isLocked: false,
        processes: [],
        message: "This feature is only available on Windows",
        error: "UNSUPPORTED_PLATFORM",
      };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        filePath,
        isLocked: false,
        processes: [],
        message: "File not found",
        error: "FILE_NOT_FOUND",
      };
    }

    try {
      const scriptPath = getScriptPath("detect-file-locks.ps1");

      log.info(`Detecting locks for: ${filePath}`);
      log.info(`Using script: ${scriptPath}`);

      // Execute PowerShell script
      const { stdout } = await execa(
        'powershell',
        ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-FilePath', filePath],
        {
          timeout: 30000, // 30 second timeout
        }
      );

      // Parse JSON output
      const result = JSON.parse(stdout) as DetectFileLocksOutput;
      log.info(`Detected ${result.processes.length} processes locking ${filePath}`);

      return result;
    } catch (error: unknown) {
      const err = error as { message?: string; stdout?: string };
      log.error("Error detecting file locks:", err);

      // Try to parse error output as JSON
      if (err.stdout) {
        try {
          const errorResult = JSON.parse(err.stdout);
          return errorResult;
        } catch {
          // Fall through to generic error
        }
      }

      return {
        success: false,
        filePath,
        isLocked: false,
        processes: [],
        message: err.message || "Failed to detect file locks",
        error: "SCRIPT_EXECUTION_FAILED",
      };
    }
  });

// Force delete file with optional process termination
export const forceDeleteFile = os
  .input(forceDeleteFileInputSchema)
  .handler(async ({ input }): Promise<ForceDeleteFileOutput> => {
    const { filePath, killProcessIds } = input;

    // Validate platform
    if (process.platform !== "win32") {
      return {
        success: false,
        filePath,
        deleted: false,
        killedProcesses: [],
        failedProcesses: [],
        message: "This feature is only available on Windows",
        error: "UNSUPPORTED_PLATFORM",
      };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        filePath,
        deleted: false,
        killedProcesses: [],
        failedProcesses: [],
        message: "File not found",
        error: "FILE_NOT_FOUND",
      };
    }

    try {
      const scriptPath = getScriptPath("force-delete-file.ps1");

      log.info(`Force deleting: ${filePath}`);
      log.info(`Terminating ${killProcessIds.length} process(es): ${killProcessIds.join(", ")}`);
      log.info(`Using script: ${scriptPath}`);

      // Build command arguments
      const args = ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-FilePath', filePath];

      if (killProcessIds.length > 0) {
        const pidsArg = killProcessIds.join(",");
        args.push('-ProcessIds', pidsArg);
      }

      // Execute PowerShell script
      const { stdout } = await execa('powershell', args, {
        timeout: 60000, // 60 second timeout
      });

      // Parse JSON output
      const result = JSON.parse(stdout) as ForceDeleteFileOutput;
      log.info(`Force delete result for ${filePath}:`, result);

      return result;
    } catch (error: unknown) {
      const err = error as { message?: string; stdout?: string };
      log.error("Error force deleting file:", err);

      // Try to parse error output as JSON
      if (err.stdout) {
        try {
          const errorResult = JSON.parse(err.stdout);
          return errorResult;
        } catch {
          // Fall through to generic error
        }
      }

      return {
        success: false,
        filePath,
        deleted: false,
        killedProcesses: [],
        failedProcesses: [],
        message: err.message || "Failed to force delete file",
        error: "SCRIPT_EXECUTION_FAILED",
      };
    }
  });
