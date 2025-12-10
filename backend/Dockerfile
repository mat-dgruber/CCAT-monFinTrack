# Base image matching the version specified in render.yaml
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .

# Copy uv from the official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Install dependencies using uv
RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

EXPOSE 8000

CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
