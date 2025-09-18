#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/flask_backend"

PYTHON_BIN="$(command -v python3 || command -v python)"

echo "Installing Flask backend dependencies (if requirements.txt exists)..."
if [ -f requirements.txt ]; then
  "$PYTHON_BIN" -m pip install --quiet --disable-pip-version-check -r requirements.txt
fi

export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"
export FLASK_ENV="${FLASK_ENV:-development}"

echo "Starting TripSync Flask Backend on ${HOST}:${PORT} ..."
exec "$PYTHON_BIN" app.py
