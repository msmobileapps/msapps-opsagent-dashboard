import React, { useState, useRef, useCallback } from 'react'
import { Image, Wand2, Settings2, Download, ExternalLink, Copy, Loader2, ChevronDown, ChevronUp, Clock, Sparkles, ImageIcon } from 'lucide-react'

// ── Sample gallery (stopgap while SDXL GPU pipeline is coming online) ─────
// Source: wetransfer 4-17 drop (38 PNGs → resized to 1024px JPEGs in /public/samples/)
const SAMPLE_GALLERY = [
  ...['11','12','13','14','15','16'].map(n => `/samples/B/${n}.jpg`),
  ...['21','22','23','24','25','26','27'].map(n => `/samples/G/${n}.jpg`),
  ...['31','32','33','34','35','36'].map(n => `/samples/M/${n}.jpg`),
  ...['41','42','43','44','45','46','47','48','49','410','411','412','413','414','415','416','417','418','419'].map(n => `/samples/W/${n}.jpg`),
]

// ── Inline style/resolution data (avoids import issues with Vite) ──────────
const IMAGE_STYLES = {
  photorealistic: { label: 'Photorealistic', icon: '📷' },
  anime: { label: 'Anime', icon: '🎌' },
  'digital-art': { label: 'Digital Art', icon: '🎨' },
  'oil-painting': { label: 'Oil Painting', icon: '🖌️' },
  watercolor: { label: 'Watercolor', icon: '💧' },
  '3d-render': { label: '3D Render', icon: '🧊' },
  'pixel-art': { label: 'Pixel Art', icon: '👾' },
  sketch: { label: 'Sketch', icon: '✏️' },
  cyberpunk: { label: 'Cyberpunk', icon: '🌃' },
  minimalist: { label: 'Minimalist', icon: '◻️' },
}

const IMAGE_RESOLUTIONS = {
  '512x512': { label: '512 × 512', aspect: '1:1' },
  '768x768': { label: '768 × 768', aspect: '1:1' },
  '1024x1024': { label: '1024 × 1024', aspect: '1:1' },
  '1024x576': { label: '1024 × 576', aspect: '16:9' },
  '576x1024': { label: '576 × 1024', aspect: '9:16' },
  '768x1024': { label: '768 × 1024', aspect: '3:4' },
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SampleGallery({ onPick }) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Sample Gallery · {SAMPLE_GALLERY.length} images
        </p>
        <p className="text-[10px] text-slate-500">Preview while GPU pipeline warms up</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {SAMPLE_GALLERY.map((src) => (
          <button
            key={src}
            onClick={() => onPick?.(src)}
            className="group relative overflow-hidden rounded-lg border border-white/6 bg-white/[0.02] transition-all hover:border-white/20"
            style={{ aspectRatio: '3 / 4' }}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
          </button>
        ))}
      </div>
    </div>
  )
}

function StylePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Object.entries(IMAGE_STYLES).map(([key, { label, icon }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-xl border px-2 py-2.5 text-center transition-all ${
            value === key
              ? 'border-[var(--brand-400)]/40 bg-[var(--brand-400)]/10 text-white shadow-lg'
              : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-white'
          }`}
        >
          <span className="text-lg">{icon}</span>
          <p className="mt-1 text-[10px] font-semibold leading-tight">{label}</p>
        </button>
      ))}
    </div>
  )
}

function ResolutionPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Object.entries(IMAGE_RESOLUTIONS).map(([key, { label, aspect }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-xl border px-3 py-2 text-center transition-all ${
            value === key
              ? 'border-[var(--brand-400)]/40 bg-[var(--brand-400)]/10 text-white'
              : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-white'
          }`}
        >
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[10px] text-slate-500">{aspect}</p>
        </button>
      ))}
    </div>
  )
}

