@echo off
REM ==============================================================================
REM 🌌 NeXXUs Sovereign Node — One-Click Windows Daemon Launcher
REM ==============================================================================

setlocal
title NeXXUs Sovereign Node Daemon

echo ==========================================================
echo 🌌 Starting NeXXUs Sovereign Node Daemon...
echo ==========================================================
echo.

where nexxusd >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] Launching global nexxusd daemon...
    nexxusd serve
) else (
    REM Check if local node_modules / scripts exist
    if exist "%~dp0dist\nexxusd.cjs" (
        echo [*] Running from local bundle dist\nexxusd.cjs...
        node "%~dp0dist\nexxusd.cjs" serve
    ) else if exist "%~dp0scripts\linux-daemon.ts" (
        echo [*] Running via tsx from scripts\linux-daemon.ts...
        npx tsx "%~dp0scripts\linux-daemon.ts" serve
    ) else (
        echo [ERROR] NeXXUs is not installed yet.
        echo Please run install.bat first!
        pause
        exit /b 1
    )
)

pause
