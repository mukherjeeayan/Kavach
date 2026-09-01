// ai.service.ts
// Multi-provider AI abstraction. Supports OpenAI, Gemini, and Anthropic
// using user-provided API keys.

import { getActiveAiConfig } from '../ai-settings/aiSettings.service';

interface AiProvider {
  name: string;
  generate(prompt: string, apiKey: string, model: string): Promise<string>;
  listModels(apiKey: string): Promise<ModelInfo[]>;
}

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

// ── OpenAI ──────────────────────────────────────────────────────
const openaiProvider: AiProvider = {
  name: 'openai',
  generate: async (prompt, apiKey, model) => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a child safety analyst for a parental control app. Be concise, factual, and supportive.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error: ${res.status} — ${err}`);
    }

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  },
  listModels: async (apiKey) => {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json() as { data?: { id: string; owned_by?: string }[] };
    return (data.data ?? [])
      .filter((m) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3') || m.id.includes('o4'))
      .map((m) => ({ id: m.id, name: m.id, description: m.owned_by }));
  },
};

// ── Google Gemini ───────────────────────────────────────────────
const geminiProvider: AiProvider = {
  name: 'gemini',
  generate: async (prompt, apiKey, model) => {
    const modelName = model || 'gemini-1.5-flash';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
          systemInstruction: {
            parts: [{ text: 'You are a child safety analyst for a parental control app. Be concise, factual, and supportive.' }],
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error: ${res.status} — ${err}`);
    }

    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  },
  listModels: async (apiKey) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json() as { models?: { name: string; displayName?: string; description?: string }[] };
    return (data.models ?? [])
      .filter((m) => m.name.includes('gemini'))
      .map((m) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName ?? m.name.replace('models/', ''),
        description: m.description,
      }));
  },
};

// ── Anthropic Claude ────────────────────────────────────────────
const anthropicProvider: AiProvider = {
  name: 'anthropic',
  generate: async (prompt, apiKey, model) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'You are a child safety analyst for a parental control app. Be concise, factual, and supportive.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error: ${res.status} — ${err}`);
    }

    const data = await res.json() as { content?: { type?: string; text?: string }[] };
    return data.content?.[0]?.text ?? '';
  },
  listModels: async (apiKey) => {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
    const data = await res.json() as { data?: { id: string; display_name?: string }[] };
    return (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.display_name ?? m.id,
    }));
  },
};

export const providers: Record<string, AiProvider> = {
  openai: openaiProvider,
  gemini: geminiProvider,
  anthropic: anthropicProvider,
};

/**
 * Generate an AI response using the user's configured provider and API key.
 * Falls back to rule-based output if no AI is configured.
 */
export const generateAiResponse = async (
  userId: string,
  prompt: string
): Promise<string> => {
  const config = await getActiveAiConfig(userId);

  if (!config) {
    throw new Error('No AI provider configured. Please add your API key in AI Settings.');
  }

  const provider = providers[config.provider];
  if (!provider) {
    throw new Error(`Unsupported AI provider: ${config.provider}`);
  }

  return provider.generate(prompt, config.apiKey, config.model);
};

/**
 * Check if a user has any AI provider configured.
 */
export const hasAiConfig = async (userId: string): Promise<boolean> => {
  const config = await getActiveAiConfig(userId);
  return config !== null;
};

/**
 * Fetch available models from a provider using the user's stored API key.
 */
export const fetchAvailableModels = async (
  userId: string,
  provider: string
): Promise<ModelInfo[]> => {
  const config = await getActiveAiConfig(userId);
  if (!config || config.provider !== provider) {
    throw new Error(`No ${provider} API key configured`);
  }

  const aiProvider = providers[provider];
  if (!aiProvider) throw new Error(`Unsupported provider: ${provider}`);

  return aiProvider.listModels(config.apiKey);
};
