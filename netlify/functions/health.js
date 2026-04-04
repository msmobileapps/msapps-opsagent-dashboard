/**
 * Health check endpoint.
 */
import { jsonResponse, handleCors } from './_lib/store.js'

export default async (request) => {
  const cors = handleCors(request)
  if (cors) return cors

  return jsonResponse({
    ok: true,
    service: 'msapps-opsagent-dashboard',
    clientId: 'msapps',
    timestamp: new Date().toISOString(),
  })
}

export const config = { path: '/api/health' }
