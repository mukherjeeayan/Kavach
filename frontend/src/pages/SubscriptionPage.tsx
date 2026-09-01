import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useSubscriptionTier } from '../store/authSlice';
import { fetchSubscriptionPlans, createRazorpayOrder } from '../services/api';
import Toast from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';

export default function SubscriptionPage() {
  const { user } = useAuth();
  const tier = useSubscriptionTier();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: fetchSubscriptionPlans,
  });

  const isPremium = tier === 'PREMIUM';
  const isTrial = tier === 'TRIAL';
  const trialExpired = isTrial && user?.trial_expires_at && new Date(user.trial_expires_at).getTime() < Date.now();
  const daysLeft = isTrial && user?.trial_expires_at
    ? Math.max(0, Math.ceil((new Date(user.trial_expires_at).getTime() - Date.now()) / 86400000))
    : 0;

  const handleRazorpayCheckout = async () => {
    try {
      const { order_id, amount, currency, key } = await createRazorpayOrder(period);

      const options = {
        key,
        amount,
        currency,
        name: 'Kavach',
        description: `Premium Subscription - ${period}`,
        order_id,
        handler: function () {
          setToastMessage('Payment successful! Your account will be upgraded shortly.');
        },
        prefill: {
          name: user?.name ?? '',
          email: user?.email ?? '',
        },
        theme: {
          color: '#2563eb',
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Razorpay = (window as any).Razorpay;
      if (Razorpay) {
        const rzp = new Razorpay(options);
        rzp.open();
      } else {
        setToastMessage('Razorpay SDK not loaded. Please refresh and try again.');
      }
    } catch {
      setToastMessage('Failed to create order. Please try again.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Subscription</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Manage your Kavach subscription plan.</p>

      {/* Current Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Current Plan</h2>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isPremium
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : isTrial && !trialExpired
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {isPremium ? 'Premium' : isTrial && !trialExpired ? 'Free Trial' : 'Free'}
          </span>
          {isTrial && !trialExpired && (
            <span className="text-sm text-gray-500">
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
            </span>
          )}
          {trialExpired && (
            <span className="text-sm text-red-500">Trial expired</span>
          )}
        </div>
        {isTrial && user?.trial_expires_at && (
          <p className="text-sm text-gray-500 mt-2">
            Trial expires: {new Date(user.trial_expires_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Upgrade Section */}
      {!isPremium && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upgrade to Premium</h2>

          {/* Period Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriod('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Yearly <span className="text-xs opacity-75">Save 30%</span>
            </button>
          </div>

          {/* Price Display */}
          {plansQuery.isLoading ? (
            <Skeleton className="h-16" />
          ) : plansQuery.data?.premium ? (
            <div className="mb-6">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {period === 'monthly' ? '₹299' : '₹2,499'}
                <span className="text-base font-normal text-gray-500">/{period === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
              {period === 'yearly' && (
                <p className="text-sm text-green-600 mt-1">Save ₹1,089 per year</p>
              )}
            </div>
          ) : null}

          {/* Features */}
          <ul className="space-y-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Real-time GPS location tracking
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Geofencing & safe-zone alerts
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Communication & keyword monitoring
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              AI-powered behavior predictions
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Self-harm detection & alerts
            </li>
          </ul>

          {/* Payment Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleRazorpayCheckout}
              className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Pay with Razorpay
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center">
            Secure payment processing. Cancel anytime.
          </p>
        </div>
      )}

      {/* Already Premium */}
      {isPremium && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-300">You're on Premium!</h3>
              <p className="text-sm text-green-700 dark:text-green-400">
                All features are unlocked. Manage your subscription from your payment provider's dashboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}
