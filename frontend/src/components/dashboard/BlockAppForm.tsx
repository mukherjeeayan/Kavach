import { useState } from 'react';
import Toast from '../ui/Toast';

interface BlockAppFormProps {
  isPending: boolean;
  disabled: boolean;
  showDeviceHint: boolean;
  onBlock: (packageName: string, reason: string) => Promise<unknown>;
}

export default function BlockAppForm({
  isPending,
  disabled,
  showDeviceHint,
  onBlock,
}: BlockAppFormProps) {
  const [packageName, setPackageName] = useState('');
  const [reason, setReason] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const canSubmit = !disabled && packageName.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await onBlock(packageName.trim(), reason.trim());
      setPackageName('');
      setReason('');
      setShowSuccess(true);
    } catch {
      // keep the input so the user can retry
    }
  };

  return (
    <section className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Block an App</h2>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
        <input
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          placeholder="Package name (e.g. com.android.chrome)"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 transition-colors"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 transition-colors"
        />
        <button
          onClick={submit}
          disabled={isPending || !canSubmit}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Blocking...' : 'Block App'}
        </button>
      </div>
      {showDeviceHint && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Select a device above to target the block.</p>
      )}
      {showSuccess && (
        <Toast message="App blocked successfully" type="success" onClose={() => setShowSuccess(false)} />
      )}
    </section>
  );
}
