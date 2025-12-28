param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Cache all services once at the start (much faster than querying per process)
$allServices = @{}
try {
    Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | ForEach-Object {
        $allServices[$_.ProcessId] = $true
    }
} catch {
    # Fallback to WMI if CIM fails
    Get-WmiObject Win32_Service -ErrorAction SilentlyContinue | ForEach-Object {
        $allServices[$_.ProcessId] = $true
    }
}

function Get-ProcessInfo {
    param([int]$ProcessId)

    try {
        $proc = Get-Process -Id $ProcessId -ErrorAction Stop
        $path = $null
        $canTerminate = $true
        $isService = $false

        try {
            $path = $proc.Path
        } catch {
            # Some processes don't expose Path
        }

        # Check if it's a service (using cached lookup)
        if ($allServices.ContainsKey($ProcessId)) {
            $isService = $true
            $canTerminate = $false
        }

        # Check if it's a system process
        if ($proc.Name -eq "System" -or $ProcessId -eq 4 -or $ProcessId -eq 0) {
            $canTerminate = $false
        }

        return @{
            pid = $ProcessId
            name = $proc.Name
            path = $path
            canTerminate = $canTerminate
            isService = $isService
        }
    } catch {
        return @{
            pid = $ProcessId
            name = "Unknown"
            path = $null
            canTerminate = $false
            isService = $false
            error = $_.Exception.Message
        }
    }
}

try {
    # Get TCP listening connections
    $tcpConnections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, LocalAddress, OwningProcess

    # Get UDP endpoints
    $udpEndpoints = Get-NetUDPEndpoint -ErrorAction SilentlyContinue | Select-Object LocalPort, LocalAddress, OwningProcess

    # Group by port and protocol
    $portsMap = @{}

    # Process TCP connections
    foreach ($conn in $tcpConnections) {
        $key = "TCP:$($conn.LocalPort)"

        if (-not $portsMap.ContainsKey($key)) {
            $portsMap[$key] = @{
                port = $conn.LocalPort
                protocol = "TCP"
                addresses = @()
                pid = $conn.OwningProcess
            }
        }

        # Add address if not already present
        if ($portsMap[$key].addresses -notcontains $conn.LocalAddress) {
            $portsMap[$key].addresses += $conn.LocalAddress
        }
    }

    # Process UDP endpoints
    foreach ($endpoint in $udpEndpoints) {
        $key = "UDP:$($endpoint.LocalPort)"

        if (-not $portsMap.ContainsKey($key)) {
            $portsMap[$key] = @{
                port = $endpoint.LocalPort
                protocol = "UDP"
                addresses = @()
                pid = $endpoint.OwningProcess
            }
        }

        # Add address if not already present
        if ($portsMap[$key].addresses -notcontains $endpoint.LocalAddress) {
            $portsMap[$key].addresses += $endpoint.LocalAddress
        }
    }

    # Build final port list with process info
    $ports = @()

    foreach ($key in $portsMap.Keys) {
        $portData = $portsMap[$key]
        $processInfo = Get-ProcessInfo -ProcessId $portData.pid

        $ports += @{
            port = $portData.port
            protocol = $portData.protocol
            addresses = $portData.addresses
            process = $processInfo
        }
    }

    # Sort by port number
    $ports = $ports | Sort-Object -Property port

    # Output as JSON
    $result = @{
        success = $true
        ports = $ports
        message = "Successfully retrieved $($ports.Count) listening ports"
    }

    Write-Output ($result | ConvertTo-Json -Depth 10 -Compress)
    exit 0

} catch {
    $errorResult = @{
        success = $false
        ports = @()
        message = $_.Exception.Message
        error = "SCRIPT_EXECUTION_FAILED"
    }

    Write-Output ($errorResult | ConvertTo-Json -Depth 10 -Compress)
    exit 1
}
