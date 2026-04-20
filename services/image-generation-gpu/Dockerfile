# syntax=docker/dockerfile:1.7
# Cloud Run GPU image: Black Forest Labs FLUX.1-schnell (Apache 2.0 weights).
# Code:    https://github.com/black-forest-labs/flux (MIT-licensed).
# Weights: Pulled at build time from NON-GATED community mirrors:
#            - flux1-schnell.safetensors — Comfy-Org/flux1-schnell (byte-identical to BFL's gated copy)
#            - ae.safetensors             — Kijai/flux-fp8/flux-vae-bf16.safetensors (FLUX VAE, bf16)
#          BFL's upstream repo went behind a HuggingFace click-through gate after 2026-04-17;
#          these mirrors are Apache 2.0 and verified non-gated. No HF_TOKEN anywhere.
# Target:  NVIDIA L4 (24GB VRAM) with offload=True so T5/CLIP/AE stay on CPU and
#          cycle onto GPU on demand; FLUX transformer occupies GPU during sampling.
# Port:    8000. Endpoints: GET /health, POST /generate.

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FLUX_MODEL_NAME=flux-schnell \
    FLUX_OFFLOAD=true \
    FLUX_MODEL=/models/flux-schnell/flux1-schnell.safetensors \
    FLUX_AE=/models/flux-schnell/ae.safetensors \
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

# Clone BFL FLUX reference code and install the [torch] extras only
# (skip streamlit/gradio/tensorrt — we ship our own FastAPI wrapper).
RUN git clone --depth 1 https://github.com/black-forest-labs/flux /app/flux
WORKDIR /app/flux
RUN pip install --no-cache-dir -e ".[torch]"

# FastAPI server stack.
RUN pip install --no-cache-dir \
        fastapi==0.115.6 \
        "uvicorn[standard]==0.32.1" \
        pillow==11.0.0

# Download FLUX.1-schnell weights from non-gated community mirrors.
#   - flux1-schnell.safetensors (FP16, 23.78 GB) from Comfy-Org's public mirror
#     (byte-identical to BFL's upstream, no gating, no token).
#   - flux-vae-bf16.safetensors (FLUX autoencoder, BF16, ~160 MB) from Kijai's
#     FLUX FP8 bundle — the VAE is shared across all FLUX variants (schnell/dev/kontext/redux).
# Saved to the paths exported above as FLUX_MODEL / FLUX_AE so BFL's util.py
# `get_checkpoint_path()` short-circuits to these local files and never calls HF.
RUN mkdir -p /models/flux-schnell \
    && wget -nv --tries=3 --timeout=60 \
        -O /models/flux-schnell/flux1-schnell.safetensors \
        "https://huggingface.co/Comfy-Org/flux1-schnell/resolve/main/flux1-schnell.safetensors" \
    && wget -nv --tries=3 --timeout=60 \
        -O /models/flux-schnell/ae.safetensors \
        "https://huggingface.co/Kijai/flux-fp8/resolve/main/flux-vae-bf16.safetensors" \
    && ls -lh /models/flux-schnell/

# T5 and CLIP text encoders (~10 GB combined) are downloaded on first
# service start (via BFL's util.load_t5 / load_clip → transformers.from_pretrained).
# Those encoders are NOT gated on HF and don't require a token.
# First cold start adds ~60s; --min-instances=1 keeps at least one warm.

COPY server.py /app/server.py

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "/app/server.py"]
