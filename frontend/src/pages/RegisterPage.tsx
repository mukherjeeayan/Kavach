import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';
import { yupResolver } from '@hookform/resolvers/yup';
import AuthLayout from '../components/auth/AuthLayout';
import { TextField } from '../components/ui/TextField';
import * as yup from 'yup';

export interface RegisterFormValues {
  name: string;
  email: string;
  password: string;
  child_name?: string;
  birth_date?: string;
}

const registerSchema = yup.object({
  name: yup.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters').required('Name is required'),
  email: yup.string().email('Invalid email format').required('Email is required'),
  password: yup.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .required('Password is required'),
  child_name: yup.string().max(50, 'Child name must be at most 50 characters'),
  birth_date: yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be YYYY-MM-DD format'),
});

export default function RegisterPage() {
  const { register, errors, onSubmit, isLoading, serverError } = useRegister();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthLayout title="Create Parent Account">
      <form
        onSubmit={onSubmit}
        className="space-y-4"
        noValidate
        // yup validation — errors are read from the form state via register()
      >
        <TextField
          label="Name"
          error={errors.name}
          {...register('name')}
        />
        <TextField
          label="Email"
          type="email"
          error={errors.email}
          {...register('email')}
        />
        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          error={errors.password}
          {...register('password')}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-3 text-sm text-gray-500 hover:text-gray-700"
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
        <TextField
          label="First Child's Name"
          optional
          {...register('child_name')}
        />
        <TextField
          label="Birth Date"
          optional
          placeholder="2015-06-01"
          error={errors.birth_date}
          {...register('birth_date')}
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
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}