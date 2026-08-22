import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContactsSection from './ContactsSection';

vi.mock('../../hooks/usePhase1Data', () => ({
  useContacts: vi.fn(),
  useContactActions: vi.fn(),
  useActionsError: vi.fn(),
}));

import { useContacts, useContactActions } from '../../hooks/usePhase1Data';

const mockedUseContacts = useContacts as ReturnType<typeof vi.fn>;
const mockedUseContactActions = useContactActions as ReturnType<typeof vi.fn>;

describe('ContactsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseContactActions.mockReturnValue({
      create: { mutate: vi.fn(), isPending: false },
      update: { mutate: vi.fn(), isPending: false },
      remove: { mutate: vi.fn(), isPending: false },
    });
  });

  it('shows empty state', () => {
    mockedUseContacts.mockReturnValue({ data: [], isLoading: false });
    render(<ContactsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText(/no contact rules yet/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseContacts.mockReturnValue({ data: undefined, isLoading: true });
    render(<ContactsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Contacts')).toBeInTheDocument();
  });

  it('renders contact entries', () => {
    mockedUseContacts.mockReturnValue({
      data: [
        { id: 'c1', contact_name: 'Grandma', phone_number: '+91 98765 43210', rule_type: 'ALLOW' },
        { id: 'c2', contact_name: 'Unknown', phone_number: '+91 12345 67890', rule_type: 'BLOCK' },
      ],
      isLoading: false,
    });
    render(<ContactsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Grandma')).toBeInTheDocument();
    expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
    expect(screen.getByText('ALLOW')).toBeInTheDocument();
    expect(screen.getByText('BLOCK')).toBeInTheDocument();
  });

  it('shows add form when + Add contact is clicked', () => {
    mockedUseContacts.mockReturnValue({ data: [], isLoading: false });
    render(<ContactsSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add contact'));
    expect(screen.getByText('New contact rule')).toBeInTheDocument();
    expect(screen.getByText('Save contact')).toBeInTheDocument();
  });
});
