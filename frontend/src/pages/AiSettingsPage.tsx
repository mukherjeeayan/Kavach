import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAiSettings,
  useSaveAiSettings,
  useTestAiConnection,
  useDeleteAiSettings,
  useFetchModels,
} from '../hooks/useAiSettings';
import type { ModelInfo } from '../services/api';
import Toast from '../components/ui/Toast';

type AiProvider = 'openai' | 'gemini' | 'anthropic';

const PROVIDERS: { value: AiProvider; label: string; fallbackModels: string[] }[] = [
  { value: 'openai', label: 'OpenAI', fallbackModels: ['gpt-4o-mini', 'gpt-4o'] },
  { value: 'gemini', label: 'Google Gemini', fallbackModels: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
  { value: 'anthropic', label: 'Anthropic Claude', fallbackModels: ['claude-sonnet-4-20250514', 'claude-3-haiku-20240307'] },
];

export default function AiSettingsPage() {
  const { data: settings = [], isLoading } = useAiSettings();
  const saveSettings = useSaveAiSettings();
  const testConnection = useTestAiConnection();
  const deleteSettings = useDeleteAiSettings();
  const fetchModels = useFetchModels();

  const [selectedProvider, setSelectedProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showUpdateKey, setShowUpdateKey] = useState<AiProvider | null>(null);

  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsError, setModelsError] = useState(false);

  useEffect(() => {
    const fallback = PROVIDERS.find((p) => p.value === selectedProvider);
    setSelectedModel(fallback?.fallbackModels[0] ?? '');
    setAvailableModels([]);
    setModelsError(false);
  }, [selectedProvider]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    try {
      await saveSettings.mutateAsync({
        provider: selectedProvider,
        api_key: apiKey.trim(),
        model: selectedModel,
      });
      setApiKey('');
      setToast({ message: 'AI settings saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save AI settings', type: 'error' });
    }
  };

  const handleTest = async (provider: AiProvider) => {
    try {
      await testConnection.mutateAsync(provider);
      setToast({ message: `${provider} connection successful`, type: 'success' });
    } catch {
      setToast({ message: `${provider} connection failed`, type: 'error' });
    }
  };

  const handleDelete = async (provider: AiProvider) => {
    try {
      await deleteSettings.mutateAsync(provider);
      setToast({ message: `${provider} removed`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to remove provider', type: 'error' });
    }
  };

  const handleFetchModels = async () => {
    if (!apiKey.trim()) return;
    setModelsError(false);
    try {
      const models = await fetchModels.mutateAsync({ provider: selectedProvider, apiKey });
      setAvailableModels(models);
    } catch {
      setModelsError(true);
      setAvailableModels([]);
    }
  };

  if (isLoading) {
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
                        disabled={testConnection.isPending}
                        className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                      >
                        {testConnection.isPending ? 'Testing...' : 'Test'}
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
                        disabled={deleteSettings.isPending}
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
                    disabled={fetchModels.isPending}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {fetchModels.isPending ? 'Fetching...' : 'Fetch available models'}
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
              <div className="mt-2 flex flex-wrap gap-1">
                {fetchModels.isPending && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 py-0.5">Loading models from provider...</span>
                )}
                {!fetchModels.isPending && modelsError && (
                  <span className="text-xs text-amber-500 dark:text-amber-400 py-0.5">
                    Could not fetch models. Enter your API key and try again, or type any model name.
                  </span>
                )}
                {!fetchModels.isPending && !modelsError && availableModels.length > 0 && (
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
                {!fetchModels.isPending && !modelsError && availableModels.length === 0 && (
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
                disabled={saveSettings.isPending || !apiKey.trim()}
                className="flex-1 bg-primary text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveSettings.isPending ? 'Saving...' : showUpdateKey ? 'Update Key' : 'Save Provider'}
              </button>
            </div>
          </form>
        </section>

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