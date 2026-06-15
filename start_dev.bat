:: ROLE: Скрипт запуска дев-серверов бэкенда и фронтенда. Не содержит игровой логики.
@echo off
title Snake AI Development Server

echo Starting Backend (FastAPI)...
start "Snake AI Backend" cmd /k "cd backend && call .venv\Scripts\activate.bat && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8000 --reload --reload-exclude *venv* --reload-exclude *__pycache__*"

echo Starting Frontend (Vite)...
start "Snake AI Frontend" cmd /k "cd frontend && npm run dev -- --host 0.0.0.0"

echo ===================================================
echo Servers are starting in separate command windows...
echo Backend will be available at: http://localhost:8000
echo Frontend will be available at: http://localhost:5173 ^| http://192.168.3.38:5173
echo ===================================================
pause
