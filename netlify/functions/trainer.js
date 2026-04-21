/**
 * trainer.js — Netlify function for the OpsAgent Trainer.
 *
 * GET  /api/trainer → Fetch source files from GitHub, parse into sections, return config
 * POST /api/trainer → Route by action:
 *   - action: 'ai'     → Proxy AI request through CF Worker AI Gateway (zero API keys)
 *   - action: 'commit'  → Commit AI-generated modifications to GitHub
 *   - (default/legacy)  → Commit handler (backwards compat)
 *
 * Environment variables:
 *   GITHUB_TOKEN         — Classic PAT with repo access
 *   CF_AI_GATEWAY_URL    — CF Worker AI Gateway endpoint
 *   CF_AI_GATEWAY_TOKEN  — Bearer token for the gateway
 *   GEMMA_LOCAL_URL      — Legacy: direct Ollama endpoint (fallback)
 *   GEMMA_MODEL          — Model name (default: gemma3:4b)
 */
import { handleCors, jsonResponse } from './_lib/store.js'
import { commitModifications, applyModifications } from 'opsagent-core/trainer'

const GITHUB_API = 'https://api.github.com'

// ILCF defaults (first consumer — configurable via query params later)
const DEFAULTS = {
  owner: 'msmobileapps',
  repo: 'opsagent-core-js',
  branch: 'trainer',
  mainFile: 'clients/ilcf/index.html',
  backendFile: 'clients/ilcf/netlify/functions/chat.js',
}

/**
 * Fetch a file from GitHub and decode its content.
 */
