/**
 * Extracts the backend's `{ error: string }` message from an axios
 * rejection, falling back to a caller-provided generic message.
 */
export const getErrorMessage = (error: unknown, fallback: string): string => {
  const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return message || fallback;
};
