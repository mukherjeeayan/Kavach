import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';
import AuthLayout from '../components/auth/AuthLayout';
import { TextField } from '../components/ui/TextField';

export interface RegisterFormValues {
  name: string;
  email: string;
  password: string;
  child_name?: string;
  birth_date?: string;
}

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
          error={errors.name?.message}
          {...register('name')}
        />
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