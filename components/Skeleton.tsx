export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

const box = 'rounded-2xl border border-slate-200 bg-white shadow-sm';

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={`${box} p-5`}>
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <CardSkeleton rows={4} />
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${box} p-4`}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            <Skeleton className="mt-4 h-8 w-full" />
          </div>
        ))}
      </div>
      <div className={`${box} p-5`}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-56 w-full" />
      </div>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <StatsSkeleton />
      <CardSkeleton rows={3} />
    </div>
  );
}