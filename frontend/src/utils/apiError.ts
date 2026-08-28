/**
 * Sanitizes a string by stripping HTML tags and escaping entities,
 * then extracts the backend's `{ error: string }` message from an axios
 * rejection, falling back to a caller-provided generic message.
 *
 - Prevents XSS when displaying backend error messages to the user.
 */
export const sanitizeHtml = (unsafe: string): string => {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Extracts the backend's `{ error: string }` message from an axios
 * rejection, sanitizes it, and falls back to a caller-provided generic message.
 */
export const getErrorMessage = (error: unknown, fallback: string): string => {
  const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return message ? sanitizeHtml(message) : fallback;
};