/**
 * Mock image provider — placeholder images for testing and dev.
 */

export function createMockProvider() {
  return {
    name: 'mock',
    models: ['mock-v1'],

    async generate({ prompt, width, height, numImages, seed }) {
      // Simulate realistic latency
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000))

      return Array.from({ length: numImages }, (_, i) => ({
        url: `https://placehold.co/${width}x${height}/1a1a2e/6c3aed?text=${encodeURIComponent(prompt.slice(0, 30))}`,
        seed: (seed || 0) + i,
      }))
    },
  }
}
