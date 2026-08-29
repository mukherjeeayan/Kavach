import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import VoiceCommandsPage from './VoiceCommandsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import * as api from '../services/api';

vi.mock('../services/api');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('VoiceCommandsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders VoiceCommands page with loading state', () => {
    const { container, unmount } = render(<VoiceCommandsPage childId="child-1" />, { wrapper: createWrapper() });
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    unmount();
  });

  it('displays when voice commands are fetched', async () => {
    vi.mocked(api.fetchVoiceCommands).mockResolvedValue({
      data: [
        { id: 'vc-1', child_id: 'child-1', device_id: 'dev-1', command_text: 'Turn on flashlight', intent: 'light', was_executed: false, recorded_at: '2026-08-20T10:00:00Z' },
      ],
      meta: { page: 1, limit: 50, total: 1, total_pages: 1 },
    });

    const { result } = renderHook(() => useVoiceCommands('child-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});