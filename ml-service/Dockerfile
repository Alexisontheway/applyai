FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

# Optional embeddings (adds ~2GB). Build with:
#   docker build --build-arg WITH_EMBEDDINGS=true -t applyai-ml ./ml-service
ARG WITH_EMBEDDINGS=false
COPY requirements-embeddings.txt ./
RUN if [ "$WITH_EMBEDDINGS" = "true" ]; then pip install -r requirements-embeddings.txt; fi

COPY src/ ./src/

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -fsS http://localhost:5000/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "5000"]
