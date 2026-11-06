@echo off
REM ==============================================================================
REM 🌌 NeXXUs Sovereign Node — One-Click Windows Installer Wrapper
REM ==============================================================================

setlocal enabledelayedexpansion
title NeXXUs Sovereign Storage Node Installer

echo ==========================================================
echo 🌌 NeXXUs Sovereign Node — One-Click Windows Installer
echo ==========================================================
echo.

REM Check for PowerShell
where powershell >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] PowerShell is required but was not found in your PATH.
    echo Please install PowerShell 5.1 or later.
    pause
    exit /b 1
)

REM Determine script directory
set "SCRIPT_DIR=%~dp0"
set "PS1_PATH=%SCRIPT_DIR%install.ps1"

if not exist "%PS1_PATH%" (
    echo [ERROR] Cannot find install.ps1 at "%PS1_PATH%".
    echo Please make sure install.ps1 is in the same directory as install.bat.
    pause
    exit /b 1
)

echo [*] Launching NeXXUs Automated Installer via PowerShell...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1_PATH%" %*

if %errorlevel% equ 0 (
    echo.
    echo ==========================================================
    echo [SUCCESS] Installation finished successfully!
    echo ==========================================================
) else (
    echo.
    echo ==========================================================
    echo [NOTICE] Installer finished with exit code %errorlevel%.
    echo ==========================================================
)

echo.
pause
