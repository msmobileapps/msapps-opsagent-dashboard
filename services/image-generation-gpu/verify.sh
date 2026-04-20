#!/usr/bin/env bash
# Collect evidence for Trello card #12 (uYI69cff /c/gqBffCnc) acceptance criteria.
# Run AFTER deploy.sh succeeds. Outputs land in /tmp/flux-verify-* for pasting into the card.
#
# ACs covered:
#   1. nvidia-smi / CUDA device visible in Cloud Run logs        -> /tmp/flux-verify-logs.txt
#   2. GET /health returns 200 + cuda_available:true             -> /tmp/flux-verify-health.json
#   3. POST /generate returns a valid PNG >=10 KB                -> /tmp/flux-verify-test.png
#   4. Service URL                                                -> /tmp/flux-verify-url.txt
#   5. No HF/OpenAI/Anthropic/Replicate keys in env              -> /tmp/flux-verify-env-scrub.txt
#   6. (deploy-path documentation — written manually in the Trello comment)

set -euo pipefail

PROJECT="${PROJECT:-opsagent-prod}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-flux-schnell}"

echo "================================================================="
echo "[verify] Trello card #12 acceptance checks — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================================="

URL=$(gcloud run services describe "$SERVICE" \
    --project="$PROJECT" --region="$REGION" \
    --format='value(status.url)')
echo "$URL" > /tmp/flux-verify-url.txt
echo "[verify] service URL: $URL"

TOKEN=$(gcloud auth print-identity-token)

echo ""
echo "[AC 4] Service URL captured to /tmp/flux-verify-url.txt"

echo ""
echo "[AC 2] GET /health..."
HEALTH=$(curl -sS --max-time 60 -H "Authorization: Bearer $TOKEN" "$URL/health")
echo "$HEALTH" | tee /tmp/flux-verify-health.json | python3 -m json.tool || echo "$HEALTH"
CUDA_AVAILABLE=$(echo "$HEALTH" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("cuda_available"))')
DEVICE_NAME=$(echo "$HEALTH" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("device_name"))')
echo "[AC 2] cuda_available=$CUDA_AVAILABLE  device_name=$DEVICE_NAME"

echo ""
echo "[AC 1] Scanning Cloud Run logs for CUDA / L4 device evidence (last 200 lines)..."
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE AND (textPayload:\"CUDA\" OR textPayload:\"NVIDIA\" OR textPayload:\"L4\" OR textPayload:\"cuda\" OR textPayload:\"device\" OR textPayload:\"flux\")" \
  --project="$PROJECT" --limit=60 --format='value(textPayload)' \
  | tee /tmp/flux-verify-logs.txt | head -30
echo "[AC 1] (full log sample saved to /tmp/flux-verify-logs.txt)"

echo ""
echo "[AC 3] POST /generate — 'a red cube on a white table'..."
HTTP_CODE=$(curl -sS --max-time 600 -o /tmp/flux-verify-test.png -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"a red cube on a white table","steps":4,"width":1024,"height":1024,"seed":42}' \
    "$URL/generate")
echo "[AC 3] HTTP $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  SIZE=$(stat -f%z /tmp/flux-verify-test.png 2>/dev/null || stat -c%s /tmp/flux-verify-test.png)
  FILETYPE=$(file /tmp/flux-verify-test.png)
  echo "[AC 3] PNG size=${SIZE} bytes"
  echo "[AC 3] file: $FILETYPE"
else
  echo "[AC 3] FAILED — body:"
  cat /tmp/flux-verify-test.png | head -10
fi

echo ""
echo "[AC 5] Env scrub — checking Cloud Run env vars for forbidden keys..."
ENVS=$(gcloud run services describe "$SERVICE" \
    --project="$PROJECT" --region="$REGION" \
    --format='value(spec.template.spec.containers[0].env)')
echo "$ENVS" > /tmp/flux-verify-env-raw.txt
BAD=$(echo "$ENVS" | grep -iE 'hf_token|openai|anthropic_api|replicate|bfl_api_key' || true)
if [ -z "$BAD" ]; then
  echo "[AC 5] PASS — no HF_TOKEN / OpenAI / Anthropic / Replicate / BFL_API_KEY env vars set"
  echo "PASS — no forbidden keys in Cloud Run env" > /tmp/flux-verify-env-scrub.txt
else
  echo "[AC 5] FAIL — found forbidden keys:"
  echo "$BAD"
  echo "FAIL: $BAD" > /tmp/flux-verify-env-scrub.txt
fi

echo ""
echo "================================================================="
echo "[verify] done. Evidence files:"
echo "  /tmp/flux-verify-url.txt"
echo "  /tmp/flux-verify-health.json"
echo "  /tmp/flux-verify-logs.txt"
echo "  /tmp/flux-verify-test.png  (attach to Trello card #12)"
echo "  /tmp/flux-verify-env-scrub.txt"
echo "================================================================="
