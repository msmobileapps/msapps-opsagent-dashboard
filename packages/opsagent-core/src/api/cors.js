/**
 * CORS utilities — handles preflight requests and response headers.
 */

/**
 * Handle CORS preflight request.
 * Returns CORS headers for OPTIONS, or null for non-OPTIONS requests.
 */
export function handleCors(request, allowedOrigins = null) {
  const method = request.method?.toUpperCase?.() || request.method

  if (method !== 'OPTIONS') {
    return null
  }

  const origin = request.headers?.get?.('origin') || request.headers?.origin || '*'
  const allowed = allowedOrigins?.includes(origin) ? origin : '*'

  return new Response(null, {
    status: 204,
    headers: buildHeaders(allowed),
  })
}

/**
 * Build standard CORS headers.
 */
export function buildHeaders(allowedOrigin = '*') {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-API-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Create a JSON response with CORS headers.
 */
export function jsonResponse(payload, status = 200, allowedOrigin = '*') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...buildHeaders(allowedOrigin),
    },
  })
}

/**
 * Parse allowed origins from comma-separated string.
 */
export function parseAllowedOrigins(originsString) {
  if (!originsString) return null
  return originsString
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
}
