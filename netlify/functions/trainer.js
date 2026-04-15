/**
 * trainer.js — Netlify function for the OpsAgent Trainer.
 *
 * GET  /api/trainer → Fetch source files from GitHub, parse into sections, return config
 * POST /api/trainer → Commit AI-generated modifications to GitHub (or dry-run validate)
 *
 * Environment variables:
 *   GITHUB_TOKEN      — Classic PAT with repo access
 *   GEMMA_LOCAL_URL   — Ollama-compatible endpoint (Cloud Run)
 *   GEMMA_MODEL       — Model name (default: gemma3:4b)
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

  const aiEndpoint = process.env.GEMMA_LOCAL_URL || ''
  const aiModel = process.env.GEMMA_MODEL || 'gemma3:4b'

  return jsonResponse({
    aiEndpoint,
    aiModel,
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
      return await handlePost(token, body)
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('Trainer error:', err)
    return jsonResponse({ error: err.message }, 500)
  }
}

export const config = { path: '/api/trainer' }
