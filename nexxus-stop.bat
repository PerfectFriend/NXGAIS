@echo off
REM ==============================================================================
REM 🌌 NeXXUs Sovereign Node — One-Click Windows Daemon Stop Script
REM ==============================================================================

setlocal
title Stopping NeXXUs Daemon

echo ==========================================================
echo 🛑 Stopping NeXXUs Sovereign Node Daemon...
echo ==========================================================
echo.

taskkill /F /FI "WINDOWTITLE eq NeXXUs Sovereign Node Daemon*" >nul 2>nul
taskkill /F /IM "nexxusd.exe" >nul 2>nul

echo [*] NeXXUs background processes terminated.
echo.
timeout /t 2 >nul
