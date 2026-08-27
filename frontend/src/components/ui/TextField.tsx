import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'ref'> & {
  label: string;
  error?: string;
  optional?: boolean;
};

/**
 * Label + input + inline error in one block. Designed to be used with
 * react-hook-form: `{...register('field')}` spreads into it directly.
 *
 * Accessibility: when an error is provided, the input gets
 * `aria-describedby` pointing to the error span, so screen readers
 * announce the error description.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, optional, ...inputProps }, ref) => {
    const id = useId();
    const errorId = error ? `${id}-error` : undefined;

    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
          {optional && <span className="text-gray-400"> (optional)</span>}
        </label>
        <input
          {...inputProps}
          id={id}
          ref={ref}
          className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
          aria-describedby={errorId}
        />
        {error && (
          <span
            id={errorId}
            className="text-red-500 text-sm"
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);
TextField.displayName = 'TextField';