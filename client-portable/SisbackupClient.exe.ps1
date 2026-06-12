# Sisbackup Portable Client Launcher v2.7.0
# Cara pakai: Klik kanan → "Run with PowerShell" atau jalankan dari terminal

$Host.UI.RawUI.WindowTitle = "Sisbackup Client"

# Detect script location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = Get-Location }

$UIPath = Join-Path $ScriptDir "ui"
$RclonePath = Join-Path $ScriptDir "rclone\rclone.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Sisbackup Client v2.7.0" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check rclone
if (-not (Test-Path $RclonePath)) {
    Write-Host "rclone tidak ditemukan. Download otomatis..." -ForegroundColor Yellow
    $rcloneZip = "$ScriptDir\rclone.zip"
    Invoke-WebRequest -Uri "https://downloads.rclone.org/rclone-current-windows-amd64.zip" -OutFile $rcloneZip
    Expand-Archive $rcloneZip -DestinationPath "$ScriptDir\rclone-temp" -Force
    $extracted = Get-ChildItem "$ScriptDir\rclone-temp" -Directory | Select-Object -First 1
    Copy-Item "$($extracted.FullName)\rclone.exe" $RclonePath -Force
    Remove-Item $rcloneZip, "$ScriptDir\rclone-temp" -Recurse -Force
    Write-Host "rclone terinstall!" -ForegroundColor Green
}

# Start local web server for the UI
Write-Host "Starting Sisbackup Client UI..." -ForegroundColor Yellow

# Create a simple HTTP server using PowerShell
$Listener = [System.Net.HttpListener]::new()
$Listener.Prefixes.Add("http://localhost:1420/")
try { $Listener.Start() } catch {
    Write-Host "Port 1420 sudah dipakai. Mencoba port 1421..." -ForegroundColor Yellow
    $Listener = [System.Net.HttpListener]::new()
    $Listener.Prefixes.Add("http://localhost:1421/")
    $Listener.Start()
    $port = 1421
}
if (-not $port) { $port = 1420 }

Write-Host "  UI: http://localhost:$port" -ForegroundColor White
Write-Host "  Close this window to exit" -ForegroundColor Gray

# Background: serve static files
$Runspace = [RunspaceFactory]::CreateRunspace()
$Runspace.Open()
$Runspace.SessionStateProxy.SetVariable("Listener", $Listener)
$Runspace.SessionStateProxy.SetVariable("UIPath", $UIPath)
$null = [PowerShell]::Create().AddScript({
    while ($Listener.IsListening) {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response

        $FilePath = $Request.Url.LocalPath
        if ($FilePath -eq "/") { $FilePath = "/index.html" }
        $FullPath = Join-Path $UIPath $FilePath.TrimStart("/")

        if (Test-Path $FullPath) {
            $Content = [System.IO.File]::ReadAllBytes($FullPath)
            $Response.ContentType = if ($FilePath -like "*.js") { "text/javascript" }
                elseif ($FilePath -like "*.css") { "text/css" }
                elseif ($FilePath -like "*.html") { "text/html" }
                elseif ($FilePath -like "*.png") { "image/png" }
                else { "application/octet-stream" }
            $Response.OutputStream.Write($Content, 0, $Content.Length)
        } else {
            $Response.StatusCode = 404
        }
        $Response.Close()
    }
}).BeginInvoke()

# Open browser
Start-Process "http://localhost:$port"

# Keep alive
Write-Host "Press Ctrl+C to exit" -ForegroundColor Yellow
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    $Listener.Stop()
    $Runspace.Close()
}
