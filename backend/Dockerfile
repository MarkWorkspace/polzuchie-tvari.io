FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user for security
RUN useradd -m -r appuser && chown -R appuser:appuser /app
USER appuser

COPY --chown=appuser:appuser . .

# Запускаем сервер через uvicorn
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]