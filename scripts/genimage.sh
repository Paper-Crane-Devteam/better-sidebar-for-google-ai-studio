#!/usr/bin/env bash
# Text-to-image via an OpenAI-compatible /v1/images/generations gateway.
#
# DSH has no built-in image generation: its LLM seam only speaks chat/streaming
# and treats images as an *input* modality. So generation runs as a shell call.
#
# Usage:
#   IMAGE_API_KEY=sk-... scripts/genimage.sh "a red cube on white background"
#   IMAGE_API_KEY=sk-... scripts/genimage.sh "prompt" out.png 1024x1024 high
#
# Env:
#   IMAGE_API_KEY   required, gateway key
#   IMAGE_BASE_URL  default https://img.apikey.fun/v1
#   IMAGE_MODEL     default gpt-image-2

set -euo pipefail

prompt=${1:?usage: genimage.sh "<prompt>" [out.png] [size] [quality]}
out=${2:-out.png}
size=${3:-1024x1024}
quality=${4:-auto}

: "${IMAGE_API_KEY:?set IMAGE_API_KEY (do not hardcode the key)}"
base=${IMAGE_BASE_URL:-https://img.apikey.fun/v1}
model=${IMAGE_MODEL:-gpt-image-2}

body=$(PROMPT="$prompt" MODEL="$model" SIZE="$size" QUALITY="$quality" python3 -c '
import json, os
print(json.dumps({
    "model": os.environ["MODEL"],
    "prompt": os.environ["PROMPT"],
    "n": 1,
    "size": os.environ["SIZE"],
    "quality": os.environ["QUALITY"],
}))')

raw=$(mktemp -t genimage)
trap 'rm -f "$raw"' EXIT

code=$(curl -sS -m 300 -o "$raw" -w '%{http_code}' \
    "$base/images/generations" \
    -H "Authorization: Bearer $IMAGE_API_KEY" \
    -H 'Content-Type: application/json' \
    --data-binary "$body")

if [ "$code" != "200" ]; then
    printf 'request failed: HTTP %s\n' "$code" >&2
    head -c 800 "$raw" >&2
    printf '\n' >&2
    exit 1
fi

RAW="$raw" OUT="$out" python3 <<'PY'
import base64
import json
import os
import sys
import urllib.request

with open(os.environ["RAW"], encoding="utf-8") as handle:
    payload = json.load(handle)

items = payload.get("data") or []
if not items:
    sys.exit(f"no image in response: {json.dumps(payload)[:400]}")

item = items[0]
out = os.environ["OUT"]
if item.get("b64_json"):
    data = base64.b64decode(item["b64_json"])
elif item.get("url"):
    with urllib.request.urlopen(item["url"], timeout=120) as response:
        data = response.read()
else:
    sys.exit(f"unexpected item shape: {sorted(item)}")

with open(out, "wb") as handle:
    handle.write(data)

usage = payload.get("usage") or {}
print(f"wrote {out} ({len(data)} bytes)")
if usage:
    print(f"tokens: {usage.get('total_tokens')}")
PY
