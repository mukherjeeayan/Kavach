import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';
import AuthLayout from '../components/auth/AuthLayout';
import { TextField } from '../components/ui/TextField';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';

export interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { register, errors, onSubmit, isLoading, serverError } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthLayout title="Kavach Parent Portal">
      <form
        onSubmit={onSubmit}
        className="space-y-4"
        noValidate
        // yup validation — errors are read from the form state via register()
      >
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
            className="absolute right-3 top-9 text-xs text-gray-500 hover:text-gray-700"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {serverError && (
          <p className="text-red-500 text-sm" role="alert">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-primary text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
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

      <p className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">
          Forgot your password?
        </Link>
      </p>

      <p className="mt-3 text-center text-sm text-gray-600">
        New to Kavach?{' '}
        <Link to="/register" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}