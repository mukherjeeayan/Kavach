import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import * as yup from 'yup';
import apiClient from '../services/apiClient';
import { setSession } from '../store/authSlice';

const loginSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().required('Password is required'),
});

type LoginFormData = { email: string; password: string };

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    refresh_token: string;
    user: { id: string; name: string; email: string };
  };
  error: string | null;
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);

    // Validate locally first (yup is a dependency; the yupResolver
    // package is not installed, so validation runs here).
    try {
      await loginSchema.validate(data, { abortEarly: false });
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        err.inner.forEach((e) => {
          if (e.path) setError(e.path as keyof LoginFormData, { message: e.message });
        });
      }
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', {
        email: data.email,
        password: data.password,
      });
      const { token, user } = response.data.data;
      dispatch(setSession({ token, user }));
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setServerError(message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-primary mb-6">SafeGuard Parent Portal</h1>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              {...register('email')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2"
            />
            {errors.email && <span className="text-red-500 text-sm">{errors.email.message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              {...register('password')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2"
            />
            {errors.password && <span className="text-red-500 text-sm">{errors.password.message}</span>}
          </div>

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
      </div>
    </div>
  );
}