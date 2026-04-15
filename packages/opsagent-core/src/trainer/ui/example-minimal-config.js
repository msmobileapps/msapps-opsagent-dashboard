/**
 * example-minimal-config.js — Minimal trainer config example.
 *
 * Shows how to create a new trainer for a different app in under 50 lines.
 * This example is for a hypothetical "Acme Support Bot" trainer.
 *
 * Usage:
 *   Copy trainer-shell.html, create your own config like this one,
 *   and include it via <script src="./my-config.js"></script> before the shell.
 */
window.TRAINER_CONFIG = {
  appName: 'Acme Support Bot',
  appDescription: 'Customer support chatbot for Acme Corp products',
  mainFilePath: 'src/bot/responses.js',

  branding: {
    title: 'Acme Bot Trainer',
    subtitle: 'Teach the bot new tricks',
    logoUrl: 'https://example.com/acme-logo.png',
  },

  ai: {
    endpoint: 'https://my-ollama.example.com',
    model: 'gemma3:4b',
  },

  trainerApiUrl: '/api/trainer',

  quickPrompts: [
    { label: 'Add FAQ', prompt: 'Add a new FAQ about return policy' },
    { label: 'Fix tone', prompt: 'Make responses more friendly and less formal' },
    { label: 'New product', prompt: 'Add support for the new Widget Pro product line' },
  ],

  sectionKeywords: {
    faq: ['faq', 'question', 'answer', 'help', 'return', 'shipping', 'refund'],
    greetings: ['hello', 'welcome', 'greeting', 'intro', 'opening'],
    products: ['product', 'widget', 'pricing', 'feature', 'spec'],
    tone: ['tone', 'style', 'friendly', 'formal', 'voice', 'personality'],
  },

  coupledSections: { faq: ['products'] },
  extraRules: ['Keep responses under 200 words.', 'Always include a link to the help center.'],

  github: { owner: 'acme-corp', repo: 'support-bot', branch: 'main' },
  previewUrl: 'https://bot-preview.acme.com',
};
