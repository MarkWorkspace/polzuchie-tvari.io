@echo off
title Snake AI Development Server

echo Starting Backend (FastAPI)...
start "Snake AI Backend" cmd /k "cd backend && call .venv\Scripts\activate.bat && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8000 --reload --reload-exclude *venv* --reload-exclude *__pycache__*"

echo Starting Frontend (Next.js)...
start "Snake AI Frontend" cmd /k "cd frontend && npm run dev"

echo ===================================================
echo Servers are starting in separate command windows...
echo Backend will be available at: http://localhost:8000
echo Frontend will be available at: http://localhost:3000 | http://192.168.3.38:3000
echo ===================================================
pause
