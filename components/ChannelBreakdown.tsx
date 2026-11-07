'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadSources, sourceLabels, type SourceCount } from '@/lib/channels';
import { Skeleton } from '@/components/Skeleton';
export default function ChannelBreakdown({
  businessId,
  onViewAll,
}: {
  businessId: string;
  onViewAll: () => void;
}) {
  const [rows, setRows] = useState<SourceCount[] | null>(null);

  useEffect(() => {
    loadSources(createClient(), businessId)
      .then(setRows)
      .catch(() => setRows([]));
  }, [businessId]);

  const total = (rows ?? []).reduce((n, r) => n + r.visits, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-slate-900">Visits by channel</h2>
        <button onClick={onViewAll} className="text-xs font-semibold text-blue-600 hover:underline">
          Get links
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">Last 7 days</p>

      {rows === null ? (
        <Skeleton className="mt-4 h-24 w-full" />
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => {
            const pct = total ? Math.round((r.visits / total) * 100) : 0;
            return (
              <div key={r.source}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">{sourceLabels[r.source]}</span>
                  <span className="text-slate-500">
                    {r.visits} <span className="text-slate-400">· {pct}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows !== null && total === 0 && (
        <p className="mt-4 text-xs text-slate-500">No visits yet. Open the Channels page to copy your links.</p>
      )}
    </div>
  );
}