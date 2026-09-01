import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import Toast from '../components/ui/Toast';

type AiProvider = 'openai' | 'gemini' | 'anthropic';

interface AiSettings {
  id: string;
  provider: AiProvider;
  model: string;
  api_key_masked: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

const PROVIDERS: { value: AiProvider; label: string; fallbackModels: string[] }[] = [
  { value: 'openai', label: 'OpenAI', fallbackModels: ['gpt-4o-mini', 'gpt-4o'] },
  { value: 'gemini', label: 'Google Gemini', fallbackModels: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
  { value: 'anthropic', label: 'Anthropic Claude', fallbackModels: ['claude-sonnet-4-20250514', 'claude-3-haiku-20240307'] },
];

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showUpdateKey, setShowUpdateKey] = useState<AiProvider | null>(null);

  // Dynamic model list from API
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(false);

  const fetchModels = useCallback(async (provider: AiProvider, key: string) => {
    if (!key.trim()) {
      setAvailableModels([]);
      return;
    }
    setModelsLoading(true);
    setModelsError(false);
    try {
      const res = await apiClient.post<{ models: ModelInfo[] }>(
        '/ai/models/fetch',
        { provider, api_key: key }
      );
      setAvailableModels(res.data.models);
    } catch {
      setModelsError(true);
      setAvailableModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const fallback = PROVIDERS.find((p) => p.value === selectedProvider);
    setSelectedModel(fallback?.fallbackModels[0] ?? '');
    setAvailableModels([]);
  }, [selectedProvider]);

  const loadSettings = async () => {
    try {
      const res = await apiClient.get<{ settings: AiSettings[] }>('/ai/settings');
      setSettings(res.data.settings);
    } catch {
      setToast({ message: 'Failed to load AI settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await apiClient.put('/ai/settings', {
        provider: selectedProvider,
        api_key: apiKey.trim(),
        model: selectedModel,
      });
      setApiKey('');
      await loadSettings();
      setToast({ message: 'AI settings saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save AI settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (provider: AiProvider) => {
    setTesting(true);
    try {
      await apiClient.post('/ai/test', { provider });
      setToast({ message: `${provider} connection successful`, type: 'success' });
    } catch {
      setToast({ message: `${provider} connection failed`, type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (provider: AiProvider) => {
    try {
      await apiClient.delete(`/ai/settings/${provider}`);
      await loadSettings();
      setToast({ message: `${provider} removed`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to remove provider', type: 'error' });
    }
  };

  const handleFetchModels = () => {
    fetchModels(selectedProvider, apiKey);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Loading AI settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-primary">SafeGuard</Link>
          <Link to="/settings" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-blue-400">
            Back to Settings
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connect your own AI provider to power weekly insights, behavior analysis, and smart summaries.
            Your API key is encrypted and stored securely.
          </p>
        </div>

        {/* Active providers */}
        {settings.length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Configured Providers</h2>
            <div className="space-y-3">
              {settings.map((s) => (
                <div key={s.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white capitalize">{s.provider}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">({s.model})</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTest(s.provider)}
                        disabled={testing}
                        className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                      >
                        {testing ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProvider(s.provider);
                          setSelectedModel(s.model);
                          setApiKey('');
                          setShowUpdateKey(s.provider);
                        }}
                        className="text-xs px-3 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                      >
                        Update Key
                      </button>
                      <button
                        onClick={() => handleDelete(s.provider)}
                        className="text-xs px-3 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">API Key:</span>
                    <code className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded font-mono text-gray-600 dark:text-gray-300">
                      {s.api_key_masked || '********'}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Add / update provider */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">
            {showUpdateKey ? `Update ${showUpdateKey} API Key` : 'Add Provider'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as AiProvider)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
                {apiKey.trim() && (
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={modelsLoading}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {modelsLoading ? 'Fetching...' : 'Fetch available models'}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                placeholder="Type or select a model below"
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
              {/* Model chips */}
              <div className="mt-2 flex flex-wrap gap-1">
                {modelsLoading && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 py-0.5">Loading models from provider...</span>
                )}
                {!modelsLoading && modelsError && (
                  <span className="text-xs text-amber-500 dark:text-amber-400 py-0.5">
                    Could not fetch models. Enter your API key and try again, or type any model name.
                  </span>
                )}
                {!modelsLoading && !modelsError && availableModels.length > 0 && (
                  <>
                    {availableModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedModel(m.id)}
                        title={m.description}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          selectedModel === m.id
                            ? 'bg-primary text-white border-primary'
                            : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </>
                )}
                {!modelsLoading && !modelsError && availableModels.length === 0 && (
                  <>
                    {PROVIDERS.find((p) => p.value === selectedProvider)?.fallbackModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedModel(m)}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          selectedModel === m
                            ? 'bg-primary text-white border-primary'
                            : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    <span className="text-xs text-gray-400 dark:text-gray-500 py-0.5">or type any model</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
              {showUpdateKey && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Current key: {settings.find((s) => s.provider === showUpdateKey)?.api_key_masked || '********'}
                </p>
              )}
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={showUpdateKey ? 'Enter new API key' : `Enter your ${PROVIDERS.find((p) => p.value === selectedProvider)?.label} API key`}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Your key is encrypted at rest. Never stored in plain text.
              </p>
            </div>

            <div className="flex gap-3">
              {showUpdateKey && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateKey(null);
                    setApiKey('');
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving || !apiKey.trim()}
                className="flex-1 bg-primary text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : showUpdateKey ? 'Update Key' : 'Save Provider'}
              </button>
            </div>
          </form>
        </section>

        {/* Info box */}
        <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">How it works</h3>
          <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <li>- Weekly reports get AI-generated narrative summaries of your child's digital wellness.</li>
            <li>- Behavior predictions include AI-powered contextual insights.</li>
            <li>- You can change or remove your provider at any time.</li>
            <li>- We never store or share your API key beyond generating reports.</li>
          </ul>
        </section>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