async function fetchGitHubFile(token, owner, repo, path, branch) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!res.ok) {
    if (res.status === 404) return null
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub fetch ${path}: ${res.status} ${err.message || ''}`)
  }

  const data = await res.json()
  return Buffer.from(data.content, 'base64').toString('utf-8')
}

/**
 * Parse an HTML/JS file into named sections using comment markers.
 *
 * Supports multiple marker formats:
 *   // ── sectionName ──   (JS style, used in ILCF index.html)
 *   <!-- SECTION: name --> (HTML style)
 *   // === SECTION: name === (generic)
 *
 * Also extracts well-known function blocks by name as a fallback.
 */
function parseSections(content) {
  const sections = {}

  // Strategy 1: Look for JS-style section markers: // ── name ── or // ─── name ───
  const jsMarkerRegex = /\/\/\s*[─━═]+\s*(\w+)\s*[─━═]+/g
  let match
  const markers = []

  while ((match = jsMarkerRegex.exec(content)) !== null) {
    markers.push({ name: match[1], index: match.index })
  }

  // Strategy 2: HTML-style markers <!-- SECTION: name -->
  const htmlMarkerRegex = /<!--\s*SECTION:\s*(\w+)\s*-->/g
  while ((match = htmlMarkerRegex.exec(content)) !== null) {
    markers.push({ name: match[1], index: match.index })
  }

  // Strategy 3: Generic === SECTION: name === markers
  const genericMarkerRegex = /\/\/\s*===\s*SECTION:\s*(\w+)\s*===/g
  while ((match = genericMarkerRegex.exec(content)) !== null) {
    markers.push({ name: match[1], index: match.index })
  }

  // Sort markers by position and extract content between them
  markers.sort((a, b) => a.index - b.index)

  if (markers.length > 0) {
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index
      const end = i + 1 < markers.length ? markers[i + 1].index : content.length
      sections[markers[i].name] = content.slice(start, end).trim()
    }
    return sections
  }

  // Strategy 4: Extract well-known function blocks by name (ILCF-specific fallback)
  // Look for: function name(, const name =, // name section, etc.
  const knownSections = [
    'cr', 'matchResponse', 'greeting', 'quickButtons',
    'buildPrompt', 'aliases', 'emotionalTokens',
  ]

  for (const name of knownSections) {
    // Try to find function or const with this name
    const fnRegex = new RegExp(
      `((?:function\\s+${name}|const\\s+${name}|let\\s+${name}|var\\s+${name})\\s*[=(][\\s\\S]*?)(?=(?:function\\s+\\w|const\\s+\\w|let\\s+\\w|var\\s+\\w)\\s*[=(]|$)`,
      'i'
    )
    const fnMatch = content.match(fnRegex)
    if (fnMatch) {
      sections[name] = fnMatch[1].trim()
    }
  }

  // If still empty, return the entire content as a single 'main' section
  if (Object.keys(sections).length === 0) {
    sections.main = content
  }

  return sections
}

/**
 * AI proxy handler — forward AI requests through CF Worker AI Gateway.
 * The browser can't call the gateway directly (token would be exposed).
 * This function holds the token server-side and proxies the request.
 */
async function handleAiProxy(body) {
  const gatewayUrl = (process.env.CF_AI_GATEWAY_URL || '').replace(/\/+$/, '')
  const gatewayToken = process.env.CF_AI_GATEWAY_TOKEN || ''

  if (!gatewayUrl || !gatewayToken) {
    return jsonResponse({ error: 'AI gateway not configured (CF_AI_GATEWAY_URL / CF_AI_GATEWAY_TOKEN)' }, 500)
  }

  const { instruction, sections, chatJs } = body

  if (!instruction) {
    return jsonResponse({ error: 'instruction is required for AI action' }, 400)
  }

  // Build the same prompt the trainer page builds client-side
  const sectionTexts = Object.entries(sections || {})
    .map(([name, txt]) => `<section name="${name}">\n${txt}\n</section>`)
    .join('\n\n')

  const chatJsPart = chatJs
    ? `\n\n<file path="clients/ilcf/netlify/functions/chat.js">\n${chatJs}\n</file>`
    : ''

  const userContent = `You are modifying the ILCF MedInfo chatbot — a Hebrew medical information assistant for lung cancer patients in Israel.

An employee has given this instruction:
<instruction>
${instruction}
</instruction>

Here are the modifiable sections of the source files:

<file path="clients/ilcf/index.html" note="showing modifiable sections only">
${sectionTexts}
</file>${chatJsPart}

YOUR TASK: Apply the employee's instruction by modifying the code.

Return a JSON object with this structure:
{
  "summary_he": "Hebrew summary",
  "summary_en": "English summary",
  "modifications": [
    { "file": "clients/ilcf/index.html", "search": "EXACT text to find", "replace": "replacement text" }
  ]
}

RULES:
1. Each modification is a search/replace pair. The "search" must be an EXACT substring from the current file.
2. Include enough surrounding context in "search" to make it unique (at least 2-3 lines).
3. Modify ONLY what the instruction asks for.
4. All user-facing text MUST be in Hebrew. Drug names can stay in English.
5. Medical information must be accurate.
6. Preserve code structure, variable names, and formatting.
7. Return ONLY the JSON. No explanation outside the JSON.`

  const systemPrompt = 'You are a code modification assistant. You output ONLY valid JSON — no markdown, no explanation. CRITICAL RULE: The "search" field must be COPIED EXACTLY from the source code shown to you. Do NOT paraphrase, summarize, or invent text. If you cannot find the exact text to modify, return an empty modifications array.'

  try {
    const response = await fetch(`${gatewayUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        taskType: 'code-generation',
        stream: false,
        temperature: 0.1,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      return jsonResponse({ error: `AI backend error: ${response.status} ${errText.slice(0, 200)}` }, 502)
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content || ''

    // Extract JSON from the AI response
    const fenced = rawContent.match(/```json\s*([\s\S]*?)```/i)
    const jsonStr = fenced
      ? fenced[1].trim()
      : rawContent.slice(rawContent.indexOf('{'), rawContent.lastIndexOf('}') + 1)

    const parsed = JSON.parse(jsonStr)
    return jsonResponse(parsed)
  } catch (err) {
    return jsonResponse({ error: `AI proxy error: ${err.message}` }, 500)
  }
}

/**
 * GET handler — fetch files from GitHub and return parsed sections.
 */
async function handleGet(token) {
  const { owner, repo, branch, mainFile, backendFile } = DEFAULTS

  // Fetch main file and backend file in parallel
  const [mainContent, backendContent] = await Promise.all([
    fetchGitHubFile(token, owner, repo, mainFile, branch),
    fetchGitHubFile(token, owner, repo, backendFile, branch),
  ])

  if (!mainContent) {
    return jsonResponse({ error: `File not found: ${mainFile}` }, 404)
  }

  const sections = parseSections(mainContent)

  // Prefer CF Gateway (zero-API-key architecture). Fall back to legacy GEMMA_LOCAL_URL.
  const aiEndpoint = process.env.CF_AI_GATEWAY_URL || process.env.GEMMA_LOCAL_URL || ''
  // Default to gemma3:12b — pre-loaded in the Cloud Run `gemma3-12b-warm` image.
  // Defaulting to gemma3:4b would force Ollama to pull-on-first-request → slow cold start.
  const aiModel = process.env.GEMMA_MODEL || 'gemma3:12b'
  // Tell the client whether server-side AI proxy is available (so it doesn't need the token)
  const hasServerProxy = Boolean(process.env.CF_AI_GATEWAY_URL && process.env.CF_AI_GATEWAY_TOKEN)

  return jsonResponse({
    aiEndpoint,
    aiModel,
    hasServerProxy,
    sections,
    chatJs: backendContent || null,
    mainFile,
    backendFile,
    branch,
  })
}

/**
 * POST handler — commit modifications or dry-run validate.
 */
async function handlePost(token, body) {
  const { modifications, instruction, summary_he, summary_en, dryRun } = body

  if (!modifications || !Array.isArray(modifications) || modifications.length === 0) {
    return jsonResponse({ error: 'No modifications provided' }, 400)
  }

  const { owner, repo, branch, mainFile, backendFile } = DEFAULTS

  if (dryRun) {
    // Dry-run: fetch files and validate modifications without committing
    const fileContents = {}
    const uniqueFiles = [...new Set(modifications.map(m => m.file))]

    await Promise.all(
      uniqueFiles.map(async (filePath) => {
        const content = await fetchGitHubFile(token, owner, repo, filePath, branch)
        if (content) fileContents[filePath] = content
      })
    )

    const validations = modifications.map(mod => {
      const content = fileContents[mod.file]
      if (!content) {
        return { ...mod, matched: false, strategy: null, error: `File not found: ${mod.file}` }
      }
      const result = applyModifications(content, [{ search: mod.search, replace: mod.replace }])
      return {
        file: mod.file,
        search: mod.search,
        replace: mod.replace,
        matched: result.applied > 0,
        strategy: result.matchDetails?.[0]?.strategy || null,
        error: result.errors?.[0] || null,
      }
    })

    return jsonResponse({ validations, dryRun: true })
  }

  // Real commit
  const commitMessage = `Trainer: ${summary_en || instruction?.slice(0, 60) || 'code update'}`

  try {
    const result = await commitModifications({
      token,
      owner,
      repo,
      branch,
      modifications,
      message: commitMessage,
    })

    return jsonResponse({
      commit: result.commit,
      changed_files: result.changed_files,
      errors: result.errors,
      summary_he: summary_he || '',
      summary_en: summary_en || '',
    })
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

/**
 * Main handler.
 */
export default async (request) => {
  // CORS
  const cors = handleCors(request)
  if (cors) return cors

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return jsonResponse({ error: 'GITHUB_TOKEN not configured' }, 500)
  }

  try {
    if (request.method === 'GET') {
      return await handleGet(token)
    }

    if (request.method === 'POST') {
      const body = await request.json()

      // Route by action field
      if (body.action === 'ai') {
        return await handleAiProxy(body)
      }

      // Default: commit handler (action: 'commit' or legacy format with modifications)
      return await handlePost(token, body)
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('Trainer error:', err)
    return jsonResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/trainer' }
