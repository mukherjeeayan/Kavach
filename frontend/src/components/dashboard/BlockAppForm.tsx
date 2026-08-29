import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Toast from '../ui/Toast';

interface BlockAppFormProps {
  isPending: boolean;
  disabled: boolean;
  showDeviceHint: boolean;
  onBlock: (packageName: string, reason: string) => Promise<unknown>;
}

export interface BlockAppInput {
  packageName: string;
  reason?: string;
}

export default function BlockAppForm({
  isPending,
  disabled,
  showDeviceHint,
  onBlock,
}: BlockAppFormProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<BlockAppInput>({
    resolver: yupResolver(yup.object({
      packageName: yup.string()
        .required('Package name is required')
        .matches(/^[a-z]([a-z0-9_.]*[a-z0-9])?$/, 'Invalid package name format. Use lowercase letters, numbers, dots, and underscores (e.g., com.example.app)')
        .min(3, 'Package name must be at least 3 characters')
        .max(64, 'Package name must be at most 64 characters'),
      reason: yup.string().max(200, 'Reason must be at most 200 characters').optional(),
    })),
  });

  const onSubmit = async (data: BlockAppInput) => {
    try {
      await onBlock(data.packageName, data.reason || '');
      setShowSuccess(true);
    } catch {
      // keep the form so the user can retry
    }
  };

  return (
    <section className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Block an App</h2>
      <form {...register} onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
        <label className="sr-only" htmlFor="block-package-name">Package name</label>
        <input
          id="block-package-name"
          {...register('packageName')}
          placeholder="Package name (e.g. com.android.chrome)"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 transition-colors"
          aria-invalid={errors.packageName ? true : undefined}
          aria-describedby={errors.packageName ? 'package-name-error' : undefined}
        />
        {errors.packageName && (
          <p id="package-name-error" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {errors.packageName.message}
          </p>
        )}
        <label className="sr-only" htmlFor="block-reason">Reason</label>
        <input
          id="block-reason"
          {...register('reason')}
          placeholder="Reason (optional)"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={isPending || disabled}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Blocking...' : 'Block App'}
        </button>
      </form>
      {showDeviceHint && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Select a device above to target the block.</p>
      )}
      {showSuccess && (
        <Toast message="App blocked successfully" type="success" onClose={() => setShowSuccess(false)} />
      )}
    </section>
  );
}