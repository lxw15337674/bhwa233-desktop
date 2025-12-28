# force-delete-file.ps1
# Force deletes a file, optionally terminating processes first
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$false)]
    [int[]]$ProcessIds = @()
)

$ErrorActionPreference = 'Stop'

try {
    # Resolve full path
    if (-not (Test-Path -LiteralPath $FilePath)) {
        $errorObj = @{
            success = $false
            error = "FILE_NOT_FOUND"
            message = "The specified file does not exist: $FilePath"
            filePath = $FilePath
            deleted = $false
            killedProcesses = @()
            failedProcesses = @()
        }
        $errorObj | ConvertTo-Json -Depth 10 -Compress
        exit 1
    }

    $fullPath = (Resolve-Path -LiteralPath $FilePath).Path
    $killedProcesses = @()
    $failedProcesses = @()

    # Kill processes if requested
    if ($ProcessIds.Count -gt 0) {
        foreach ($pid in $ProcessIds) {
            try {
                $process = Get-Process -Id $pid -ErrorAction Stop
                $processName = $process.ProcessName

                # Try graceful close first
                $process.CloseMainWindow() | Out-Null
                Start-Sleep -Milliseconds 500

                # Force kill if still running
                if (-not $process.HasExited) {
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                }

                $killedProcesses += @{
                    pid = $pid
                    name = $processName
                    success = $true
                }
            } catch {
                $failedProcesses += @{
                    pid = $pid
                    error = $_.Exception.Message
                    success = $false
                }
            }
        }
    }

    # Attempt to delete the file
    try {
        Remove-Item -LiteralPath $fullPath -Force -ErrorAction Stop

        $output = @{
            success = $true
            filePath = $fullPath
            deleted = $true
            killedProcesses = $killedProcesses
            failedProcesses = $failedProcesses
            message = "File deleted successfully"
        }
        $output | ConvertTo-Json -Depth 10 -Compress
    } catch {
        # File deletion failed
        $output = @{
            success = $false
            error = "DELETE_FAILED"
            message = $_.Exception.Message
            filePath = $fullPath
            deleted = $false
            killedProcesses = $killedProcesses
            failedProcesses = $failedProcesses
        }
        $output | ConvertTo-Json -Depth 10 -Compress
        exit 1
    }

} catch {
    $errorObj = @{
        success = $false
        error = "UNKNOWN_ERROR"
        message = $_.Exception.Message
        filePath = $FilePath
        deleted = $false
        killedProcesses = @()
        failedProcesses = @()
        stackTrace = $_.ScriptStackTrace
    }
    $errorObj | ConvertTo-Json -Depth 10 -Compress
    exit 1
}
