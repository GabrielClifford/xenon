'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Discount = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_order: number;
  usage_limit: number | null;
  times_used: number;
  expires_at: string | null;
  active: boolean;
};

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const empty = { code: '', type: 'percent', value: '', min_order: '', usage_limit: '', expires: '' };

export default function DiscountsPanel({ user }: { user: User }) {
  const supabase = useMemo(() => createClient(), []);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [list, setList] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load(bid: string) {
    const { data } = await supabase
      .from('discounts')
      .select('*')
      .eq('business_id', bid)
      .order('created_at', { ascending: false });
    setList((data as Discount[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle();
      if (b) {
        setBusinessId(b.id);
        await load(b.id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function save() {
    if (!form || !businessId) return;
    const code = form.code.trim().toUpperCase();
    const value = Number(form.value);
    if (!code || /\s/.test(code)) return setError('Enter a code with no spaces, e.g. WELCOME10.');
    if (!value || value <= 0) return setError('Enter the discount value.');
    if (form.type === 'percent' && value > 100) return setError('A percentage cannot be more than 100.');
    setSaving(true);
    setError('');
    const { error: dbErr } = await supabase.from('discounts').insert({
      business_id: businessId,
      code,
      type: form.type,
      value,
      min_order: Number(form.min_order) || 0,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit, 10) : null,
      expires_at: form.expires ? new Date(form.expires + 'T23:59:59').toISOString() : null,
    });
    setSaving(false);
    if (dbErr) return setError(dbErr.message.includes('duplicate') ? 'You already have a code with that name.' : dbErr.message);
    setForm(null);
    await load(businessId);
  }

  async function toggle(d: Discount) {
    await supabase.from('discounts').update({ active: !d.active }).eq('id', d.id);
    setList((l) => l.map((x) => (x.id === d.id ? { ...x, active: !x.active } : x)));
  }

  async function remove(d: Discount) {
    if (!businessId || !confirm(`Delete code ${d.code}?`)) return;
    await supabase.from('discounts').delete().eq('id', d.id);
    await load(businessId);
  }

  if (loading) return <p className="text-sm text-slate-400">Loading discounts...</p>;
  if (!businessId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Create your website first (My website), then you can add discount codes.
      </div>
    );
  }

  if (form) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Create discount code</h1>
        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Code</label>
            <input className={field} placeholder="e.g. WELCOME10" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select className={field} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="percent">Percentage off</option>
                <option value="fixed">Fixed amount off (₦)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{form.type === 'percent' ? 'Percent (%)' : 'Amount (₦)'}</label>
              <input type="number" min="0" className={field} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Minimum order (₦, optional)</label>
              <input type="number" min="0" className={field} value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Max uses (optional)</label>
              <input type="number" min="1" className={field} value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Expires on (optional)</label>
              <input type="date" className={field} value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save code'}
            </button>
            <button
              onClick={() => {
                setForm(null);
                setError('');
              }}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Discounts</h1>
        <button onClick={() => setForm(empty)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Create code
        </button>
      </div>

      {list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No discount codes yet. Customers enter a code in their cart to get money off.
        </div>
      ) : (
        <div className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {list.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold tracking-wide">{d.code}</p>
                <p className="text-xs text-slate-500">
                  {d.type === 'percent' ? `${d.value}% off` : `${naira(d.value)} off`}
                  {d.min_order > 0 && ` · min ${naira(d.min_order)}`}
                  {` · ${d.times_used}${d.usage_limit ? ` / ${d.usage_limit}` : ''} used`}
                  {d.expires_at && ` · expires ${new Date(d.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <button
                onClick={() => toggle(d)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${d.active ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}
              >
                {d.active ? 'Active' : 'Paused'}
              </button>
              <button onClick={() => remove(d)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}