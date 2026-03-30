import { invoke, isTauri } from '@tauri-apps/api/core';

export interface TextGenerationRequest {
  prompt: string;
  model: string;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
  extra_params?: Record<string, unknown>;
}

export interface TextGenerationResponse {
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function truncateText(value: string, max = 200): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...(${value.length} chars)`;
}

function sanitizeTextGenerationRequestForLog(request: TextGenerationRequest): Record<string, unknown> {
  return {
    prompt: truncateText(request.prompt, 240),
    model: request.model,
    system_prompt: request.system_prompt ? truncateText(request.system_prompt, 100) : undefined,
    max_tokens: request.max_tokens,
    temperature: request.temperature,
    extra_params: request.extra_params ?? {},
  };
}

interface ErrorWithDetails extends Error {
  details?: string;
}

function normalizeInvokeError(error: unknown): { message: string; details?: string } {
  if (error instanceof Error) {
    const detailsText =
      'details' in error
        ? typeof (error as { details?: unknown }).details === 'string'
          ? (error as { details?: string }).details
          : undefined
        : undefined;
    return { message: error.message || '文本生成失败', details: detailsText };
  }

  if (typeof error === 'string') {
    return { message: error || '文本生成失败', details: error || undefined };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message =
      (typeof record.message === 'string' && record.message) ||
      (typeof record.error === 'string' && record.error) ||
      (typeof record.msg === 'string' && record.msg) ||
      '文本生成失败';
    let details: string | undefined;
    try {
      details = truncateText(JSON.stringify(record, null, 2), 2000);
    } catch {
      details = truncateText(String(record), 2000);
    }
    return { message, details };
  }

  return { message: '文本生成失败' };
}

function createErrorWithDetails(message: string, details?: string): ErrorWithDetails {
  const error: ErrorWithDetails = new Error(message);
  if (details) {
    error.details = details;
  }
  return error;
}

export async function generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
  const startedAt = performance.now();
  console.info('[AI] generate_text request', {
    ...sanitizeTextGenerationRequestForLog(request),
    tauri: isTauri(),
  });

  if (!isTauri()) {
    throw new Error('当前不是 Tauri 容器环境，请使用 `npm run tauri dev` 启动');
  }

  try {
    const rawResult = await invoke<unknown>('generate_text', { request });
    
    if (typeof rawResult !== 'object' || rawResult === null) {
      throw createErrorWithDetails(
        'Text generation returned invalid payload',
        truncateText(String(rawResult), 2000)
      );
    }

    const result = rawResult as TextGenerationResponse;
    if (typeof result.text !== 'string') {
      throw createErrorWithDetails(
        'Text generation returned non-string text',
        truncateText(JSON.stringify(result, null, 2), 2000)
      );
    }

    const elapsedMs = Math.round(performance.now() - startedAt);
    console.info('[AI] generate_text success', {
      elapsedMs,
      textLength: result.text.length,
      textPreview: truncateText(result.text, 220),
      usage: result.usage,
    });
    return result;
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    const normalizedError = normalizeInvokeError(error);
    console.error('[AI] generate_text failed', {
      elapsedMs,
      request: sanitizeTextGenerationRequestForLog(request),
      error,
      normalizedError,
    });
    const commandError: ErrorWithDetails = new Error(normalizedError.message);
    commandError.details = normalizedError.details;
    throw commandError;
  }
}

export async function submitGenerateTextJob(request: TextGenerationRequest): Promise<string> {
  console.info('[AI] submit_generate_text_job request', {
    ...sanitizeTextGenerationRequestForLog(request),
    tauri: isTauri(),
  });

  if (!isTauri()) {
    throw new Error('当前不是 Tauri 容器环境，请使用 `npm run tauri dev` 启动');
  }

  const jobId = await invoke<string>('submit_generate_text_job', { request });
  if (typeof jobId !== 'string' || !jobId.trim()) {
    throw new Error('submit_generate_text_job returned invalid job id');
  }
  return jobId.trim();
}

export interface TextGenerationJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'not_found';
  result?: TextGenerationResponse | null;
  error?: string | null;
}

export async function getGenerateTextJob(jobId: string): Promise<TextGenerationJobStatus> {
  if (!isTauri()) {
    throw new Error('当前不是 Tauri 容器环境，请使用 `npm run tauri dev` 启动');
  }

  const result = await invoke<TextGenerationJobStatus>('get_generate_text_job', { jobId });
  if (!result || typeof result !== 'object' || typeof result.status !== 'string') {
    throw new Error('get_generate_text_job returned invalid payload');
  }
  return result;
}

export async function listTextModels(): Promise<string[]> {
  return await invoke('list_text_models');
}

export async function setTextApiKey(provider: string, apiKey: string): Promise<void> {
  console.info('[AI] set_text_api_key', {
    provider,
    apiKeyMasked: apiKey ? `${apiKey.slice(0, 4)}***${apiKey.slice(-2)}` : '',
    tauri: isTauri(),
  });
  if (!isTauri()) {
    throw new Error('当前不是 Tauri 容器环境，请使用 `npm run tauri dev` 启动');
  }
  return await invoke('set_text_api_key', { provider, apiKey });
}