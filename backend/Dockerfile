# --- Build Stage ---
FROM python:3.13-slim AS builder

WORKDIR /app

# Install uv for fast dependency resolution
RUN pip install --no-cache-dir uv==0.5.24

COPY requirements.txt .

# Install dependencies into a virtualenv
RUN uv venv /app/.venv && \
    . /app/.venv/bin/activate && \
    uv pip install --no-cache -r requirements.txt

# --- Final Stage ---
FROM python:3.13-slim

WORKDIR /app

# Copy the virtualenv from the builder stage
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY . .

# Use 8080 as it is the default port for Cloud Run
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
