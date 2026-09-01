import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PremiumLockOverlay } from './PremiumLockOverlay';

const mocks = vi.hoisted(() => ({
  useSubscriptionTier: vi.fn(),
}));

vi.mock('../../store/authSlice', () => ({
  useSubscriptionTier: (...args: unknown[]) => mocks.useSubscriptionTier(...args),
}));

const childContent = <div data-testid="child">Premium Content</div>;

describe('PremiumLockOverlay', () => {
  it('renders children when user has sufficient tier', () => {
    mocks.useSubscriptionTier.mockReturnValue('PREMIUM');
    render(
      <PremiumLockOverlay featureName="Feature">
        {childContent}
      </PremiumLockOverlay>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByText('Upgrade to Premium')).not.toBeInTheDocument();
  });

  it('renders overlay when user is FREE and feature requires PREMIUM', () => {
    mocks.useSubscriptionTier.mockReturnValue('FREE');
    render(
      <PremiumLockOverlay featureName="Feature" requiredTier="PREMIUM">
        {childContent}
      </PremiumLockOverlay>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Feature requires Premium')).toBeInTheDocument();
    expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument();
  });

  it('renders overlay when user is FREE and feature requires TRIAL', () => {
    mocks.useSubscriptionTier.mockReturnValue('FREE');
    render(
      <PremiumLockOverlay featureName="Feature" requiredTier="TRIAL">
        {childContent}
      </PremiumLockOverlay>
    );
    expect(screen.getByText('Feature requires an active subscription')).toBeInTheDocument();
  });

  it('renders children for TRIAL user when feature requires TRIAL', () => {
    mocks.useSubscriptionTier.mockReturnValue('TRIAL');
    render(
      <PremiumLockOverlay featureName="Feature" requiredTier="TRIAL">
        {childContent}
      </PremiumLockOverlay>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByText('Upgrade to Premium')).not.toBeInTheDocument();
  });

  it('renders overlay for TRIAL user when feature requires PREMIUM', () => {
    mocks.useSubscriptionTier.mockReturnValue('TRIAL');
    render(
      <PremiumLockOverlay featureName="Feature" requiredTier="PREMIUM">
        {childContent}
      </PremiumLockOverlay>
    );
    expect(screen.getByText('Feature requires Premium')).toBeInTheDocument();
    expect(screen.getByText(/Your free trial has expired/)).toBeInTheDocument();
  });

  it('defaults to requiring PREMIUM tier', () => {
    mocks.useSubscriptionTier.mockReturnValue('FREE');
    render(
      <PremiumLockOverlay featureName="Some Feature">
        {childContent}
      </PremiumLockOverlay>
    );
    expect(screen.getByText('Some Feature requires Premium')).toBeInTheDocument();
  });
});
