/**
 * github-committer.js — Commit code modifications via GitHub Contents API.
 *
 * Applies search-and-replace modifications to files in a GitHub repo,
 * then commits the changes. Works server-side (Node.js / serverless functions).
 * Zero dependencies — uses native fetch.
 *
 * @example
 *   import { commitModifications } from 'opsagent-core/trainer'
 *
 *   const result = await commitModifications({
 *     token: process.env.GITHUB_TOKEN,
 *     owner: 'msmobileapps',
 *     repo: 'opsagent-core-js',
 *     branch: 'trainer',
 *     modifications: [{ file: 'clients/ilcf/index.html', search: 'old text', replace: 'new text' }],
 *     message: 'Trainer: update greeting message',
 *   })
 */

import { fuzzyMatch, findClosestMatch } from './fuzzy-match.js'

const GITHUB_API = 'https://api.github.com'

/**
 * Fetch a file's content and SHA from GitHub.
 *
 * @param {string} token - GitHub PAT
 * @param {string} owner - Repo owner
 * @param {string} repo  - Repo name
 * @param {string} path  - File path in repo
 * @param {string} branch - Branch name
 * @returns {Promise<{content: string, sha: string}>}
 */
async function getFileContent(token, owner, repo, path, branch) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub: failed to fetch ${path}: ${res.status} ${err.message || ''}`)
  }

  const data = await res.json()
  // GitHub returns base64-encoded content
  const content = typeof atob === 'function'
    ? atob(data.content.replace(/\n/g, ''))
    : Buffer.from(data.content, 'base64').toString('utf-8')

  return { content, sha: data.sha }
}

/**
 * Update a file on GitHub via the Contents API.
 *
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {string} path
 * @param {string} branch
 * @param {string} content - New file content
 * @param {string} sha     - Current file SHA
 * @param {string} message  - Commit message
 * @returns {Promise<{sha: string, html_url: string}>}
 */
async function updateFile(token, owner, repo, path, branch, content, sha, message) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`

  // Encode content as base64
  const encoded = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(content)))
    : Buffer.from(content, 'utf-8').toString('base64')

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: encoded,
      sha,
      branch,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub: failed to update ${path}: ${res.status} ${err.message || ''}`)
  }

  const data = await res.json()
  return {
    sha: data.commit.sha,
    html_url: data.commit.html_url,
  }
}

/**
 * Apply search-and-replace modifications to file content.
 * Uses cascading match strategies: exact → whitespace-normalized → line-fuzzy.
 *
 * @param {string} content - Original file content
 * @param {Array<{search: string, replace: string}>} mods - Modifications for this file
 * @returns {{ modified: string, applied: number, errors: string[], matchDetails: Array<{strategy: string|null, matched: boolean}> }}
 */
export function applyModifications(content, mods) {
  let modified = content
  let applied = 0
  const errors = []
  const matchDetails = []

  for (const mod of mods) {
    const result = fuzzyMatch(modified, mod.search)

    if (result.matched) {
      // Replace the matched region in the original content
      modified = modified.slice(0, result.index)
        + mod.replace
        + modified.slice(result.index + result.matchLength)
      applied++
      matchDetails.push({ strategy: result.strategy, matched: true })
    } else {
      // Find closest match for helpful error message
      const closest = findClosestMatch(modified, mod.search)
      let errMsg = `Search string not found: "${mod.search.slice(0, 80)}..."`
      if (closest) {
        errMsg += ` (closest match at line ${closest.lineNumber}, ${Math.round(closest.score * 100)}% similar)`
      }
      errors.push(errMsg)
      matchDetails.push({ strategy: null, matched: false })
    }
  }

  return { modified, applied, errors, matchDetails }
}

/**
 * Commit code modifications to a GitHub repository.
 *
 * Groups modifications by file, fetches each file, applies changes,
 * and commits. Returns commit details.
 *
 * @param {object} config
 * @param {string} config.token   - GitHub PAT
 * @param {string} config.owner   - Repo owner (e.g. 'msmobileapps')
 * @param {string} config.repo    - Repo name (e.g. 'opsagent-core-js')
 * @param {string} config.branch  - Target branch (e.g. 'trainer')
 * @param {Array<{file: string, search: string, replace: string}>} config.modifications
 * @param {string} config.message - Commit message
 * @returns {Promise<{commit: {sha: string, html_url: string}, changed_files: string[], errors: string[]}>}
 */
export async function commitModifications(config) {
  const { token, owner, repo, branch, modifications, message } = config

  if (!token) throw new Error('GitHub token is required')
  if (!modifications?.length) throw new Error('No modifications provided')

  // Group modifications by file
  const byFile = {}
  for (const mod of modifications) {
    if (!byFile[mod.file]) byFile[mod.file] = []
    byFile[mod.file].push(mod)
  }

  const changedFiles = []
  const allErrors = []
  let lastCommit = null

  // Process each file sequentially (each commit depends on previous SHA)
  for (const [filePath, mods] of Object.entries(byFile)) {
    const { content, sha } = await getFileContent(token, owner, repo, filePath, branch)
    const { modified, applied, errors } = applyModifications(content, mods)

    allErrors.push(...errors)

    if (applied > 0 && modified !== content) {
      const commitResult = await updateFile(
        token, owner, repo, filePath, branch,
        modified, sha,
        `${message} [${filePath}]`
      )
      lastCommit = commitResult
      changedFiles.push(filePath)
    }
  }

  if (!lastCommit && changedFiles.length === 0) {
    throw new Error('No modifications could be applied — search strings not found')
  }

  return {
    commit: lastCommit,
    changed_files: changedFiles,
    errors: allErrors,
  }
}
