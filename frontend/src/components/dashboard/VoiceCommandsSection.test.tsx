import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import VoiceCommandsSection from './VoiceCommandsSection';

vi.mock('../../hooks/useVoiceCommands', () => ({
  useVoiceCommands: vi.fn(),
}));

import { useVoiceCommands } from '../../hooks/useVoiceCommands';

const mockedUseVoiceCommands = useVoiceCommands as ReturnType<typeof vi.fn>;

describe('VoiceCommandsSection', () => {
  it('shows the empty state', () => {
    mockedUseVoiceCommands.mockReturnValue({ data: { data: [], meta: null }, isLoading: false });
    render(<VoiceCommandsSection childId="child-1" />);
    expect(screen.getByText(/no voice commands recorded/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseVoiceCommands.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<VoiceCommandsSection childId="child-1" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders command entries', () => {
    mockedUseVoiceCommands.mockReturnValue({
      data: {
        data: [
          {
            id: 'v1',
            command_text: 'call mom',
            intent: 'CALL',
            was_executed: true,
            recorded_at: '2026-08-21T10:00:00.000Z',
          },
          {
            id: 'v2',
            command_text: 'open camera',
            intent: null,
            was_executed: false,
            recorded_at: '2026-08-21T09:00:00.000Z',
          },
        ],
        meta: { total: 2, page: 1, total_pages: 1 },
      },
      isLoading: false,
    });
    render(<VoiceCommandsSection childId="child-1" />);
    expect(screen.getByText('call mom')).toBeInTheDocument();
    expect(screen.getByText('CALL')).toBeInTheDocument();
    expect(screen.getByText('Executed')).toBeInTheDocument();
    expect(screen.getByText('open camera')).toBeInTheDocument();
    expect(screen.getByText('Not executed')).toBeInTheDocument();
    expect(screen.getByText('2 recorded')).toBeInTheDocument();
  });

  it('shows pagination when multiple pages', () => {
    mockedUseVoiceCommands.mockReturnValue({
      data: {
        data: [
          {
            id: 'v1',
            command_text: 'test command',
            intent: 'TEST',
            was_executed: true,
            recorded_at: '2026-08-21T10:00:00.000Z',
          },
        ],
        meta: { total: 25, page: 1, total_pages: 2 },
      },
      isLoading: false,
    });
    render(<VoiceCommandsSection childId="child-1" />);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });
});
