interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div aria-hidden="true" className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div aria-hidden="true" className="bg-white rounded-lg border p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 flex gap-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex gap-4 border-t">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div aria-hidden="true" className="bg-white rounded-lg border p-4">
      <Skeleton className="h-4 w-1/4 mb-4" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="bg-white rounded-lg p-4 border space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
      </div>
      <div className="bg-white rounded-lg p-4 border space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonList({ items = 3 }: { items?: number }) {
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
