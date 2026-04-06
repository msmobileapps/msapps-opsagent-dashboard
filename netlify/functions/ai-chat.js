/**
 * AI Chat API — OpsAgent conversational AI for lead analysis.
 *
 * Uses open-source models via HuggingFace Inference API (free).
 * Falls back to Gemini if HF is unavailable.
 *
 * Frontend sends: { messages: [{role, content}], leadContext: string }
 * Returns:        { response: string, provider: string }
 */
import { handleCors, jsonResponse } from './_lib/store.js'

const SYSTEM_PROMPT = `אתה OpsAgent — עוזר AI חכם לניהול לידים ומכירות עבור MSApps.
אתה מדבר בעברית, מקצועי, ישיר, ועוזר לסגור עסקאות.

התפקיד שלך:
- לנתח לידים ולהמליץ על צעדים הבאים
- לכתוב טיוטות מיילים מקצועיות בעברית
- להכין נקודות לשיחות מכירה
- לזהות סיכונים ולהמליץ על פתרונות
- לתת ניתוח מעמיק של מצב הליד

חוקים:
- תמיד ענה בעברית
- היה קצר וקולע — מקסימום 3-4 פסקאות
- השתמש באמוג'י כדי לסמן נקודות חשובות
- אם יש מידע על הליד, השתמש בו בתשובה
- תן המלצות קונקרטיות, לא כלליות
- כשמבקשים טיוטת מייל, כתוב מייל שלם ומקצועי
- כשמבקשים ניתוח סיכונים, היה כנה ומציאותי`

// Provider 1: HuggingFace (Qwen 72B — top open-source)
async function callHuggingFace(messages, leadContext) {
  const token = process.env.HF_TOKEN
  if (!token) return null

  const hfMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(leadContext ? [{ role: 'system', content: `מידע על הליד:\n${leadContext}` }] : []),
    ...messages,
  ]

  try {
    const res = await fetch(
      'https://router.huggingface.co/novita/v3/openai/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'Qwen/Qwen2.5-72B-Instruct',
          messages: hfMessages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      }
    )

    if (!res.ok) {
      console.error(`HuggingFace/Qwen error: ${res.status}`)
      return null
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (err) {
    console.error('HuggingFace/Qwen failed:', err.message)
    return null
  }
}

// Provider 2: HuggingFace (Mistral 7B — lighter fallback)
async function callHuggingFaceSmall(messages, leadContext) {
  const token = process.env.HF_TOKEN
  if (!token) return null

  const hfMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(leadContext ? [{ role: 'system', content: `מידע על הליד:\n${leadContext}` }] : []),
    ...messages,
  ]

  try {
    const res = await fetch(
      'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistralai/Mistral-7B-Instruct-v0.3',
          messages: hfMessages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      }
    )

    if (!res.ok) {
      console.error(`HuggingFace/Mistral error: ${res.status}`)
      return null
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (err) {
    console.error('HuggingFace/Mistral failed:', err.message)
    return null
  }
}

// Provider 3: Gemini (fallback — uses existing env var)
async function callGemini(messages, leadContext) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const systemInstruction = `${SYSTEM_PROMPT}\n\nמידע על הליד:\n${leadContext || 'לא זמין'}`

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    )

    if (!res.ok) {
      console.error(`Gemini error: ${res.status}`)
      return null
    }

    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch (err) {
    console.error('Gemini failed:', err.message)
    return null
  }
}

// Main handler
export default async (request) => {
  const cors = handleCors(request)
  if (cors) return cors

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const { messages, leadContext } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'Messages array is required' }, 400)
  }

  // Try providers in priority order
  const providers = [
    { name: 'HuggingFace/Qwen-72B', fn: callHuggingFace },
    { name: 'HuggingFace/Mistral-7B', fn: callHuggingFaceSmall },
    { name: 'Gemini', fn: callGemini },
  ]

  for (const provider of providers) {
    console.log(`Trying provider: ${provider.name}`)
    const result = await provider.fn(messages, leadContext)
    if (result) {
      console.log(`Success with: ${provider.name}`)
      return jsonResponse({ response: result, provider: provider.name })
    }
  }

  return jsonResponse(
    {
      error: 'All AI providers failed',
      response: '⚠️ לא הצלחתי להתחבר לשרתי AI כרגע. נסה שוב בעוד כמה שניות.',
    },
    503
  )
}

export const config = { path: '/api/ai-chat' }
