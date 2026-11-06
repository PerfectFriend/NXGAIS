# ==============================================================================
# 🌌 NeXXUs Sovereign Storage Node - Windows Automated Installer (PowerShell)
#
# Quick 1-Line GitHub Installation (Run in PowerShell as Administrator):
#   irm https://raw.githubusercontent.com/PerfectFriend/NeXXus-Node/main/install.ps1 | iex
#
# Or from cloned repository:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
# ==============================================================================

[CmdletBinding()]
param (
    [string]$StorageGb = "256",
    [int]$Port = 3999,
    [string]$DataDir = "$env:ProgramData\NeXXUs",
    [string]$Repo = "PerfectFriend/NeXXus-Node",
    [switch]$InstallService = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🌌 NeXXUs Sovereign Node — Automated Windows Installer" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Administrator check
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "⚠️ Script is not running as Administrator. Some system-wide features (e.g. ProgramData service) might require elevation."
    if ($DataDir -eq "$env:ProgramData\NeXXUs") {
        $DataDir = "$HOME\.nexxus-storage"
        Write-Host "Using user directory: $DataDir" -ForegroundColor Yellow
    }
}

# 2. Check Node.js
Write-Host "🔍 Checking Node.js installation..." -ForegroundColor Cyan
$nodeInstalled = $false
try {
    $nodeVersion = (node -v) 2>$null
    if ($nodeVersion) {
        $nodeInstalled = $true
        Write-Host "✅ Node.js detected: $nodeVersion" -ForegroundColor Green
    }
} catch {
    $nodeInstalled = $false
}

if (-not $nodeInstalled) {
    Write-Host "📦 Node.js not found. Attempting automatic installation via winget..." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install nodejs-lts -y
    } else {
        Write-Host "⚡ Downloading Node.js LTS MSI package from nodejs.org..." -ForegroundColor Yellow
        $msiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
        $msiPath = "$env:TEMP\node-lts.msi"
        Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath
        Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait
        Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
    }
}

# 3. Create Directories
$InstallDir = "$env:LOCALAPPDATA\NeXXUs\bin"
if ($isAdmin) {
    $InstallDir = "$env:ProgramFiles\NeXXUs"
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$DataDir\chunks" | Out-Null
New-Item -ItemType Directory -Force -Path "$DataDir\meta" | Out-Null
New-Item -ItemType Directory -Force -Path "$DataDir\logs" | Out-Null

Write-Host "📁 Storage Directory: $DataDir ($StorageGb GB allocation)" -ForegroundColor Cyan
Write-Host "⚙️ Binary Directory:  $InstallDir" -ForegroundColor Cyan

# 4. Fetch or Build standalone daemon bundle
$bundleTarget = "$InstallDir\nexxusd.cjs"

if (Test-Path "scripts\linux-daemon.ts") {
    Write-Host "⚡ Compiling standalone bundle from local source repository..." -ForegroundColor Cyan
    npx esbuild scripts/linux-daemon.ts --bundle --platform=node --format=cjs --outfile="$bundleTarget"
} else {
    Write-Host "📥 Fetching pre-bundled NeXXUs engine from GitHub..." -ForegroundColor Cyan
    $rawUrl = "https://raw.githubusercontent.com/$Repo/main/dist/nexxusd.cjs"
    try {
        Invoke-WebRequest -Uri $rawUrl -OutFile $bundleTarget
    } catch {
        Write-Warning "Could not fetch bundle directly from main. Cloning repo..."
        git clone "https://github.com/$Repo.git" "$env:TEMP\nexxus-repo"
        Copy-Item "$env:TEMP\nexxus-repo\dist\nexxusd.cjs" $bundleTarget -Force
    }
}

# 5. Create CLI Launchers (nexxusd.cmd & nexxusd.ps1)
$cmdLauncher = "@echo off`r`nnode `"$bundleTarget`" %*"
Set-Content -Path "$InstallDir\nexxusd.cmd" -Value $cmdLauncher -Encoding ASCII

$ps1Launcher = "& node `"$bundleTarget`" `$args"
Set-Content -Path "$InstallDir\nexxusd.ps1" -Value $ps1Launcher -Encoding UTF8

# 6. Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
if ($currentPath -notlike "*$InstallDir*") {
    Write-Host "🔗 Adding $InstallDir to User PATH..." -ForegroundColor Cyan
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", [EnvironmentVariableTarget]::User)
    $env:Path = "$env:Path;$InstallDir"
}

# 7. Initialize Sovereign Identity
Write-Host "🔑 Initializing sovereign node identity & Onion address..." -ForegroundColor Cyan
& node "$bundleTarget" init --dir="$DataDir"

# 8. Create Configuration File
$configPath = "$DataDir\nexxus.conf"
$configContent = @"
# NeXXUs Sovereign Windows Storage Node Configuration
NEXXUS_HOST=0.0.0.0
NEXXUS_PORT=$Port
NEXXUS_DATA_DIR=$DataDir
NEXXUS_STORAGE_GB=$StorageGb
NEXXUS_LOG_LEVEL=info
"@
Set-Content -Path $configPath -Value $configContent -Encoding UTF8

# 9. Register Scheduled Task or Service (Optional)
if ($InstallService) {
    Write-Host "⚙️ Registering Windows Background Startup Task..." -ForegroundColor Cyan
    $taskAction = New-ScheduledTaskAction -Execute "node.exe" -Argument "`"$bundleTarget`" serve --port=$Port --dir=`"$DataDir`" --storage-gb=$StorageGb"
    $taskTrigger = New-ScheduledTaskTrigger -AtStartup
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName "NeXXUsStorageNode" -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Force | Out-Null
    Start-ScheduledTask -TaskName "NeXXUsStorageNode"
    Write-Host "✅ Background Service task 'NeXXUsStorageNode' registered and started." -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "🎉 NeXXUs Storage Node Installed Successfully on Windows!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Global Command:      nexxusd"
Write-Host "Data Directory:      $DataDir"
Write-Host "Configuration:       $configPath"
Write-Host "Listening Port:      $Port"
Write-Host ""
Write-Host "🚀 Available Commands in PowerShell / CMD:" -ForegroundColor Yellow
Write-Host "  nexxusd status                      # Check node identity, capacity and vault tier"
Write-Host "  nexxusd id                          # Display passport and Tor Onion v3 address"
Write-Host "  nexxusd serve                       # Run daemon interactively in terminal"
Write-Host "  nexxusd test-por                    # Benchmark Proof-of-Retrievability response"
Write-Host "  nexxusd peer add <IP>:3999          # Link with Ubuntu or Windows mesh node"
Write-Host "  nexxusd upload <file>               # Ingest and distribute file shards (RS 4+2)"
Write-Host "  nexxusd download <hash> <out_path>  # Reconstruct file from mesh"
Write-Host "==========================================================" -ForegroundColor Green
