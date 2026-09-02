import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';
import AuthLayout from '../components/auth/AuthLayout';
import { TextField } from '../components/ui/TextField';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';

type AiProvider = 'openai' | 'gemini' | 'anthropic';

const AI_PROVIDERS: { value: AiProvider; label: string; models: string[] }[] = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o'] },
  { value: 'gemini', label: 'Google Gemini', models: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
  { value: 'anthropic', label: 'Anthropic Claude', models: ['claude-sonnet-4-20250514', 'claude-3-haiku-20240307'] },
];

export default function RegisterPage() {
  const { register, errors, onSubmit, isLoading, serverError } = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showAiSetup, setShowAiSetup] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState(AI_PROVIDERS[0].models[0]);

  const handleProviderChange = (provider: AiProvider) => {
    setAiProvider(provider);
    const fallback = AI_PROVIDERS.find((p) => p.value === provider);
    if (fallback) setAiModel(fallback.models[0]);
  };

  return (
    <AuthLayout title="Create Parent Account">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField
          label="Name"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="relative">
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            error={errors.password?.message}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-sm text-gray-500 hover:text-gray-700"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <TextField
          label="First Child's Name"
          optional
          {...register('child_name')}
        />
        <TextField
          label="Birth Date"
          optional
          placeholder="2015-06-01"
          error={errors.birth_date?.message}
          {...register('birth_date')}
        />

        {/* Hidden AI fields — injected when form submits */}
        <input type="hidden" {...register('ai_provider')} value={showAiSetup ? aiProvider : ''} />
        <input type="hidden" {...register('ai_api_key')} value={showAiSetup ? aiApiKey : ''} />
        <input type="hidden" {...register('ai_model')} value={showAiSetup ? aiModel : ''} />

        {/* AI Setup Toggle */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            type="button"
            onClick={() => setShowAiSetup(!showAiSetup)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <svg className={`w-4 h-4 transition-transform ${showAiSetup ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Add AI Provider (Optional)
          </button>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Power weekly insights and behavior analysis with your own AI key.
          </p>
        </div>

        {showAiSetup && (
          <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              >
                {AI_PROVIDERS.find((p) => p.value === aiProvider)?.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={`Enter your ${AI_PROVIDERS.find((p) => p.value === aiProvider)?.label} API key`}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Your key is encrypted and stored securely. You can change it later.
              </p>
            </div>
          </div>
        )}

        {serverError && (
          <p className="text-red-500 text-sm" role="alert">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-primary text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-gray-800 px-3 text-gray-400 font-medium">
            or continue with
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <GoogleAuthButton mode="register" />
      </div>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
