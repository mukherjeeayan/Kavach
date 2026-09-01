import { useSubscriptionTier } from '../../store/authSlice';

interface PremiumLockOverlayProps {
  featureName: string;
  requiredTier?: 'TRIAL' | 'PREMIUM';
  children: React.ReactNode;
}

const TIER_LEVEL: Record<string, number> = {
  FREE: 0,
  TRIAL: 1,
  PREMIUM: 2,
};

/**
 * Wraps premium feature content. If the user doesn't have the required
 * subscription tier, shows a blurred overlay with an upgrade prompt.
 *
 * Access rules:
 *  - FREE users: blocked from both TRIAL and PREMIUM features
 *  - TRIAL users (active): can see TRIAL features, blocked from PREMIUM
 *  - TRIAL users (expired): blocked from everything
 *  - PREMIUM users: can see everything
 */
export const PremiumLockOverlay = ({
  featureName,
  requiredTier = 'PREMIUM',
  children,
}: PremiumLockOverlayProps) => {
  const tier = useSubscriptionTier();
  const userLevel = TIER_LEVEL[tier] ?? 0;
  const requiredLevel = TIER_LEVEL[requiredTier] ?? 2;

  if (userLevel >= requiredLevel) {
    return <>{children}</>;
  }

  const isExpiredTrial = tier === 'TRIAL';

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-lg">
        <div className="text-center p-6 max-w-sm">
          <div className="mx-auto mb-4 w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {featureName} requires {requiredTier === 'PREMIUM' ? 'Premium' : 'an active subscription'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {isExpiredTrial
              ? 'Your free trial has expired. Upgrade to continue using this feature.'
              : tier === 'FREE' && requiredTier === 'PREMIUM'
              ? 'This feature requires a Premium subscription.'
              : 'Upgrade your account to unlock this feature.'}
          </p>
          <a
            href="/subscription"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upgrade to Premium
          </a>
        </div>
      </div>
    </div>
  );
};

export default PremiumLockOverlay;
