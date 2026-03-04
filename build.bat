@echo off
REM Plan Switcher - Build Script for Windows
REM
REM This script builds standalone executables

echo ==========================================
echo   Plan Switcher - Build Script
echo ==========================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18+
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js version: %NODE_VERSION%
echo.

REM Install dependencies
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install --legacy-peer-deps
    echo.
)

REM Create output directory
if not exist "dist" mkdir dist

REM Build target
set TARGET=%1
if "%TARGET%"=="" set TARGET=all

echo 🔨 Building for: %TARGET%
echo.

if "%TARGET%"=="win" (
    call npm run build:win
) else if "%TARGET%"=="linux" (
    call npm run build:linux
) else if "%TARGET%"=="mac" (
    call npm run build:mac
) else (
    call npm run build:all
)

echo.
echo ==========================================
echo   ✅ Build completed!
echo ==========================================
echo.
echo Output files in dist\:
dir /b dist\ 2>nul
echo.
echo To run:
echo   Windows: dist\plan-switcher-win.exe
