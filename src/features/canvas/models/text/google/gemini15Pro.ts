import type { TextModelDefinition } from '../../types';

export const GOOGLE_GEMINI_15_PRO_MODEL_ID = 'google/gemini-1.5-pro';

export const textModel: TextModelDefinition = {
  id: GOOGLE_GEMINI_15_PRO_MODEL_ID,
  mediaType: 'text',
  displayName: 'Gemini 1.5 Pro (Google AI)',
  providerId: 'google',
  description: 'Google AI Studio · Gemini 1.5 Pro 文本生成与对话',
  eta: '2-5s',
  expectedDurationMs: 3000,
  maxTokens: 1048576,
  defaultTemperature: 0.7,
  supportedFeatures: ['chat', 'completion', 'instruction'],
  resolveRequest: ({ systemPrompt }) => ({
    requestModel: GOOGLE_GEMINI_15_PRO_MODEL_ID,
    modeLabel: systemPrompt ? '指令模式' : '对话模式',
  }),
};