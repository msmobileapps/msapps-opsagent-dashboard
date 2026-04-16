/**
 * Image generation contracts — input/output schemas, validation, defaults.
 *
 * Provider-agnostic. Every image provider (CF Workers AI, ComfyUI, mock)
 * accepts and returns these shapes.
 *
 * @module opsagent-core/image-generation/contracts
 */

// ── Style catalogue ────────────────────────────────────────────────────────
export const IMAGE_STYLES = {
  photorealistic: { label: 'Photorealistic', icon: '📷', description: 'Hyper-real photos' },
  anime: { label: 'Anime', icon: '🎌', description: 'Japanese anime style' },
  'digital-art': { label: 'Digital Art', icon: '🎨', description: 'Modern digital illustration' },
  'oil-painting': { label: 'Oil Painting', icon: '🖌️', description: 'Classical oil painting' },
  watercolor: { label: 'Watercolor', icon: '💧', description: 'Soft watercolor wash' },
  '3d-render': { label: '3D Render', icon: '🧊', description: 'Cinema 4D / Blender look' },
  'pixel-art': { label: 'Pixel Art', icon: '👾', description: 'Retro pixel aesthetic' },
  sketch: { label: 'Sketch', icon: '✏️', description: 'Pencil / charcoal sketch' },
  cyberpunk: { label: 'Cyberpunk', icon: '🌃', description: 'Neon-lit futuristic dystopia' },
  minimalist: { label: 'Minimalist', icon: '◻️', description: 'Clean, minimal composition' },
}

// ── Resolution presets ─────────────────────────────────────────────────────
export const IMAGE_RESOLUTIONS = {
  '512x512': { width: 512, height: 512, label: '512 × 512', aspect: '1:1' },
  '768x768': { width: 768, height: 768, label: '768 × 768', aspect: '1:1' },
  '1024x1024': { width: 1024, height: 1024, label: '1024 × 1024', aspect: '1:1' },
  '1024x576': { width: 1024, height: 576, label: '1024 × 576', aspect: '16:9' },
  '576x1024': { width: 576, height: 1024, label: '576 × 1024', aspect: '9:16' },
  '768x1024': { width: 768, height: 1024, label: '768 × 1024', aspect: '3:4' },
}

// ── Validation ─────────────────────────────────────────────────────────────
const MAX_PROMPT_LENGTH = 1000

/**
 * Validate an image-generation request.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateInput(input) {
  const errors = []

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be an object'] }
  }
  if (!input.prompt || typeof input.prompt !== 'string' || input.prompt.trim().length === 0) {
    errors.push('prompt is required and must be a non-empty string')
  }
  if (input.prompt && input.prompt.length > MAX_PROMPT_LENGTH) {
    errors.push(`prompt must be ≤ ${MAX_PROMPT_LENGTH} characters (got ${input.prompt.length})`)
  }
  if (input.style && !IMAGE_STYLES[input.style]) {
    errors.push(`Unknown style "${input.style}". Valid: ${Object.keys(IMAGE_STYLES).join(', ')}`)
  }
  if (input.resolution && !IMAGE_RESOLUTIONS[input.resolution]) {
    errors.push(`Unknown resolution "${input.resolution}". Valid: ${Object.keys(IMAGE_RESOLUTIONS).join(', ')}`)
  }
  if (input.numImages != null && (!Number.isInteger(input.numImages) || input.numImages < 1 || input.numImages > 4)) {
    errors.push('numImages must be an integer between 1 and 4')
  }
  if (input.guidanceScale != null && (typeof input.guidanceScale !== 'number' || input.guidanceScale < 1 || input.guidanceScale > 30)) {
    errors.push('guidanceScale must be a number between 1 and 30')
  }
  if (input.inferenceSteps != null && (!Number.isInteger(input.inferenceSteps) || input.inferenceSteps < 1 || input.inferenceSteps > 100)) {
    errors.push('inferenceSteps must be an integer between 1 and 100')
  }

  return errors.length ? { valid: false, errors } : { valid: true }
}

// ── Defaults ───────────────────────────────────────────────────────────────
/**
 * Fill in sensible defaults for missing fields.
 * Always returns a fully resolved request object.
 */
export function applyDefaults(input) {
  const resolution = input.resolution || '1024x1024'
  const res = IMAGE_RESOLUTIONS[resolution]

  return {
    prompt: input.prompt.trim(),
    negativePrompt: input.negativePrompt || '',
    style: input.style || 'photorealistic',
    resolution,
    width: res.width,
    height: res.height,
    numImages: input.numImages || 1,
    guidanceScale: input.guidanceScale ?? 7.5,
    inferenceSteps: input.inferenceSteps ?? 28,
    seed: input.seed ?? Math.floor(Math.random() * 2_147_483_647),
  }
}
