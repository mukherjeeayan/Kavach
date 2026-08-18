import type { AppBlockRule } from '../../types/api';

interface UnblockRequestsProps {
  rules: AppBlockRule[];
  isPending: boolean;
  onApprove: (ruleId: string) => void;
  onReject: (ruleId: string) => void;
}

export default function UnblockRequests({
  rules,
  isPending,
  onApprove,
  onReject,
}: UnblockRequestsProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Unblock Requests</h2>
      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="bg-white rounded-lg p-4 border flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-medium">
                {rule.app_name ?? rule.package_name}
                <span className="ml-2 font-mono text-xs text-gray-400">{rule.package_name}</span>
              </p>
              <p className="text-sm text-gray-600">
                Reason: {rule.unblock_reason ?? 'No reason given'}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onApprove(rule.id)}
                disabled={isPending}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onReject(rule.id)}
                disabled={isPending}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <p className="text-sm text-gray-400">No pending unblock requests.</p>}
      </div>
    </section>
  );
}
