'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { MessageCircle, Phone, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';

type Status = 'new' | 'contacted' | 'done';
type Enquiry = {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  status: Status;
  created_at: string;
};

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const badge: Record<Status, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-800',
  done: 'bg-slate-100 text-slate-600',
};

function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('234')) return d;
  if (d.startsWith('0')) return `234${d.slice(1)}`;
  return d;
}

export default function CustomersPanel({ user }: { user: User }) {
  const [rows, setRows] = useState<Enquiry[] | null>(null);
  const [hasBusiness, setHasBusiness] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle();
      if (!biz) {
        setHasBusiness(false);
        setRows([]);
        return;
      }
      const { data, error: err } = await supabase
        .from('enquiries')
        .select('id,name,phone,message,status,created_at')
        .eq('business_id', biz.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) setError(err.message);
      setRows((data ?? []) as Enquiry[]);
    })();
  }, [user.id]);

  async function setStatus(id: string, status: Status) {
    setRows((r) => (r ?? []).map((x) => (x.id === id ? { ...x, status } : x)));
    const { error: err } = await createClient().from('enquiries').update({ status }).eq('id', id);
    if (err) setError('Could not update the status. Please refresh and try again.');
  }

  const stats = useMemo(() => {
    const list = rows ?? [];
    const week = Date.now() - 7 * 86400000;
    return {
      customers: new Set(list.map((r) => r.phone.replace(/\D/g, ''))).size,
      fresh: list.filter((r) => r.status === 'new').length,
      week: list.filter((r) => new Date(r.created_at).getTime() >= week).length,
    };
  }, [rows]);

  const shown = (rows ?? []).filter((r) => {
    const q = query.trim().toLowerCase();
    return !q || `${r.name} ${r.phone} ${r.message ?? ''}`.toLowerCase().includes(q);
  });

  if (rows === null) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-slate-900">Customers</h1>
        <p className="mt-1 text-slate-500">People who contacted you through your website.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className={`${card} grid grid-cols-3 divide-x divide-slate-100 p-2`}>
        {[
          { label: 'Customers', value: stats.customers },
          { label: 'New enquiries', value: stats.fresh },
          { label: 'Last 7 days', value: stats.week },
        ].map((s) => (
          <div key={s.label} className="p-4">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="font-display mt-1 text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className={`${card} flex flex-col items-center p-10 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Users className="h-6 w-6" />
          </span>
          <h2 className="font-display mt-4 text-lg font-semibold text-slate-900">No customers yet</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            {hasBusiness
              ? 'When someone fills in the contact form on your website, they will appear here. Share your channel links to get your first enquiry.'
              : 'Create and publish your website first. Customers who contact you will appear here.'}
          </p>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone or message"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600"
          />
          <div className="space-y-3">
            {shown.map((r) => (
              <div key={r.id} className={`${card} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    <p className="text-sm text-slate-500">{r.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[r.status]}`}>
                      {r.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                {r.message && <p className="mt-3 text-sm leading-relaxed text-slate-600">{r.message}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${r.phone}`}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                  <a
                    href={`https://wa.me/${waNumber(r.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                  <select
                    value={r.status}
                    onChange={(e) => setStatus(r.id, e.target.value as Status)}
                    className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
            ))}
            {shown.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No matches.</p>}
          </div>
        </>
      )}
    </div>
  );
}