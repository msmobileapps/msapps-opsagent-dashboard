/**
 * ComfyUI provider — self-hosted GPU inference via workflow API.
 *
 * Env:
 *   COMFYUI_BASE_URL  — required, e.g. https://image-generation-gpu-xxx-uc.a.run.app
 *   COMFYUI_WORKFLOW  — 'sdxl' (default) or 'flux-schnell'
 *   COMFYUI_AUTH_TOKEN — optional bearer token (for IAM-invoker-authed Cloud Run)
 *
 * Model files expected in the ComfyUI container:
 *   sdxl          models/checkpoints/sd_xl_base_1.0.safetensors
 *   flux-schnell  models/unet/flux1-schnell.safetensors
 *                 models/clip/clip_l.safetensors
 *                 models/clip/t5xxl_fp8_e4m3fn.safetensors
 *                 models/vae/ae.safetensors
 */

export function createComfyUIProvider() {
  const baseUrl = (process.env.COMFYUI_BASE_URL || '').replace(/\/+$/, '')
  if (!baseUrl) throw new Error('ComfyUI requires COMFYUI_BASE_URL env var')
  const workflowKind = (process.env.COMFYUI_WORKFLOW || 'sdxl').toLowerCase()
  const authToken = process.env.COMFYUI_AUTH_TOKEN || null

  return {
    name: 'comfyui',
    models: ['sdxl-base-1.0', 'flux-1-schnell'],

    async generate(params) {
      const workflow =
        workflowKind === 'flux-schnell'
          ? buildFluxSchnellWorkflow(params)
          : buildSdxlWorkflow(params)

      const headers = { 'Content-Type': 'application/json' }
      if (authToken) headers.Authorization = `Bearer ${authToken}`

      const queueRes = await fetch(`${baseUrl}/prompt`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: workflow }),
      })
      if (!queueRes.ok) {
        const body = await queueRes.text()
        throw new Error(`ComfyUI queue failed ${queueRes.status}: ${body}`)
      }
      const { prompt_id } = await queueRes.json()

      return pollForResult(baseUrl, prompt_id, 180_000, headers)
    },
  }
}

function buildSdxlWorkflow({ prompt, negativePrompt, width, height, numImages, guidanceScale, inferenceSteps, seed }) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: negativePrompt || '', clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: numImages } },
    '5': { class_type: 'KSampler', inputs: {
      seed, steps: inferenceSteps, cfg: guidanceScale,
      sampler_name: 'euler', scheduler: 'normal',
      model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
    }},
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'opsagent' } },
  }
}

/**
 * FLUX.1-schnell workflow. Apache 2.0 open weights.
 * Schnell = distilled 4-step model; CFG is baked in, guidance_scale ignored,
 * negative prompt not supported. Use 4 inference steps; more = wasted compute.
 */
function buildFluxSchnellWorkflow({ prompt, width, height, numImages, seed, inferenceSteps }) {
  const steps = Math.min(Math.max(inferenceSteps || 4, 1), 8)
  return {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: 'flux1-schnell.safetensors', weight_dtype: 'fp8_e4m3fn' } },
    '2': { class_type: 'DualCLIPLoader', inputs: { clip_name1: 't5xxl_fp8_e4m3fn.safetensors', clip_name2: 'clip_l.safetensors', type: 'flux' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: numImages } },
    '6': { class_type: 'BasicGuider', inputs: { model: ['1', 0], conditioning: ['4', 0] } },
    '7': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    '8': { class_type: 'BasicScheduler', inputs: { model: ['1', 0], scheduler: 'simple', steps, denoise: 1.0 } },
    '9': { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
    '10': { class_type: 'SamplerCustomAdvanced', inputs: {
      noise: ['9', 0], guider: ['6', 0], sampler: ['7', 0], sigmas: ['8', 0], latent_image: ['5', 0],
    }},
    '11': { class_type: 'VAEDecode', inputs: { samples: ['10', 0], vae: ['3', 0] } },
    '12': { class_type: 'SaveImage', inputs: { images: ['11', 0], filename_prefix: 'opsagent-flux' } },
  }
}

async function pollForResult(baseUrl, promptId, maxMs, headers) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000))
    const res = await fetch(`${baseUrl}/history/${promptId}`, { headers })
    if (!res.ok) continue
    const data = await res.json()
    const entry = data[promptId]
    if (!entry || !entry.outputs) continue

    for (const node of Object.values(entry.outputs)) {
      if (node.images && node.images.length) {
        return node.images.map((img) => ({
          url: `${baseUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}`,
          seed: null,
        }))
      }
    }
  }
  throw new Error('ComfyUI generation timed out')
}
