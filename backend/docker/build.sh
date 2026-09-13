#!/bin/sh
# Build the sandbox images. Run once before starting the API:
#   npm run build:images
set -e

cd "$(dirname "$0")"

for lang in python cpp java; do
  echo "==> building bytecode-$lang"
  docker build -f "Dockerfile.$lang" -t "bytecode-$lang" .
done

echo "==> done"
docker images --filter "reference=bytecode-*"
