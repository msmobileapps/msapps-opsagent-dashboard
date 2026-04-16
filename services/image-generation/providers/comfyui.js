/**
 * ComfyUI provider — self-hosted GPU inference via workflow API.
 *
 * Requires COMFYUI_BASE_URL env var pointing to a ComfyUI instance.
 * Uses the standard /prompt + /history polling pattern.
 */

export function createComfyUIProvider() {
  const baseUrl = (process.env.COMFYUI_BASE_URL || '').replace(/\/+$/, '')
  if (!baseUrl) throw new Error('ComfyUI requires COMFYUI_BASE_URL env var')

  return {
    name: 'comfyui',
    models: ['sdxl-base-1.0', 'flux-1-dev'],

    async generate({ prompt, negativePrompt, width, height, numImages, guidanceScale, inferenceSteps, seed }) {
      const workflow = buildWorkflow({ prompt, negativePrompt, width, height, numImages, guidanceScale, inferenceSteps, seed })

      // Queue the workflow
      const queueRes = await fetch(`${baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
      })
      if (!queueRes.ok) throw new Error(`ComfyUI queue failed: ${queueRes.status}`)
      const { prompt_id } = await queueRes.json()

      // Poll for completion (max 120s)
      const images = await pollForResult(baseUrl, prompt_id, 120_000)
      return images
    },
  }
}

function buildWorkflow({ prompt, negativePrompt, width, height, numImages, guidanceScale, inferenceSteps, seed }) {
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

async function pollForResult(baseUrl, promptId, maxMs) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000))
    const res = await fetch(`${baseUrl}/history/${promptId}`)
    if (!res.ok) continue
    const data = await res.json()
    const entry = data[promptId]
    if (!entry || !entry.outputs) continue

    // Find the SaveImage node output
    for (const node of Object.values(entry.outputs)) {
      if (node.images) {
        return node.images.map(img => ({
          url: `${baseUrl}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}&type=${img.type || 'output'}`,
          seed: null,
        }))
      }
    }
  }
  throw new Error('ComfyUI generation timed out')
}
