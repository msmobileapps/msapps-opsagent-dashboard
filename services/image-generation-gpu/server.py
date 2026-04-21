"""FastAPI server wrapping BFL FLUX.1-schnell for Cloud Run GPU inference.

Endpoints:
  GET  /health    — service + CUDA + model-load status
  POST /generate  — returns PNG bytes for a prompt

Model-lifecycle strategy:
  - Load T5 + CLIP + FLUX transformer + AE once at startup.
  - Because L4 has 24GB VRAM and the FLUX transformer alone is ~24GB fp16,
    we run with offload=True: T5/CLIP/model/AE live on CPU RAM and are moved
    onto the GPU sequentially for their turn in the sampling pipeline.
  - This is what BFL's own cli.py does for VRAM-constrained devices.
"""
from __future__ import annotations

import io
import os
import time
from typing import Optional

import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from flux.sampling import denoise, get_noise, get_schedule, prepare, unpack
from flux.util import configs, load_ae, load_clip, load_flow_model, load_t5

MODEL_NAME = os.environ.get("FLUX_MODEL_NAME", "flux-schnell")
OFFLOAD = os.environ.get("FLUX_OFFLOAD", "true").lower() == "true"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
PORT = int(os.environ.get("PORT", "8000"))

app = FastAPI(title="FLUX.1 inference", version="1.0")

_state: dict = {
    "t5": None, "clip": None, "model": None, "ae": None,
    "ready": False, "loading_error": None, "load_seconds": None,
}


def _load_models() -> None:
    if _state["ready"]:
        return
    if MODEL_NAME not in configs:
        raise RuntimeError(
            f"Unknown FLUX_MODEL_NAME={MODEL_NAME!r}; valid: {', '.join(configs.keys())}"
        )
    t0 = time.time()
    torch_device = torch.device(DEVICE)
    max_length = 256 if MODEL_NAME == "flux-schnell" else 512
    print(f"[flux] loading on device={DEVICE}, offload={OFFLOAD}, model={MODEL_NAME}", flush=True)
    t5 = load_t5(torch_device, max_length=max_length)
    clip = load_clip(torch_device)
    model = load_flow_model(MODEL_NAME, device="cpu" if OFFLOAD else torch_device)
    ae = load_ae(MODEL_NAME, device="cpu" if OFFLOAD else torch_device)
    _state.update({
        "t5": t5, "clip": clip, "model": model, "ae": ae,
        "ready": True, "load_seconds": round(time.time() - t0, 2),
    })
    print(f"[flux] loaded in {_state['load_seconds']}s", flush=True)


@app.on_event("startup")
def _startup() -> None:
    try:
        _load_models()
    except Exception as exc:  # noqa: BLE001
        _state["loading_error"] = f"{type(exc).__name__}: {exc}"
        print(f"[flux] startup failure: {_state['loading_error']}", flush=True)


@app.get("/health")
def health() -> dict:
    cuda = torch.cuda.is_available()
    status = "ok" if _state["ready"] else ("error" if _state["loading_error"] else "loading")
    return {
        "status": status,
        "model": MODEL_NAME,
        "offload": OFFLOAD,
        "cuda_available": cuda,
        "device_name": torch.cuda.get_device_name(0) if cuda else None,
        "device_count": torch.cuda.device_count() if cuda else 0,
        "load_seconds": _state["load_seconds"],
        "loading_error": _state["loading_error"],
    }


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000)
    width: int = Field(1024, ge=256, le=1536)
    height: int = Field(1024, ge=256, le=1536)
    steps: int = Field(4, ge=1, le=50)
    guidance: float = Field(0.0, ge=0.0, le=10.0)  # schnell ignores; dev/kontext use
    seed: Optional[int] = None


@app.post("/generate")
def generate(req: GenerateRequest) -> Response:
    if not _state["ready"]:
        raise HTTPException(
            status_code=503,
            detail=_state["loading_error"] or "model still loading",
        )
    torch_device = torch.device(DEVICE)
    width = 16 * (req.width // 16)
    height = 16 * (req.height // 16)
    seed = req.seed if req.seed is not None else int(time.time()) % (2**31)

    t0 = time.time()
    with torch.inference_mode():
        x = get_noise(1, height, width, device=torch_device,
                      dtype=torch.bfloat16, seed=seed)
        timesteps = get_schedule(
            req.steps,
            (width // 8) * (height // 8) // 4,
            shift=(MODEL_NAME != "flux-schnell"),
        )

        if OFFLOAD:
            _state["t5"].to(torch_device)
            _state["clip"].to(torch_device)
        inp = prepare(_state["t5"], _state["clip"], x, prompt=req.prompt)
        if OFFLOAD:
            _state["t5"].cpu()
            _state["clip"].cpu()
            torch.cuda.empty_cache()
            _state["model"].to(torch_device)


        x = denoise(_state["model"], **inp, timesteps=timesteps, guidance=req.guidance)

        if OFFLOAD:
            _state["model"].cpu()
            torch.cuda.empty_cache()
            _state["ae"].to(torch_device)
        x = unpack(x.float(), height, width)
        x = _state["ae"].decode(x)
        if OFFLOAD:
            _state["ae"].cpu()
            torch.cuda.empty_cache()

    elapsed = round(time.time() - t0, 2)

    # Convert BFL float tensor (values in [-1, 1]) to PNG bytes.
    from PIL import Image
    img_arr = (
        x.clamp(-1, 1).add(1).div(2).mul(255).byte().cpu()[0]
        .permute(1, 2, 0).numpy()
    )
    buf = io.BytesIO()
    Image.fromarray(img_arr).save(buf, format="PNG")
    buf.seek(0)
    headers = {
        "X-Elapsed-Seconds": str(elapsed),
        "X-Seed": str(seed),
        "X-Model": MODEL_NAME,
    }
    return Response(content=buf.getvalue(), media_type="image/png", headers=headers)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
