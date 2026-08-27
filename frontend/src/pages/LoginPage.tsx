import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';
import { yupResolver } from '@hookform/resolvers/yup';
import AuthLayout from '../components/auth/AuthLayout';
import { TextField } from '../components/ui/TextField';
import * as yup from 'yup';

export interface LoginFormValues {
  email: string;
  password: string;
}

const loginSchema = yup.object({
  email: yup.string().email('Invalid email format').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});

export default function LoginPage() {
  const { register, errors, onSubmit, isLoading, serverError } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthLayout title="SafeGuard Parent Portal">
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

      <p className="mt-3 text-center text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">
          Forgot your password?
        </Link>
      </p>

      <p className="mt-4 text-center text-sm text-gray-600">
        New to SafeGuard?{' '}
        <Link to="/register" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}