function ImageResult({ image, index }) {
  const [hovered, setHovered] = useState(false)
  const src = image.url || image.base64

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={src}
        alt={`Generated image ${index + 1}`}
        className="h-auto w-full object-cover"
        loading="lazy"
      />
      {hovered && (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3">
          <div className="flex w-full gap-2">
            <button
              onClick={() => navigator.clipboard?.writeText(src)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/25"
            >
              <Copy className="h-3.5 w-3.5" /> Copy URL
            </button>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/25"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Full Size
            </a>
          </div>
        </div>
      )}
      {image.seed != null && (
        <div className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-mono text-slate-300 backdrop-blur-sm">
          seed: {image.seed}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ImageGeneration() {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('photorealistic')
  const [resolution, setResolution] = useState('1024x1024')
  const [numImages, setNumImages] = useState(1)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [guidanceScale, setGuidanceScale] = useState(7.5)
  const [inferenceSteps, setInferenceSteps] = useState(28)
  const [seed, setSeed] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  const promptRef = useRef(null)

  const generate = useCallback(async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError(null)

    const payload = {
      prompt: prompt.trim(),
      style,
      resolution,
      numImages,
      negativePrompt: negativePrompt || undefined,
      guidanceScale,
      inferenceSteps,
      seed: seed ? parseInt(seed, 10) : undefined,
    }

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      setResult(data)
      setHistory(prev => [{ ...data, prompt: prompt.trim(), style, resolution, timestamp: Date.now() }, ...prev].slice(0, 20))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [prompt, style, resolution, numImages, negativePrompt, guidanceScale, inferenceSteps, seed, loading])

  const recallFromHistory = (entry) => {
    setPrompt(entry.prompt)
    setStyle(entry.style)
    setResolution(entry.resolution)
    setResult(entry)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="surface-panel rounded-[28px] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-500),var(--accent-500))] shadow-[0_16px_40px_rgba(108,58,237,0.25)]">
            <Image className="h-7 w-7 text-white" strokeWidth={1.8} />
          </div>
          <div>
            <p className="section-kicker">Creative Studio</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">Image Generation</h2>
            <p className="mt-1 text-sm text-slate-400">Generate visuals with FLUX / SDXL via OpsAgent</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Left: Controls */}
        <div className="space-y-5">
          {/* Prompt */}
          <div className="surface-panel rounded-[22px] p-5">
            <label className="sidebar-section-label">Prompt</label>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }}
              placeholder="Describe the image you want to create..."
              rows={3}
              maxLength={1000}
              className="mt-3 w-full resize-none rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[var(--brand-400)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--brand-400)]/20"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>{prompt.length}/1000</span>
              <span>Ctrl+Enter to generate</span>
            </div>
          </div>

          {/* Style Picker */}
          <div className="surface-panel rounded-[22px] p-5">
            <label className="sidebar-section-label">Style</label>
            <div className="mt-3">
              <StylePicker value={style} onChange={setStyle} />
            </div>
          </div>

          {/* Resolution + Count */}
          <div className="surface-panel rounded-[22px] p-5">
            <label className="sidebar-section-label">Resolution</label>
            <div className="mt-3">
              <ResolutionPicker value={resolution} onChange={setResolution} />
            </div>

            <label className="sidebar-section-label mt-5 block">Number of Images</label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setNumImages(n)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-all ${
                    numImages === n
                      ? 'border-[var(--brand-400)]/40 bg-[var(--brand-400)]/10 text-white'
                      : 'border-white/8 text-slate-400 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="surface-panel rounded-[22px] p-5">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between text-sm font-semibold text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Advanced Settings
              </span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Negative Prompt</label>
                  <input
                    value={negativePrompt}
                    onChange={e => setNegativePrompt(e.target.value)}
                    placeholder="Things to exclude..."
                    className="mt-1.5 w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[var(--brand-400)]/40 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Guidance Scale</label>
                    <input
                      type="number" min={1} max={30} step={0.5}
                      value={guidanceScale}
                      onChange={e => setGuidanceScale(parseFloat(e.target.value) || 7.5)}
                      className="mt-1.5 w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-[var(--brand-400)]/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Inference Steps</label>
                    <input
                      type="number" min={1} max={100}
                      value={inferenceSteps}
                      onChange={e => setInferenceSteps(parseInt(e.target.value, 10) || 28)}
                      className="mt-1.5 w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-[var(--brand-400)]/40 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Seed (optional)</label>
                  <input
                    value={seed}
                    onChange={e => setSeed(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Random"
                    className="mt-1.5 w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[var(--brand-400)]/40 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={generate}
            disabled={!prompt.trim() || loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[linear-gradient(135deg,var(--brand-500),var(--accent-500))] py-4 text-sm font-bold text-white shadow-[0_16px_40px_rgba(108,58,237,0.3)] transition-all hover:shadow-[0_20px_50px_rgba(108,58,237,0.4)] disabled:opacity-40 disabled:shadow-none"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Generating...</>
            ) : (
              <><Wand2 className="h-5 w-5" /> Generate Images</>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div className="space-y-5">
          {/* Generated Images */}
          <div className="surface-panel rounded-[22px] p-5">
            <label className="sidebar-section-label flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Results
            </label>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {!result && !loading && !error && (
              <div className="mt-6">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/[0.03] border border-white/6">
                    <Image className="h-10 w-10 text-slate-600" strokeWidth={1.2} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-400">No images yet</p>
                  <p className="mt-1 text-xs text-slate-500">Describe what you want and hit Generate</p>
                </div>
                <SampleGallery />
              </div>
            )}

            {loading && (
              <div className="mt-6 flex flex-col items-center justify-center py-16">
                <Loader2 className="h-12 w-12 animate-spin text-[var(--brand-400)]" />
                <p className="mt-4 text-sm font-semibold text-slate-300">Creating your images...</p>
                <p className="mt-1 text-xs text-slate-500">This may take 10-30 seconds</p>
              </div>
            )}

            {result && !loading && (
              <div className="mt-4">
                <div className={`grid gap-3 ${
                  result.images?.length === 1 ? 'grid-cols-1' :
                  result.images?.length === 2 ? 'grid-cols-2' :
                  'grid-cols-2'
                }`}>
                  {result.images?.map((img, i) => (
                    <ImageResult key={i} image={img} index={i} />
                  ))}
                </div>

                {/* Meta */}
                {result.meta && (
                  <div className="mt-4 rounded-xl border border-white/6 bg-white/[0.02] p-3">
                    <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
                      <span>Provider: <span className="font-semibold text-slate-300">{result.meta.provider}</span></span>
                      <span>Time: <span className="font-semibold text-slate-300">{result.meta.elapsedMs}ms</span></span>
                      {result.meta.params?.seed != null && (
                        <span>Seed: <span className="font-mono font-semibold text-slate-300">{result.meta.params.seed}</span></span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="surface-panel rounded-[22px] p-5">
              <label className="sidebar-section-label flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> Session History
              </label>
              <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto">
                {history.map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => recallFromHistory(entry)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] p-3 text-left transition-all hover:border-white/12 hover:bg-white/[0.04]"
                  >
                    {entry.images?.[0] && (
                      <img
                        src={entry.images[0].url || entry.images[0].base64}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-300">{entry.prompt}</p>
                      <p className="text-[10px] text-slate-500">
                        {IMAGE_STYLES[entry.style]?.label} · {entry.resolution} · {entry.images?.length} img
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
