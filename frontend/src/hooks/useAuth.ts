import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import * as yup from 'yup';
import { login as loginApi, logout as logoutApi, register as registerApi } from '../services/api';
import { clearSession, setSession } from '../store/authSlice';
import { getErrorMessage } from '../utils/apiError';

// ── Login ─────────────────────────────────────────────────────────

const loginSchema = yup.object({
  email: yup.string().email('Invalid email format').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});

type LoginFormData = { email: string; password: string };

export const useLogin = () => {
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
      const session = await loginApi(data);
      dispatch(setSession(session));
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error, 'Invalid email or password. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  });

  return { register, errors, onSubmit, isLoading, serverError };
};

// ── Register ──────────────────────────────────────────────────────

const registerSchema = yup.object({
  name: yup.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters').required('Name is required'),
  email: yup.string().email('Invalid email format').required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .required('Password is required'),
  child_name: yup.string().max(50, 'Child name must be at most 50 characters').optional(),
  birth_date: yup
    .string()
    .test('birth_date', 'Birth date must be YYYY-MM-DD format', (value) =>
      !value || /^\d{4}-\d{2}-\d{2}$/.test(value)
    )
    .optional(),
});

type RegisterFormData = {
  name: string;
  email: string;
  password: string;
  child_name?: string;
  birth_date?: string;
};

export const useRegister = () => {
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
      const session = await registerApi({
        name: data.name,
        email: data.email,
        password: data.password,
        child_name: data.child_name || undefined,
        birth_date: data.birth_date || undefined,
      });
      dispatch(setSession(session));
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error, 'Registration failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  });

  return { register, errors, onSubmit, isLoading, serverError };
};

// ── Logout ────────────────────────────────────────────────────────

export const useLogout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    // Revoke the refresh token server-side (best-effort, idempotent).
    // The httpOnly cookie is sent automatically and cleared by the
    // backend; the in-memory access token dies with the page.
    logoutApi().catch(() => {
      // Offline or server error — local session is still cleared.
    });
    dispatch(clearSession());
    // Clear React Query cache to prevent data leakage between users
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return { handleLogout };
};
