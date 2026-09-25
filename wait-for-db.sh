#!/usr/bin/env sh
set -e

host="$1"
port="$2"

echo "Waiting for database at $host:$port..."
until pg_isready -h "$host" -p "$port" >/dev/null 2>&1; do
  printf '.'
  sleep 1
done

echo "Database is ready"
