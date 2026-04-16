/**
 * Deterministic prompt enhancement — style-specific modifiers, no LLM calls.
 *
 * @module opsagent-core/image-generation/prompt-builder
 */

// ── Style modifiers ────────────────────────────────────────────────────────
const STYLE_MODIFIERS = {
  photorealistic: {
    prefix: 'RAW photo, ultra realistic,',
    suffix: '8K UHD, DSLR, film grain, Fujifilm XT3, sharp focus, natural lighting',
    negative: 'cartoon, painting, illustration, drawing, anime, render',
  },
  anime: {
    prefix: 'anime artwork,',
    suffix: 'studio anime, highly detailed, vibrant colors, clean lines, cel-shaded',
    negative: 'photo, realistic, 3d render, blurry, western cartoon',
  },
  'digital-art': {
    prefix: 'digital art illustration,',
    suffix: 'trending on ArtStation, highly detailed, vibrant, sharp',
    negative: 'photo, blurry, low quality, sketch',
  },
  'oil-painting': {
    prefix: 'oil painting on canvas,',
    suffix: 'masterful brushstrokes, rich texture, classical composition, dramatic lighting',
    negative: 'photo, digital, flat, anime, 3d',
  },
  watercolor: {
    prefix: 'watercolor painting,',
    suffix: 'soft washes, paper texture, gentle gradients, loose brushwork, wet-on-wet',
    negative: 'photo, sharp, digital, hard edges, 3d render',
  },
  '3d-render': {
    prefix: '3D render, cinema 4D,',
    suffix: 'octane render, volumetric lighting, subsurface scattering, high detail',
    negative: 'flat, 2d, painting, sketch, photo',
  },
  'pixel-art': {
    prefix: 'pixel art,',
    suffix: '16-bit, retro game style, clean pixels, limited palette, sprite art',
    negative: 'photo, realistic, blurry, smooth, 3d',
  },
  sketch: {
    prefix: 'pencil sketch,',
    suffix: 'graphite on paper, detailed crosshatching, tonal shading, fine lines',
    negative: 'color, photo, digital, painting, 3d',
  },
  cyberpunk: {
    prefix: 'cyberpunk scene,',
    suffix: 'neon lights, rain, reflections, holographic, dark atmosphere, blade runner style',
    negative: 'bright, natural, pastoral, cartoon, cute',
  },
  minimalist: {
    prefix: 'minimalist composition,',
    suffix: 'clean design, negative space, simple shapes, limited palette, modern',
    negative: 'cluttered, complex, detailed, busy, noisy, realistic',
  },
}

/**
 * Enhance a user prompt with style-specific modifiers.
 *
 * @param {string} prompt - Raw user prompt
 * @param {string} style - One of IMAGE_STYLES keys
 * @returns {string} Enhanced prompt
 */
export function enhancePrompt(prompt, style = 'photorealistic') {
  const mod = STYLE_MODIFIERS[style]
  if (!mod) return prompt

  return `${mod.prefix} ${prompt}, ${mod.suffix}`
}

/**
 * Merge a user's negative prompt with the style's built-in negatives.
 *
 * @param {string} userNegative - User-supplied negative prompt
 * @param {string} style - Style key
 * @returns {string} Combined negative prompt
 */
export function mergeNegativePrompts(userNegative = '', style = 'photorealistic') {
  const mod = STYLE_MODIFIERS[style]
  const base = mod?.negative || ''
  const parts = [base, userNegative].filter(Boolean)
  return parts.join(', ')
}

/**
 * Build the full generation payload ready for the adapter.
 *
 * @param {object} resolved - Fully resolved input (after applyDefaults)
 * @returns {object} Payload with enhanced prompt and merged negatives
 */
export function buildGenerationPayload(resolved) {
  return {
    prompt: enhancePrompt(resolved.prompt, resolved.style),
    negativePrompt: mergeNegativePrompts(resolved.negativePrompt, resolved.style),
    width: resolved.width,
    height: resolved.height,
    numImages: resolved.numImages,
    guidanceScale: resolved.guidanceScale,
    inferenceSteps: resolved.inferenceSteps,
    seed: resolved.seed,
  }
}
