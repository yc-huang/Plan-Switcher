#!/bin/bash

# Plan Switcher - Build Script
# 
# This script builds standalone executables
# Build output is in dist/ directory

set -e

echo "=========================================="
echo "  Plan Switcher - Build Script"
echo "=========================================="
echo ""

# Enter project directory
cd "$(dirname "$0")"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --legacy-peer-deps
    echo ""
fi

# Create output directory
mkdir -p dist

# Build target
TARGETS=${1:-"all"}

echo "🔨 Building for: $TARGETS"
echo ""

case "$TARGETS" in
    linux)
        npm run build:linux
        ;;
    mac|macos)
        npm run build:mac
        ;;
    win|windows)
        npm run build:win
        ;;
    all)
        npm run build:all
        ;;
    *)
        echo "Unknown target: $TARGETS"
        echo "Usage: $0 [linux|mac|win|all]"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "  ✅ Build completed!"
echo "=========================================="
echo ""
echo "Output files in dist/:"
ls -la dist/ 2>/dev/null || echo "  (empty)"
echo ""
echo "To run:"
echo "  Linux/macOS: ./dist/plan-switcher-<platform>"
echo "  Windows:     dist\\plan-switcher-win.exe"
