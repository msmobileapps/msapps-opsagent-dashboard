# syntax=docker/dockerfile:1.7
# Cloud Run GPU image: Black Forest Labs FLUX.1-schnell (Apache 2.0 weights).
# Code:    https://github.com/black-forest-labs/flux (MIT-licensed).
# Weights: https://huggingface.co/black-forest-labs/FLUX.1-schnell (Apache 2.0, NOT gated — no HF_TOKEN required).
# Target:  NVIDIA L4 (24GB VRAM) with offload=True so T5/CLIP/AE stay on CPU and
#          cycle onto GPU on demand; FLUX transformer occupies GPU during sampling.
# Port:    8000. Endpoints: GET /health, POST /generate.

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/models/huggingface \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    FLUX_MODEL=flux-schnell \
    FLUX_OFFLOAD=true \
    PORT=8000

# System deps — Python 3.11 from deadsnakes (nvidia/cuda base ships with 3.10).
RUN apt-get update && apt-get install -y --no-install-recommends \
        software-properties-common \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y --no-install-recommends \
        python3.11 python3.11-venv python3.11-dev python3-pip \
        git wget curl ca-certificates libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3

# Torch matching BFL FLUX's pinned version (torch==2.6.0) with CUDA 12.4 wheels.
RUN python -m pip install --upgrade pip \
    && pip install --no-cache-dir \
        torch==2.6.0 torchvision==0.21.0 \
        --index-url https://download.pytorch.org/whl/cu124

# Clone BFL FLUX reference code and install with the [torch] extras only
# (skip streamlit/gradio/tensorrt — we ship our own FastAPI wrapper).
RUN git clone --depth 1 https://github.com/black-forest-labs/flux /app/flux
WORKDIR /app/flux
RUN pip install --no-cache-dir -e ".[torch]"

# FastAPI server stack + accelerated HF downloads
RUN pip install --no-cache-dir \
        fastapi==0.115.6 \
        "uvicorn[standard]==0.32.1" \
        pillow==11.0.0 \
        hf_transfer==0.1.8

# Pre-download FLUX.1-schnell safetensors + autoencoder at build time so
# cold starts don't pull 24GB from HF every time an instance spins up.
# flux-schnell is Apache 2.0 and NOT gated — the HF CDN serves these
# without any token. Runtime load_flow_model / load_ae calls are cache hits.
RUN python -c "\
from huggingface_hub import hf_hub_download; \
hf_hub_download(repo_id='black-forest-labs/FLUX.1-schnell', filename='flux1-schnell.safetensors'); \
hf_hub_download(repo_id='black-forest-labs/FLUX.1-schnell', filename='ae.safetensors'); \
print('[build] flux-schnell + ae cached under', '/models/huggingface')"

# T5 and CLIP text encoders (~10GB combined) are downloaded on first
# service start rather than baked, to keep the image under Cloud Run limits.
# First cold start adds ~60s for this one-time pull; subsequent instances
# re-download (Cloud Run instances are ephemeral) — acceptable with
# --min-instances=1 to keep a warm replica.

COPY server.py /app/server.py

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "/app/server.py"]
