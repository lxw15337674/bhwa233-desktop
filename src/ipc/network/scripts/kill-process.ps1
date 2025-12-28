param(
    [Parameter(Mandatory=$true)]
    [int]$ProcessId
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    # Get process info before killing
    $process = Get-Process -Id $ProcessId -ErrorAction Stop

    $processName = $process.Name
    $processPath = $null

    try {
        $processPath = $process.Path
    } catch {
        # Some processes don't expose Path
    }

    # Try graceful close first
    $closed = $false
    try {
        $process.CloseMainWindow() | Out-Null
        Start-Sleep -Milliseconds 500

        # Check if process still exists
        $stillRunning = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if (-not $stillRunning) {
            $closed = $true
        }
    } catch {
        # CloseMainWindow failed, proceed to force kill
    }

    # Force kill if still running
    if (-not $closed) {
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    }

    # Verify process is terminated
    Start-Sleep -Milliseconds 200
    $stillExists = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue

    if ($stillExists) {
        throw "Process still running after termination attempt"
    }

    $result = @{
        success = $true
        pid = $ProcessId
        name = $processName
        path = $processPath
        gracefulClose = $closed
        message = "Process terminated successfully"
    }

    Write-Output ($result | ConvertTo-Json -Depth 10 -Compress)
    exit 0

} catch {
    $errorResult = @{
        success = $false
        pid = $ProcessId
        message = $_.Exception.Message
        error = "KILL_PROCESS_FAILED"
    }

    Write-Output ($errorResult | ConvertTo-Json -Depth 10 -Compress)
    exit 1
}
