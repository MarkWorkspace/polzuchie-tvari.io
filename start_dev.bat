:: ROLE: Запускает backend и frontend в dev-режиме. Не содержит игровой логики.
@echo off
title Snake AI Development Server

:: Load environment variables from .env file
if exist .env (
    for /f "usebackq tokens=*" %%i in (`findstr /v /r "^#" .env`) do set %%i
)

where uv >nul 2>nul
if errorlevel 1 (
    echo [ERROR] uv not found. Install it from https://docs.astral.sh/uv/
    pause
    exit /b 1
)

echo Starting Backend (FastAPI)...
start "Snake AI Backend" cmd /k "cd backend && uv sync && uv run --frozen uvicorn server:app --host 0.0.0.0 --port 8000 --reload --reload-exclude *venv* --reload-exclude *__pycache__*"

echo Starting Frontend (Vite)...
start "Snake AI Frontend" cmd /k "cd frontend && (if not exist node_modules npm ci) && npm run dev:host"

echo ===================================================
echo Servers are starting in separate command windows...
echo Backend will be available at: http://localhost:8000
echo Frontend will be available at: http://localhost:5173 ^| http://192.168.3.38:5173
echo ===================================================
pause
