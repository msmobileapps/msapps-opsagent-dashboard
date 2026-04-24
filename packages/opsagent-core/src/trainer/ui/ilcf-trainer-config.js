/**
 * ilcf-trainer-config.js — ILCF MedInfo Trainer configuration for trainer-shell.html.
 *
 * This config makes the generic trainer shell look and behave identically
 * to the original ILCF trainer.html. Load this script before the shell boots:
 *
 *   <script src="./ilcf-trainer-config.js"></script>
 *
 * Or in a single HTML file:
 *
 *   <script>
 *     // paste the TRAINER_CONFIG object here
 *   </script>
 *
 * The config is ~45 lines of actual configuration — proving that a new trainer
 * for a different app can be created in under 50 lines.
 */
window.TRAINER_CONFIG = {
  appName: 'ILCF MedInfo',
  appDescription: 'Hebrew medical info chatbot for lung cancer patients in Israel',
  mainFilePath: 'clients/ilcf/index.html',
  backendFilePath: 'clients/ilcf/netlify/functions/chat.js',

  // Language & direction
  lang: 'he',
  dir: 'rtl',

  // Branding
  branding: {
    title: 'MedInfo Trainer',
    subtitle: '\u05E2\u05D5\u05D6\u05E8\u05EA \u05D4\u05E6\u05F3\u05D0\u05D8\u05D1\u05D5\u05D8 \u2014 \u05E9\u05E0\u05D4 \u05D4\u05DB\u05D5\u05DC \u05D1\u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05E7\u05D5\u05D3',
    logoUrl: 'https://www.ilcf.org.il/wp-content/uploads/2016/10/logo-2.png',
    logoAlt: 'ILCF',
  },

  // Hebrew font
  fontFamily: '"Heebo", system-ui, sans-serif',
  fontUrl: 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap',

  // Hebrew labels
  labels: {
    instructionTitle: '\u05D4\u05D5\u05E8\u05D0\u05D5\u05EA \u05DC\u05E6\u05F3\u05D0\u05D8\u05D1\u05D5\u05D8',
    instructionSubtitle: '\u05DB\u05EA\u05D1\u05D9 \u05DE\u05D4 \u05DC\u05E9\u05E0\u05D5\u05EA \u2014 \u05D4\u05DB\u05D9\u05E0\u05D4 \u05DE\u05E2\u05D3\u05DB\u05E0\u05EA \u05D0\u05EA \u05D4\u05E7\u05D5\u05D3',
    previewTitle: '\u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4',
    sendButton: '\u05E9\u05DC\u05D7 \u05D4\u05D5\u05E8\u05D0\u05D4',
    clearButton: '\u05E0\u05E7\u05D4 \u05E9\u05D9\u05D7\u05D4',
    statusOnline: '\u05DE\u05D7\u05D5\u05D1\u05E8',
    typingDefault: '\u05DE\u05E2\u05D1\u05D3\u05EA \u05D0\u05EA \u05D4\u05E7\u05D5\u05D3...',
    loadingFiles: '\u05D8\u05D5\u05E2\u05E0\u05EA \u05E7\u05D1\u05E6\u05D9\u05DD \u05DE\u05D4\u05DE\u05D0\u05D2\u05E8...',
    aiProcessing: 'AI \u05DE\u05E4\u05E8\u05E9 \u05D0\u05EA \u05D4\u05D4\u05D5\u05E8\u05D0\u05D4...',
    savingChanges: '\u05E9\u05D5\u05DE\u05E8\u05EA \u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD \u05DC\u05DE\u05D0\u05D2\u05E8...',
    userRole: '\u05D0\u05EA',
    assistantRole: 'Trainer',
    placeholder: '\u05DB\u05EA\u05D1\u05D9 \u05D4\u05D5\u05E8\u05D0\u05D4... \u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: \n\u2022 \u05EA\u05D5\u05E1\u05D9\u05E4\u05D9 \u05DE\u05D9\u05D3\u05E2 \u05E2\u05DC \u05D4\u05E7\u05E8\u05E0\u05D5\u05EA \u05DC\u05E1\u05E8\u05D8\u05DF \u05E8\u05D9\u05D0\u05D5\u05EA\n\u2022 \u05E2\u05D3\u05DB\u05D5\u05DF \u05E9\u05D0\u05DC\u05D5\u05EA \u05DE\u05D5\u05E4\u05E0\u05D9\u05DD, \u05EA\u05D4\u05D9\u05D9 \u05D9\u05D5\u05EA\u05E8 \u05E8\u05DB\u05EA \u05EA\u05E9\u05D5\u05D1\u05D4\n\u2022 \u05EA\u05E2\u05D3\u05DB\u05E0\u05D9 \u05D0\u05EA \u05D4\u05DE\u05D9\u05D3\u05E2 \u05E2\u05DC \u05E1\u05E0\u05D9\u05D8\u05D9\u05E0\u05D9\u05D1 \u05DC\u05E9\u05E0\u05EA 2026',
    welcomeMessage: '\u05E9\u05DC\u05D5\u05DD! \u05D0\u05E0\u05D9 \u05DE\u05E2\u05E8\u05DB\u05EA \u05D4-Trainer \u05E9\u05DC MedInfo.<br><br>\u05D0\u05EA \u05D9\u05DB\u05D5\u05DC\u05D4 \u05DC\u05EA\u05EA \u05DC\u05D9 <strong>\u05D4\u05D5\u05E8\u05D0\u05D5\u05EA \u05E8\u05D2\u05D9\u05DC\u05D5\u05EA</strong> \u05D1\u05DF \u05DE\u05E9\u05E4\u05D8\u05D9\u05DD, \u05D5\u05D0\u05E0\u05D9:<br>1. \u05D0\u05D1\u05D7\u05E8 \u05D0\u05EA \u05D4\u05E7\u05D5\u05D3 \u05D4\u05E8\u05DC\u05D5\u05D5\u05E0\u05D8\u05D9<br>2. \u05D0\u05E9\u05E0\u05D4 \u05D0\u05EA \u05D4\u05E7\u05D5\u05D3<br>3. \u05D0\u05D3\u05D7\u05D5\u05E3 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05E2\u05DC \u05D4\u05E1\u05D5\u05E8\u05E1 \u05D1-commit<br>4. \u05D0\u05D5\u05EA\u05E8 \u05D0\u05EA \u05D4\u05E2\u05D3\u05DB\u05D5\u05DF \u05D1\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA',
    noChanges: '\u05DC\u05D0 \u05DE\u05E6\u05D0\u05EA\u05D9 \u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD \u05E0\u05D3\u05E8\u05E9\u05D9\u05DD.',
    warnings: '\u05D0\u05D6\u05D4\u05E8\u05D5\u05EA:',
    errorPrefix: '\u05E9\u05D2\u05D9\u05D0\u05D4:',
    filesChanged: '\u05E7\u05D1\u05E6\u05D9\u05DD \u05E9\u05E9\u05D5\u05E0\u05D5:',
    refreshButton: '\u05E8\u05E2\u05E0\u05DF',
  },

  // Topbar links
  topbarLinks: [
    { label: '\u05E6\u05E4\u05D4 \u05D1\u05E6\u05F3\u05D0\u05D8\u05D1\u05D5\u05D8', url: '/' },
    { label: 'GitHub', url: 'https://github.com/msmobileapps/opsagent-core-js/tree/trainer/clients/ilcf' },
  ],

  // Quick prompts (ILCF-specific)
  quickPrompts: [
    { label: '\u05E2\u05D3\u05DB\u05D5\u05DF Keytruda', prompt: '\u05E2\u05D3\u05DB\u05D5\u05DF \u05E9\u05D0\u05DC\u05D5\u05DF \u05E2\u05DC Keytruda, \u05EA\u05D5\u05E1\u05D9\u05E4\u05D9 \u05E9\u05D0\u05DC\u05D5\u05DF \u05E0\u05D5\u05E1\u05E3 \u05D1\u05D0\u05E9\u05E8\u05D5\u05EA \u05DC-SCLC \u05D1-2025' },
    { label: '\u05E9\u05E4\u05E8\u05D9 \u05D8\u05D5\u05DF', prompt: '\u05EA\u05D4\u05D9\u05D9 \u05D9\u05D5\u05EA\u05E8 \u05E0\u05D9\u05E0\u05D5\u05D7\u05D4 \u05D5\u05D0\u05DE\u05E4\u05EA\u05D9\u05EA \u05D1\u05EA\u05E9\u05D5\u05D1\u05D5\u05EA \u05E2\u05DC \u05EA\u05D5\u05E4\u05E2\u05D5\u05EA \u05DC\u05D5\u05D5\u05D0\u05D9' },
    { label: '\u05E0\u05D5\u05E9\u05D0 \u05D7\u05D3\u05E9', prompt: '\u05EA\u05D5\u05E1\u05D9\u05E4\u05D9 \u05E0\u05D5\u05E9\u05D0 \u05D7\u05D3\u05E9: \u05D4\u05E7\u05E8\u05E0\u05D5\u05EA (radiation therapy) \u05E2\u05DC \u05D4\u05DE\u05D9\u05D3\u05E2 \u05D4\u05D1\u05E1\u05D9\u05E1\u05D9' },
    { label: '\u05E9\u05E0\u05D4 \u05E4\u05EA\u05D9\u05D7\u05D4', prompt: '\u05E9\u05E0\u05D9 \u05D0\u05EA \u05D4\u05D5\u05D3\u05E2\u05EA \u05D4\u05E4\u05EA\u05D9\u05D7\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA \u05D9\u05D5\u05EA\u05E8 \u05DE\u05D6\u05DE\u05D9\u05E0\u05D4 \u05D5\u05E4\u05D7\u05D5\u05EA \u05E4\u05D5\u05E8\u05DE\u05DC\u05D9\u05EA' },
  ],

  // AI configuration
  ai: {
    // endpoint comes from server config (GET /api/trainer returns aiEndpoint)
    endpoint: '',
    model: 'gemma3:12b',
    temperature: 0.1,
    systemMessage: 'You are a precise code modification assistant. Return only valid JSON. Every search string must be an exact match from the source file.',
  },

  // Trainer API
  trainerApiUrl: '/api/trainer',

  // Section keywords (matches ILCF_SECTION_KEYWORDS in trainer-config.ilcf.js)
  sectionKeywords: {
    cr: [
      'response', '\u05EA\u05D2\u05D5\u05D1\u05D4', '\u05EA\u05E9\u05D5\u05D1\u05D4', 'keytruda', 'drug', '\u05EA\u05E8\u05D5\u05E4\u05D4', 'treatment',
      '\u05D8\u05D9\u05E4\u05D5\u05DC', 'topic', '\u05E0\u05D5\u05E9\u05D0', 'canned', 'cr', '\u05DE\u05D9\u05D3\u05E2', 'cancer', '\u05E1\u05E8\u05D8\u05DF',
      'radiation', '\u05D4\u05E7\u05E8\u05E0\u05D5\u05EA', 'chemo', '\u05DB\u05D9\u05DE\u05D5\u05EA\u05E8\u05E4\u05D9\u05D4', 'immunotherapy', '\u05D0\u05D9\u05DE\u05D5\u05E0\u05D5\u05EA\u05E8\u05E4\u05D9\u05D4',
      'side effect', '\u05EA\u05D5\u05E4\u05E2\u05D5\u05EA', 'symptom', '\u05EA\u05E1\u05DE\u05D9\u05DF', 'opdivo', 'tecentriq',
      'pembrolizumab', '\u05E0\u05D9\u05D1\u05D5\u05DC\u05D5\u05DE\u05D0\u05D1', 'clinical trial', '\u05DE\u05D7\u05E7\u05E8 \u05E7\u05DC\u05D9\u05E0\u05D9', '\u05EA\u05D5\u05E1\u05D9\u05E4\u05D9 \u05E0\u05D5\u05E9\u05D0',
      '\u05E2\u05D3\u05DB\u05D5\u05DF \u05E9\u05D0\u05DC\u05D5\u05DF', 'add topic', 'new topic', '\u05E0\u05D5\u05E9\u05D0 \u05D7\u05D3\u05E9',
    ],
    matchResponse: [
      'keyword', 'match', '\u05D4\u05EA\u05D0\u05DE\u05D4', '\u05D6\u05D9\u05D4\u05D5\u05D9', 'matching', '\u05DE\u05D9\u05DC\u05EA \u05DE\u05E4\u05EA\u05D7',
      'trigger', 'recognize', 'detect', 'pattern',
    ],
    greeting: [
      'greeting', '\u05D1\u05E8\u05DB\u05D4', '\u05E4\u05EA\u05D9\u05D7\u05D4', 'welcome', '\u05E9\u05DC\u05D5\u05DD', '\u05D4\u05D5\u05D3\u05E2\u05EA \u05E4\u05EA\u05D9\u05D7\u05D4',
      'opening', 'first message', '\u05D4\u05D5\u05D3\u05E2\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D4', '\u05DE\u05D6\u05DE\u05D9\u05E0\u05D4', '\u05E4\u05D5\u05E8\u05DE\u05DC\u05D9\u05EA',
    ],
    quickButtons: [
      'button', '\u05DB\u05E4\u05EA\u05D5\u05E8', 'quick', '\u05DE\u05D4\u05D9\u05E8', 'toolbar', '\u05DB\u05E4\u05EA\u05D5\u05E8\u05D9\u05DD', 'shortcut',
    ],
    buildPrompt: [
      'prompt', 'system', '\u05DE\u05E2\u05E8\u05DB\u05EA', '\u05D4\u05D5\u05E8\u05D0\u05D4', '\u05E4\u05E8\u05D5\u05DE\u05E4\u05D8', 'system prompt',
      'persona', 'behavior', '\u05D4\u05EA\u05E0\u05D4\u05D2\u05D5\u05EA', 'tone', '\u05D8\u05D5\u05DF', 'style', '\u05E1\u05D2\u05E0\u05D5\u05DF',
      '\u05D0\u05DE\u05E4\u05EA\u05D9\u05EA', '\u05E0\u05D9\u05E0\u05D5\u05D7\u05D4', '\u05E8\u05DB\u05D4', 'empathy', 'warm', 'formal',
    ],
    aliases: [
      'alias', '\u05DB\u05D9\u05E0\u05D5\u05D9', 'synonym', 'aliases', '\u05E9\u05DD \u05D7\u05DC\u05D5\u05E4\u05D9', 'name', 'abbreviation',
    ],
    emotionalTokens: [
      'emotion', '\u05E8\u05D2\u05E9', '\u05EA\u05DE\u05D9\u05DB\u05D4', 'emotional', 'empathy', '\u05E8\u05D2\u05E9\u05D9', 'support',
      'encouraging', '\u05DE\u05E2\u05D5\u05D3\u05D3',
    ],
  },

  backendKeywords: [
    'chat.js', 'function', 'serverless', 'api', 'backend', 'rag', 'embed',
    'server', 'netlify function', 'edge', '\u05E9\u05E8\u05EA',
  ],

  coupledSections: {
    cr: ['matchResponse', 'aliases'],
  },

  conditionalIncludes: [
    {
      trigger: 'buildPrompt',
      keywords: ['\u05D8\u05D5\u05DF', 'tone', '\u05D0\u05DE\u05E4\u05EA\u05D9\u05EA', '\u05E0\u05D9\u05E0\u05D5\u05D7\u05D4', '\u05E8\u05DB\u05D4', 'style', '\u05E1\u05D2\u05E0\u05D5\u05DF'],
      include: 'emotionalTokens',
    },
  ],

  extraRules: [
    'All user-facing text must be in Hebrew. Drug names stay in English.',
    'Medical info must be accurate and up to date.',
    'If adding to CR, also add keywords to matchResponse() and ALIASES.',
    'Do NOT modify CSS, HTML structure, RAG pipeline, or event listeners.',
  ],

  // GitHub (for commit card links)
  github: {
    owner: 'msmobileapps',
    repo: 'opsagent-core-js',
    branch: 'trainer',
  },

  // Preview
  previewUrl: '/',
  showPreview: true,
  previewReloadDelay: 3000,
};
