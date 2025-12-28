import { os } from "@orpc/server";
import {
  killProcessInputSchema,
  type GetListeningPortsOutput,
  type KillProcessOutput,
  type GetProcessIOOutput,
} from "./schemas";
import execa from "execa";
import path from "path";
import log from "electron-log";
import * as sudo from "@vscode/sudo-prompt";

// Determine script paths (bundled or development)
function getScriptPath(scriptName: string): string {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    return path.join(process.cwd(), "src", "ipc", "network", "scripts", scriptName);
  } else {
    return path.join(process.resourcesPath, "scripts", scriptName);
  }
}

// Helper to check admin status synchronously (for internal use)
async function checkIsAdmin(): Promise<boolean> {
  if (process.platform !== "win32") {
    return false;
  }

  try {
    const { stdout } = await execa(
      'powershell',
      ['-Command', '"[Security.Principal.WindowsIdentity]::GetCurrent().Owner.IsWellKnown(\'BuiltInAdministratorsSid\')"'],
      { timeout: 5000 }
    );

    return stdout.trim().toLowerCase() === "true";
  } catch (error) {
    return false;
  }
}

// Helper to execute PowerShell with elevated privileges
function execElevated(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sudo.exec(
      command,
      { name: 'Network Port Manager' },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout?.toString() || '');
        }
      }
    );
  });
}

// Get all listening ports (TCP + UDP)
export const getListeningPorts = os.handler(async (): Promise<GetListeningPortsOutput> => {
  log.info("=== getListeningPorts handler called ===");

  // Validate platform
  if (process.platform !== "win32") {
    log.warn("Unsupported platform:", process.platform);
    return {
      success: false,
      ports: [],
      message: "This feature is only available on Windows",
      error: "UNSUPPORTED_PLATFORM",
    };
  }

  log.info("Platform check passed: win32");

  try {
    const scriptPath = getScriptPath("get-listening-ports.ps1");
    log.info("Script path resolved:", scriptPath);

    log.info("Starting PowerShell execution...");

    // Execute PowerShell script
    const { stdout } = await execa(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      {
        timeout: 30000, // 30 second timeout
      }
    );

    log.info("PowerShell execution completed");
    log.info("Raw output length:", stdout.length);
    log.info("First 200 chars:", stdout.substring(0, 200));

    // Parse JSON output
    log.info("Attempting to parse JSON...");
    const result = JSON.parse(stdout) as GetListeningPortsOutput;
    log.info(`Successfully parsed! Retrieved ${result.ports.length} listening ports`);

    return result;
  } catch (error: unknown) {
    const err = error as { message?: string; stdout?: string };
    log.error("=== ERROR in getListeningPorts ===");
    log.error("Error message:", err.message);
    log.error("Error object:", err);

    // Try to parse error output as JSON
    if (err.stdout) {
      log.info("Error has stdout, attempting to parse...");
      try {
        const errorResult = JSON.parse(err.stdout);
        log.info("Parsed error result:", errorResult);
        return errorResult;
      } catch (parseError) {
        log.error("Failed to parse error stdout:", parseError);
      }
    }

    return {
      success: false,
      ports: [],
      message: err.message || "Failed to get listening ports",
      error: "SCRIPT_EXECUTION_FAILED",
    };
  }
});

// Kill process by PID
export const killProcess = os
  .input(killProcessInputSchema)
  .handler(async ({ input }): Promise<KillProcessOutput> => {
    const { processId } = input;

    // Validate platform
    if (process.platform !== "win32") {
      return {
        success: false,
        pid: processId,
        message: "This feature is only available on Windows",
        error: "UNSUPPORTED_PLATFORM",
      };
    }

    try {
      const scriptPath = getScriptPath("kill-process.ps1");

      log.info(`Killing process: ${processId}`);
      log.info(`Using script: ${scriptPath}`);

      // Build command arguments
      const args = ['-ExecutionPolicy', 'Bypass', '-File', `"${scriptPath}"`, '-ProcessId', processId.toString()];

      // Build full PowerShell command
      const command = `powershell ${args.join(' ')}`;

      // Check if running as admin
      const isAdminStatus = await checkIsAdmin();
      let stdout: string;

      if (isAdminStatus) {
        // Already admin, execute normally
        log.info("Running as admin, executing directly");
        const result = await execa('powershell', args.slice(1), {
          timeout: 30000,
        });
        stdout = result.stdout;
      } else {
        // Not admin, request elevation
        log.info("Not running as admin, requesting elevation via UAC");
        stdout = await execElevated(command);
      }

      // Parse JSON output
      const result = JSON.parse(stdout) as KillProcessOutput;
      log.info(`Kill process result for PID ${processId}:`, result);

      return result;
    } catch (error: unknown) {
      const err = error as { message?: string; stdout?: string };
      log.error("Error killing process:", err);

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
        pid: processId,
        message: err.message || "Failed to kill process",
        error: "SCRIPT_EXECUTION_FAILED",
      };
    }
  });

// Get process I/O statistics
export const getProcessIO = os.handler(async (): Promise<GetProcessIOOutput> => {
  log.info("=== getProcessIO handler called ===");

  // Validate platform
  if (process.platform !== "win32") {
    log.warn("Unsupported platform:", process.platform);
    return {
      success: false,
      processes: [],
      timestamp: Date.now(),
      message: "This feature is only available on Windows",
      error: "UNSUPPORTED_PLATFORM",
    };
  }

  log.info("Platform check passed: win32");

  try {
    const scriptPath = getScriptPath("get-process-io.ps1");
    log.info("Script path resolved:", scriptPath);

    log.info("Starting PowerShell execution for I/O stats...");

    // Execute PowerShell script
    const { stdout } = await execa(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      {
        timeout: 10000, // 10 second timeout
      }
    );

    log.info("PowerShell execution completed");

    // Parse JSON output
    const result = JSON.parse(stdout) as GetProcessIOOutput;
    log.info(`Successfully retrieved I/O stats for ${result.processes.length} processes`);

    return result;
  } catch (error: unknown) {
    const err = error as { message?: string; stdout?: string };
    log.error("=== ERROR in getProcessIO ===");
    log.error("Error message:", err.message);

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
      processes: [],
      timestamp: Date.now(),
      message: err.message || "Failed to get process I/O statistics",
      error: "SCRIPT_EXECUTION_FAILED",
    };
  }
});
