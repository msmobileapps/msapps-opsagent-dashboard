/**
 * Cloudflare Workers AI image provider — free-tier FLUX Schnell.
 *
 * Uses the HTTP API (not Worker bindings) so it runs anywhere.
 * Parallel generation via Promise.all for multi-image requests.
 */

export function createCFWorkersAIProvider() {
  const accountId = process.env.CF_ACCOUNT_ID
  const apiToken = process.env.CF_API_TOKEN
  const model = '@cf/black-forest-labs/flux-1-schnell'

  if (!accountId || !apiToken) {
    throw new Error('CF Workers AI requires CF_ACCOUNT_ID and CF_API_TOKEN env vars')
  }

  return {
    name: 'cf-workers-ai',
    models: [model],

    async generate({ prompt, negativePrompt, width, height, numImages, guidanceScale, inferenceSteps, seed }) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`

      const tasks = Array.from({ length: numImages }, (_, i) => {
        const imgSeed = seed != null ? seed + i : undefined
        return fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            negative_prompt: negativePrompt,
            width: Math.min(width, 1024),
            height: Math.min(height, 1024),
            num_steps: Math.min(inferenceSteps, 8), // FLUX Schnell max 8 steps
            guidance: guidanceScale,
            seed: imgSeed,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`CF Workers AI ${res.status}: ${text.slice(0, 200)}`)
          }
          // FLUX returns raw image bytes
          const buf = await res.arrayBuffer()
          const base64 = Buffer.from(buf).toString('base64')
          return { base64: `data:image/png;base64,${base64}`, seed: imgSeed }
        })
      })

      return Promise.all(tasks)
    },
  }
}
