/**
 * trainer-config.ilcf.js — ILCF MedInfo trainer configuration.
 *
 * This is the first consumer of the generic trainer engine.
 * Contains ILCF-specific section keywords, prompt rules, and repo info.
 *
 * @example
 *   import { createTrainerEngine } from 'opsagent-core/trainer'
 *   import { createIlcfConfig } from 'opsagent-core/trainer/config-ilcf'
 *
 *   const config = createIlcfConfig({
 *     aiEndpoint: process.env.GEMMA_LOCAL_URL,
 *     aiModel: process.env.GEMMA_MODEL || 'gemma3:4b',
 *     githubToken: process.env.GITHUB_TOKEN,
 *   })
 *   const engine = createTrainerEngine(config)
 */

/**
 * ILCF-specific section keywords.
 * Maps section names in index.html to Hebrew + English trigger keywords.
 */
export const ILCF_SECTION_KEYWORDS = {
  cr: [
    'response', 'תגובה', 'תשובה', 'keytruda', 'drug', 'תרופה', 'treatment',
    'טיפול', 'topic', 'נושא', 'canned', 'cr', 'מידע', 'cancer', 'סרטן',
    'radiation', 'הקרנות', 'chemo', 'כימותרפיה', 'immunotherapy', 'אימונותרפיה',
    'side effect', 'תופעות', 'symptom', 'תסמין', 'opdivo', 'tecentriq',
    'pembrolizumab', 'ניבולומאב', 'clinical trial', 'מחקר קליני', 'תוסיפי נושא',
    'עדכון שאלון', 'add topic', 'new topic', 'נושא חדש',
  ],
  matchResponse: [
    'keyword', 'match', 'התאמה', 'זיהוי', 'matching', 'מילת מפתח',
    'trigger', 'recognize', 'detect', 'pattern',
  ],
  greeting: [
    'greeting', 'ברכה', 'פתיחה', 'welcome', 'שלום', 'הודעת פתיחה',
    'opening', 'first message', 'הודעה ראשונה', 'מזמינה', 'פורמלית',
  ],
  quickButtons: [
    'button', 'כפתור', 'quick', 'מהיר', 'toolbar', 'כפתורים', 'shortcut',
  ],
  buildPrompt: [
    'prompt', 'system', 'מערכת', 'הוראה', 'פרומפט', 'system prompt',
    'persona', 'behavior', 'התנהגות', 'tone', 'טון', 'style', 'סגנון',
    'אמפתית', 'נינוחה', 'רכה', 'empathy', 'warm', 'formal',
  ],
  aliases: [
    'alias', 'כינוי', 'synonym', 'aliases', 'שם חלופי', 'name', 'abbreviation',
  ],
  emotionalTokens: [
    'emotion', 'רגש', 'תמיכה', 'emotional', 'empathy', 'רגשי', 'support',
    'encouraging', 'מעודד',
  ],
}

/**
 * ILCF-specific backend (chat.js) trigger keywords.
 */
export const ILCF_BACKEND_KEYWORDS = [
  'chat.js', 'function', 'serverless', 'api', 'backend', 'rag', 'embed',
  'server', 'netlify function', 'edge', 'שרת',
]

/**
 * ILCF-specific extra rules for the AI.
 */
export const ILCF_EXTRA_RULES = [
  'All user-facing text must be in Hebrew. Drug names stay in English.',
  'Medical info must be accurate and up to date.',
  'If adding to CR, also add keywords to matchResponse() and ALIASES.',
  'Do NOT modify CSS, HTML structure, RAG pipeline, or event listeners.',
]

/**
 * Create an ILCF MedInfo trainer configuration.
 *
 * @param {object} env - Environment-specific values
 * @param {string} env.aiEndpoint  - Ollama endpoint URL
 * @param {string} [env.aiModel]   - Model name (default: 'gemma3:4b')
 * @param {string} [env.githubToken] - GitHub PAT (optional, for commits)
 * @param {string} [env.githubBranch] - Branch (default: 'trainer')
 * @returns {import('./trainer-engine.js').TrainerConfig}
 */
export function createIlcfConfig(env) {
  return {
    appName: 'ILCF MedInfo',
    appDescription: 'Hebrew medical info chatbot for lung cancer patients in Israel',
    mainFilePath: 'clients/ilcf/index.html',
    backendFilePath: 'clients/ilcf/netlify/functions/chat.js',
    extraRules: ILCF_EXTRA_RULES,

    sectionKeywords: ILCF_SECTION_KEYWORDS,
    backendKeywords: ILCF_BACKEND_KEYWORDS,
    coupledSections: {
      cr: ['matchResponse', 'aliases'],
    },
    conditionalIncludes: [
      {
        trigger: 'buildPrompt',
        keywords: ['טון', 'tone', 'אמפתית', 'נינוחה', 'רכה', 'style', 'סגנון'],
        include: 'emotionalTokens',
      },
    ],

    ai: {
      endpoint: env.aiEndpoint,
      model: env.aiModel || 'gemma3:4b',
      temperature: 0.1,
      timeout: 300_000,
    },

    github: env.githubToken ? {
      token: env.githubToken,
      owner: 'msmobileapps',
      repo: 'opsagent-core-js',
      branch: env.githubBranch || 'trainer',
    } : undefined,
  }
}
