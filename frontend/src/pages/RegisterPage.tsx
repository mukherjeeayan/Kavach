import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import * as yup from 'yup';
import apiClient from '../services/apiClient';
import { setSession } from '../store/authSlice';
import type { ApiResponse, LoginPayload } from '../types/api';

const registerSchema = yup.object({
  name: yup.string().required('Name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  child_name: yup.string().optional(),
  birth_date: yup
    .string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be YYYY-MM-DD')
    .optional(),
});

type RegisterFormData = {
  name: string;
  email: string;
  password: string;
  child_name?: string;
  birth_date?: string;
};

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormData>();

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);

    try {
      await registerSchema.validate(data, { abortEarly: false });
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        err.inner.forEach((e) => {
          if (e.path) setError(e.path as keyof RegisterFormData, { message: e.message });
        });
      }
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post<ApiResponse<LoginPayload>>('/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
        child_name: data.child_name || undefined,
        birth_date: data.birth_date || undefined,
      });
      const { token, user } = response.data.data!;
      dispatch(setSession({ token, user }));
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setServerError(message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-background py-8">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-primary mb-6">Create Parent Account</h1>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              {...register('name')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2"
            />
            {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700">
              First Child&apos;s Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              {...register('child_name')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Birth Date <span className="text-gray-400">(optional, YYYY-MM-DD)</span>
            </label>
            <input
              type="text"
              placeholder="2015-06-01"
              {...register('birth_date')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2"
            />
            {errors.birth_date && (
              <span className="text-red-500 text-sm">{errors.birth_date.message}</span>
            )}
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
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}