import { useState } from 'react';

interface BlockAppFormProps {
  isPending: boolean;
  disabled: boolean;
  showDeviceHint: boolean;
  /** Resolves on success, rejects on failure — the form only clears on success. */
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

  const canSubmit = !disabled && packageName.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await onBlock(packageName.trim(), reason.trim());
      setPackageName('');
      setReason('');
    } catch {
      // keep the input so the user can retry
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Block an App</h2>
      <div className="bg-white rounded-lg p-4 border flex flex-col sm:flex-row gap-3">
        <input
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          placeholder="Package name (e.g. com.android.chrome)"
          className="flex-1 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="flex-1 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
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
        <p className="text-xs text-gray-500 mt-2">Select a device above to target the block.</p>
      )}
    </section>
  );
}
