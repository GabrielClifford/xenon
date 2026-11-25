'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Sub = { id: string; email: string; created_at: string };

// emails collected by the newsletter box on the store
export default function Subscribers({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Sub[] | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('store_subscribers').select('id, email, created_at').eq('business_id', businessId).order('created_at', { ascending: false }).limit(1000);
    if (error) { setRows([]); setNote('Run online_store_collections.sql in Supabase to turn this on.'); return; }
    setRows((data ?? []) as Sub[]);
  }, [supabase, businessId]);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await supabase.from('store_subscribers').delete().eq('id', id);
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
  }
  function csv() {
    const body = 'email,signed_up\n' + (rows ?? []).map((r) => `${r.email},${r.created_at.slice(0, 10)}`).join('\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'subscribers.csv'; a.click(); URL.revokeObjectURL(url);
  }
  async function copy() {
    try { await navigator.clipboard.writeText((rows ?? []).map((r) => r.email).join(', ')); setNote('Emails copied.'); } catch { setNote('Could not copy. Use Download instead.'); }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">Newsletter sign-ups</h2>
      <p className="mb-3 text-sm text-slate-500">Emails from the sign-up box in your store footer or the Newsletter section.</p>
      {rows === null ? <div className="h-10 animate-pulse rounded-lg bg-slate-100" /> : rows.length === 0 ? <p className="text-sm text-slate-500">{note || 'No sign-ups yet.'}</p> : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{rows.length} subscriber{rows.length === 1 ? '' : 's'}</span>
            <button onClick={copy} className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 font-medium">Copy emails</button>
            <button onClick={csv} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">Download CSV</button>
          </div>
          <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2"><span className="truncate">{r.email}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' })}<button onClick={() => remove(r.id)} aria-label={`Remove ${r.email}`} className="text-red-500"><Trash2 className="h-4 w-4" /></button></span></li>
            ))}
          </ul>
          {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
        </>
      )}
    </section>
  );
}
