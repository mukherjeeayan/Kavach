import { useLogin } from '../hooks/useAuth';
import AuthLayout from '../components/auth/AuthLayout';
import { TextField } from '../components/ui/TextField';

export default function LoginPage() {
  const { register, errors, onSubmit, isLoading, serverError } = useLogin();

  return (
    <AuthLayout title="SafeGuard Parent Portal">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          error={errors.password?.message}
          {...register('password')}
        />

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
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        New to SafeGuard?{' '}
        <a href="/register" className="text-primary hover:underline">
          Create an account
        </a>
      </p>
    </AuthLayout>
  );
}
