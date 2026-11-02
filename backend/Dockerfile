# The API's image, which Coolify builds and runs on the server (DEPLOYMENT.md).
# To try it locally: docker compose up --build (docker-compose.yml).
FROM python:3.14-slim

# gdal-bin: GDAL, GEOS and PROJ for GeoDjango. curl: the health check.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gdal-bin curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /usr/local/bin/uv

# The virtualenv lives outside /app so mounting the source in development
# doesn't hide it.
ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    STATIC_ROOT=/app/staticfiles

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY . .

# Settings require these, but collectstatic touches neither the database nor secrets.
RUN DJANGO_SECRET_KEY=collectstatic DATABASE_URL=postgis://collectstatic@localhost/collectstatic \
    python manage.py collectstatic --noinput

RUN useradd --uid 10001 --no-create-home app && chown -R app /app
USER app

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s \
    CMD curl -fsS http://localhost:8000/healthz || exit 1
ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "config.wsgi", "--bind", "0.0.0.0:8000", "--access-logfile", "-"]
