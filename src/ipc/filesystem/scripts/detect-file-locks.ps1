# detect-file-locks.ps1
# Detects processes locking a file using Windows Restart Manager API
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

$ErrorActionPreference = 'Stop'

# P/Invoke C# code to access Restart Manager API
$rstrtMgrCode = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class RestartManager {
    [StructLayout(LayoutKind.Sequential)]
    public struct RM_UNIQUE_PROCESS {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string strServiceShortName;
        public int ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)]
        public bool bRestartable;
    }

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    public static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    public static extern int RmEndSession(uint pSessionHandle);

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    public static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames,
        uint nApplications, RM_UNIQUE_PROCESS[] rgApplications, uint nServices, string[] rgsServiceNames);

    [DllImport("rstrtmgr.dll")]
    public static extern int RmGetList(uint dwSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo,
        [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);

    public const int CCH_RM_MAX_APP_NAME = 255;
    public const int CCH_RM_MAX_SVC_NAME = 63;
    public const int RM_INVALID_SESSION = -1;
}
"@

try {
    # Resolve full path
    if (-not (Test-Path -LiteralPath $FilePath)) {
        $errorObj = @{
            success = $false
            error = "FILE_NOT_FOUND"
            message = "The specified file does not exist: $FilePath"
            filePath = $FilePath
            isLocked = $false
            processes = @()
        }
        $errorObj | ConvertTo-Json -Depth 10 -Compress
        exit 1
    }

    $fullPath = (Resolve-Path -LiteralPath $FilePath).Path

    # Add the Restart Manager type
    Add-Type -TypeDefinition $rstrtMgrCode -ErrorAction Stop

    # Start a Restart Manager session
    $sessionHandle = 0
    $result = [RestartManager]::RmStartSession([ref]$sessionHandle, 0, [Guid]::NewGuid().ToString())

    if ($result -ne 0) {
        throw "Failed to start Restart Manager session. Error code: $result"
    }

    try {
        # Register the file resource
        $resources = @($fullPath)
        $result = [RestartManager]::RmRegisterResources($sessionHandle, $resources.Length, $resources, 0, $null, 0, $null)

        if ($result -ne 0) {
            throw "Failed to register file resource. Error code: $result"
        }

        # Get the list of processes
        $pnProcInfoNeeded = 0
        $pnProcInfo = 0
        $lpdwRebootReasons = 0

        # First call to get count
        $result = [RestartManager]::RmGetList($sessionHandle, [ref]$pnProcInfoNeeded, [ref]$pnProcInfo, $null, [ref]$lpdwRebootReasons)

        if ($pnProcInfoNeeded -eq 0) {
            # No processes locking the file
            $output = @{
                success = $true
                filePath = $fullPath
                isLocked = $false
                processes = @()
                message = "File is not locked by any processes"
            }
            $output | ConvertTo-Json -Depth 10 -Compress
            return
        }

        # Allocate array for process info
        $processInfo = New-Object RestartManager+RM_PROCESS_INFO[] $pnProcInfoNeeded
        $pnProcInfo = $pnProcInfoNeeded

        # Second call to get actual data
        $result = [RestartManager]::RmGetList($sessionHandle, [ref]$pnProcInfoNeeded, [ref]$pnProcInfo, $processInfo, [ref]$lpdwRebootReasons)

        if ($result -ne 0 -and $result -ne 234) { # 234 = ERROR_MORE_DATA (acceptable)
            throw "Failed to get process list. Error code: $result"
        }

        # Build process list
        $processes = @()
        for ($i = 0; $i -lt $pnProcInfo; $i++) {
            $proc = $processInfo[$i]
            $pid = $proc.Process.dwProcessId

            try {
                $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($process) {
                    $processes += @{
                        pid = $pid
                        name = $process.ProcessName
                        path = $process.Path
                        appName = $proc.strAppName
                        canTerminate = $true
                        isService = ($proc.strServiceShortName -and $proc.strServiceShortName.Trim().Length -gt 0)
                        serviceName = $proc.strServiceShortName
                    }
                } else {
                    # Process exists according to RM but we can't get details
                    $processes += @{
                        pid = $pid
                        name = $proc.strAppName
                        path = $null
                        appName = $proc.strAppName
                        canTerminate = $false
                        isService = ($proc.strServiceShortName -and $proc.strServiceShortName.Trim().Length -gt 0)
                        serviceName = $proc.strServiceShortName
                    }
                }
            } catch {
                $processes += @{
                    pid = $pid
                    name = $proc.strAppName
                    path = $null
                    appName = $proc.strAppName
                    canTerminate = $false
                    isService = $false
                    serviceName = $null
                    error = $_.Exception.Message
                }
            }
        }

        $output = @{
            success = $true
            filePath = $fullPath
            isLocked = ($processes.Count -gt 0)
            processes = $processes
            message = "Found $($processes.Count) process(es) locking the file"
        }
        $output | ConvertTo-Json -Depth 10 -Compress

    } finally {
        # Always end the session
        [RestartManager]::RmEndSession($sessionHandle) | Out-Null
    }

} catch {
    $errorObj = @{
        success = $false
        error = "UNKNOWN_ERROR"
        message = $_.Exception.Message
        filePath = $FilePath
        isLocked = $false
        processes = @()
        stackTrace = $_.ScriptStackTrace
    }
    $errorObj | ConvertTo-Json -Depth 10 -Compress
    exit 1
}
