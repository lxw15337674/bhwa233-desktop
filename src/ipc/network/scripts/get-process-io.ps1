param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    # Get I/O statistics for all processes
    $processes = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -ErrorAction Stop | Where-Object {
        $_.Name -ne "_Total" -and $_.Name -ne "Idle"
    }

    $ioStats = @()

    foreach ($proc in $processes) {
        # Process name might have #1, #2 suffix for multiple instances
        # We need to match it with actual PID
        $processName = $proc.Name -replace '#\d+$', ''
        $pid = $proc.IDProcess

        $ioStats += @{
            pid = [int]$pid
            name = $processName
            readBytes = [int64]$proc.IOReadBytesPerSec
            writeBytes = [int64]$proc.IOWriteBytesPerSec
            totalBytes = [int64]($proc.IOReadBytesPerSec + $proc.IOWriteBytesPerSec)
        }
    }

    $result = @{
        success = $true
        processes = $ioStats
        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        message = "Successfully retrieved I/O statistics for $($ioStats.Count) processes"
    }

    Write-Output ($result | ConvertTo-Json -Depth 10 -Compress)
    exit 0

} catch {
    $errorResult = @{
        success = $false
        processes = @()
        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        message = $_.Exception.Message
        error = "SCRIPT_EXECUTION_FAILED"
    }

    Write-Output ($errorResult | ConvertTo-Json -Depth 10 -Compress)
    exit 1
}
