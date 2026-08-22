import { useState } from 'react';

import AuthLayout from '../components/auth/AuthLayout';
import { TextField } from '../components/ui/TextField';
import apiClient from '../services/apiClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setServerError(null);
    setServerMessage(null);

    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setServerMessage('If an account with that email exists, a password reset link has been sent.');
    } catch {
      setServerError('Something went wrong. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset Password">
      <p className="text-sm text-gray-600 mb-4 text-center">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        {serverMessage && (
          <p className="text-green-600 text-sm text-center" role="status">
            {serverMessage}
          </p>
        )}

        {serverError && (
          <p className="text-red-500 text-sm text-center" role="alert">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading || !email.trim()}
          className="w-full py-2 px-4 bg-primary text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Remember your password?{' '}
        <a href="/login" className="text-primary hover:underline">
          Sign in
        </a>
      </p>
    </AuthLayout>
  );
}
