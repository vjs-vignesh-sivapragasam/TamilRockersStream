@echo off
title VFlix Backend - Docker Build & Push

echo ==========================================
echo   VFlix Backend - Docker Build & Push
echo ==========================================
echo.

cd /d D:\Projects\TamilRockersStream\backend

if errorlevel 1 (
    echo ERROR: Could not access backend project folder.
    pause
    exit /b 1
)

echo [1/3] Checking Git status...
git status
echo.

echo [2/3] Building Docker image for ARM64...
docker buildx build --platform linux/arm64 -t vignesh28593/vflix-backend:latest --push .

if errorlevel 1 (
    echo.
    echo ERROR: Docker build/push failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Docker image pushed successfully.
echo.
echo Image:
echo vignesh28593/vflix-backend:latest
echo.
echo ==========================================
echo   DONE
echo ==========================================
pause
