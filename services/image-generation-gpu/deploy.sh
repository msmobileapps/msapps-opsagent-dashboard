#!/usr/bin/env bash
# Deploy the FLUX.1-schnell image to Cloud Run with an NVIDIA L4.
# Usage: ./deploy.sh                      (deploys :flux-schnell tag, min-instances=1)
#        TAG=<tag> ./deploy.sh            (override image tag)
#        MIN_INSTANCES=0 ./deploy.sh      (accept slow cold starts; scale-to-zero)

set -euo pipefail

PROJECT="${PROJECT:-opsagent-prod}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-flux-schnell}"
TAG="${TAG:-flux-schnell}"
IMAGE="${IMAGE:-us-central1-docker.pkg.dev/${PROJECT}/opsagent/image-generation-gpu:${TAG}}"
MIN_INSTANCES="${MIN_INSTANCES:-1}"   # keep one warm to avoid re-downloading T5/CLIP on every cold start

echo "[deploy] ${SERVICE} <- ${IMAGE} in ${REGION} (min=${MIN_INSTANCES})"

gcloud run deploy "${SERVICE}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --image="${IMAGE}" \
  --gpu=1 \
  --gpu-type=nvidia-l4 \
  --no-gpu-zonal-redundancy \
  --memory=32Gi \
  --cpu=8 \
  --no-cpu-throttling \
  --port=8000 \
  --concurrency=1 \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances=3 \
  --timeout=600s \
  --execution-environment=gen2 \
  --no-allow-unauthenticated \
  --set-env-vars=FLUX_MODEL=flux-schnell,FLUX_OFFLOAD=true,HF_HUB_ENABLE_HF_TRANSFER=1

URL=$(gcloud run services describe "${SERVICE}" \
    --project="${PROJECT}" --region="${REGION}" \
    --format='value(status.url)')
echo "[deploy] service URL: ${URL}"
echo "${URL}" > /tmp/flux-schnell-url.txt
