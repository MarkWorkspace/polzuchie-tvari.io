# syntax=docker/dockerfile:1.7
# ROLE: Production image на Python 3.13 + uv: non-root appuser, digest-pinned bases, seeded config volume.
FROM python@sha256:ae14d4ce8771606477a81446e7ef429edd6762305fc50c84507c1041fa8285d1

COPY --from=ghcr.io/astral-sh/uv@sha256:c4f5de312ee66d46810635ffc5df34a1973ba753e7241ce3a08ef979ddd7bea5 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install runtime dependencies first to keep this layer cacheable.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

COPY . .

# Never bake a developer's live runtime config into the image.
RUN rm -f /app/config.json /app/config.json.bak

# Runtime config is seeded into a named volume from the tracked template; the
# entrypoint never overwrites an existing live config.
COPY --chmod=0755 docker-entrypoint.sh /app/docker-entrypoint.sh
COPY --chmod=0644 config.example.json config.schema-version /app/

# Run as an unprivileged user. /app/data is pre-created and owned by appuser so
# Docker copies that ownership into an empty named volume on first mount.
RUN useradd -m -r appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app
USER appuser

ENV PATH="/app/.venv/bin:$PATH" \
    CONFIG_PATH=/app/data/config.json
ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--ws-per-message-deflate", "false", "--ws-max-size", "4096", "--timeout-graceful-shutdown", "10"]
