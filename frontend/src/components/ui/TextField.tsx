import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'ref'> & {
  label: string;
  error?: string;
  optional?: boolean;
};

/**
 * Label + input + inline error in one block. Designed to be used with
 * react-hook-form: `{...register('field')}` spreads into it directly.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, optional, ...inputProps }, ref) => (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {optional && <span className="text-gray-400"> (optional)</span>}
      </label>
      <input
        {...inputProps}
        ref={ref}
        className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
      />
      {error && <span className="text-red-500 text-sm">{error}</span>}
    </div>
  )
);
TextField.displayName = 'TextField';
