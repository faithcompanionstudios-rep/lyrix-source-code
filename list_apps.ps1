
Write-Host "--- Registry Apps ---"
$keys = @(
    "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

$registryApps = Get-ItemProperty $keys -ErrorAction SilentlyContinue | 
    Where-Object { $_.DisplayName -ne $null } | 
    Select-Object DisplayName, InstallLocation, EstimatedSize | 
    Sort-Object DisplayName

foreach ($app in $registryApps) {
    if ($app.InstallLocation) {
        $size = if ($app.EstimatedSize) { [math]::round($app.EstimatedSize / 1024, 2) } else { "Unknown" }
        Write-Host "$($app.DisplayName) | Location: $($app.InstallLocation) | Size: $size MB"
    }
}

Write-Host "`n--- Store Apps (Potentially Movable) ---"
Get-AppxPackage | 
    Where-Object { $_.IsFramework -eq $false -and $_.PackageFamilyName -notlike "*Microsoft.Windows*" } | 
    Select-Object Name, InstallLocation | 
    ForEach-Object {
        Write-Host "$($_.Name) | Location: $($_.InstallLocation)"
    }
