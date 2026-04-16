/**
 * Provider router — selects the active image generation backend.
 */

import { createCFWorkersAIProvider } from './cf-workers-ai.js'
import { createComfyUIProvider } from './comfyui.js'
import { createMockProvider } from './mock.js'

const PROVIDERS = {
  'cf-workers-ai': createCFWorkersAIProvider,
  comfyui: createComfyUIProvider,
  mock: createMockProvider,
}

let _cached = null

export function getProvider() {
  if (_cached) return _cached
  const name = process.env.IMAGE_PROVIDER || 'mock'
  const factory = PROVIDERS[name]
  if (!factory) throw new Error(`Unknown IMAGE_PROVIDER: ${name}. Valid: ${Object.keys(PROVIDERS).join(', ')}`)
  _cached = factory()
  return _cached
}
