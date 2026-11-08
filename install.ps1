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

# 2. Check Rust Toolchain (Cargo)
Write-Host "🔍 Checking Rust toolchain (cargo)..." -ForegroundColor Cyan
$cargoInstalled = $false
try {
    $cargoVersion = (cargo --version) 2>$null
    if ($cargoVersion) {
        $cargoInstalled = $true
        Write-Host "✅ Cargo detected: $cargoVersion" -ForegroundColor Green
    }
} catch {
    $cargoInstalled = $false
}

if (-not $cargoInstalled) {
    Write-Host "📦 Cargo not found. Attempting automatic installation via winget..." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install -e --id Rustlang.Rustup --accept-package-agreements --accept-source-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        Write-Host "⚡ Downloading rustup-init.exe from rustup.rs..." -ForegroundColor Yellow
        $rustupUrl = "https://win.rustup.rs/x86_64"
        $rustupPath = "$env:TEMP\rustup-init.exe"
        Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupPath
        Start-Process -FilePath $rustupPath -ArgumentList "-y --default-toolchain stable" -Wait
        Remove-Item $rustupPath -Force -ErrorAction SilentlyContinue
        $env:Path = "$HOME\.cargo\bin;" + $env:Path
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

# 4. Build or Fetch Native Rust Daemon (nexxusd.exe)
$binTarget = "$InstallDir\nexxusd.exe"

if (Test-Path "Cargo.toml") {
    Write-Host "⚡ Compiling native NeXXUs daemon via Cargo..." -ForegroundColor Cyan
    cargo build --release -p nexxusd
    Copy-Item "target\release\nexxusd.exe" $binTarget -Force
} elseif (Test-Path "target\release\nexxusd.exe") {
    Copy-Item "target\release\nexxusd.exe" $binTarget -Force
} else {
    Write-Host "📥 Cloning NeXXUs repository from GitHub..." -ForegroundColor Cyan
    $repoTemp = "$env:TEMP\nexxus-build"
    Remove-Item $repoTemp -Recurse -Force -ErrorAction SilentlyContinue
    git clone "https://github.com/$Repo.git" $repoTemp
    Push-Location $repoTemp
    cargo build --release -p nexxusd
    Copy-Item "target\release\nexxusd.exe" $binTarget -Force
    Pop-Location
}

# 5. Verify Executable
if (-not (Test-Path $binTarget)) {
    Write-Error "❌ Failed to build or locate nexxusd.exe"
}

# 6. Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
if ($currentPath -notlike "*$InstallDir*") {
    Write-Host "🔗 Adding $InstallDir to User PATH..." -ForegroundColor Cyan
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", [EnvironmentVariableTarget]::User)
    $env:Path = "$env:Path;$InstallDir"
}

# 7. Initialize Sovereign Identity
Write-Host "🔑 Initializing sovereign node identity & Onion address..." -ForegroundColor Cyan
& "$binTarget" init --dir="$DataDir"

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
    $taskAction = New-ScheduledTaskAction -Execute "$binTarget" -Argument "serve --port=$Port --data-dir=`"$DataDir`" --storage-gb=$StorageGb"
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
