'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Globe, Pencil, Search, Sparkles, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { stateName, states, statesInZone, zones, type NgState, type NgZone } from '@/lib/nigeria';
import type { Market } from '@/lib/markets';
import CatalogsPanel from '@/components/CatalogsPanel';

type SubTab = 'markets' | 'catalogs' | 'rollouts';

const MARKET_COLUMNS = 'id,name,type,regions,status,is_default,created_at';

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600';

export default function MarketsPanel({ businessId }: { businessId: string }) {
  const [sub, setSub] = useState<SubTab>('markets');
  const tabs: [SubTab, string][] = [
    ['markets', 'All markets'],
    ['catalogs', 'Catalogs'],
    ['rollouts', 'Rollouts'],
  ];

  return (
    <div className="space-y-6">
      

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={`flex-1 rounded-lg py-2 transition ${
              sub === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'markets' && <MarketsList businessId={businessId} />}
      {sub === 'catalogs' && <CatalogsPanel businessId={businessId} />}
      {sub === 'rollouts' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Rollouts are coming next. They will let you schedule a catalog or sale to start and end on
          dates you choose.
        </div>
      )}
    </div>
  );
}

type FormState = { name: string; status: 'active' | 'draft'; regions: string[] };
const emptyForm: FormState = { name: '', status: 'active', regions: [] };

function MarketsList({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const seeded = useRef(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState<'all' | 'region'>('all');
  const [query, setQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    const read = () =>
      supabase
        .from('markets')
        .select(MARKET_COLUMNS)
        .eq('business_id', businessId)
        .order('created_at', { ascending: true });

    let { data, error } = await read();
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }
    // Every business starts with one market covering all of Nigeria.
    if ((data ?? []).length === 0 && !seeded.current) {
      seeded.current = true;
      await supabase.from('markets').insert({
        business_id: businessId,
        name: 'Nigeria',
        type: 'country',
        regions: [],
        status: 'active',
        is_default: true,
      });
      ({ data, error } = await read());
    }
    setMarkets((data ?? []) as Market[]);
    setLoading(false);
  }, [supabase, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const editing = markets.find((m) => m.id === editingId) ?? null;
  const isCountry = editing?.type === 'country';

  // States already used by another market, so two markets never overlap.
  const taken = new Map<string, string>();
  for (const m of markets) {
    if (m.type === 'region' && m.id !== editingId) for (const c of m.regions) taken.set(c, m.name);
  }

  const covered = new Set<string>();
  for (const m of markets) if (m.type === 'region') for (const c of m.regions) covered.add(c);
  const suggestion = zones.find((z) => statesInZone(z).every((s) => !covered.has(s.code)));

  const visible = markets
    .filter(
      (m) =>
        (filter === 'all' || m.type === 'region') &&
        m.name.toLowerCase().includes(query.trim().toLowerCase())
    )
    .sort(
      (a, b) =>
        Number(b.is_default) - Number(a.is_default) ||
        (newestFirst
          ? b.created_at.localeCompare(a.created_at)
          : a.name.localeCompare(b.name))
    );

  function startCreate(zone?: NgZone) {
    setEditingId(null);
    setForm(
      zone
        ? { name: zone, status: 'active', regions: statesInZone(zone).map((s) => s.code) }
        : emptyForm
    );
    setErrorMsg('');
    setOpen(true);
  }

  function startEdit(m: Market) {
    setEditingId(m.id);
    setForm({ name: m.name, status: m.status, regions: m.regions });
    setErrorMsg('');
    setOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleRegion(code: string) {
    setForm((f) => ({
      ...f,
      regions: f.regions.includes(code) ? f.regions.filter((c) => c !== code) : [...f.regions, code],
    }));
  }

  function toggleZone(free: NgState[], allOn: boolean) {
    const codes = free.map((s) => s.code);
    setForm((f) => ({
      ...f,
      regions: allOn
        ? f.regions.filter((c) => !codes.includes(c))
        : Array.from(new Set([...f.regions, ...codes])),
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg('');

    const name = form.name.trim();
    if (!name) {
      setErrorMsg('Enter a market name.');
      return;
    }
    if (!isCountry && form.regions.length === 0) {
      setErrorMsg('Choose at least one state.');
      return;
    }

    setSaving(true);
    const status = editing?.is_default ? 'active' : form.status;
    const { error } = editingId
      ? await supabase
          .from('markets')
          .update(isCountry ? { name, status } : { name, status, regions: form.regions })
          .eq('id', editingId)
      : await supabase.from('markets').insert({
          business_id: businessId,
          name,
          type: 'region',
          regions: form.regions,
          status,
          is_default: false,
        });
    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    closeForm();
    await load();
  }

  async function remove(m: Market) {
    if (m.is_default) return;
    if (!window.confirm(`Delete the "${m.name}" market? Catalogs linked to it will stop applying there.`))
      return;
    const { error } = await supabase.from('markets').delete().eq('id', m.id);
    if (error) setErrorMsg(error.message);
    else await load();
  }

  const summary = (m: Market) => {
    if (m.type === 'country') return 'All of Nigeria';
    const names = m.regions.slice(0, 3).map(stateName).join(', ');
    return m.regions.length > 3 ? `${names} +${m.regions.length - 3} more` : names;
  };

  return (
    <div className="space-y-4">
      {open && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="font-display font-bold text-slate-900">
            {editingId ? 'Edit market' : 'Create a market'}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Market name, for example South South"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={field}
            />
            <select
              value={editing?.is_default ? 'active' : form.status}
              disabled={editing?.is_default}
              onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'draft' })}
              className={field}
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {isCountry ? (
            <p className="text-sm text-slate-500">
              This market covers all of Nigeria. Visitors from states without their own market see
              it.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-600">States in this market</p>
              {zones.map((z) => {
                const list = statesInZone(z);
                const free = list.filter((s) => !taken.has(s.code));
                const allOn = free.length > 0 && free.every((s) => form.regions.includes(s.code));
                return (
                  <div key={z} className="rounded-xl border border-slate-200 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={allOn}
                        disabled={free.length === 0}
                        onChange={() => toggleZone(free, allOn)}
                      />
                      {z}
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                      {list.map((s) => {
                        const other = taken.get(s.code);
                        return (
                          <label
                            key={s.code}
                            className={`flex items-center gap-2 text-sm ${
                              other ? 'text-slate-400' : 'text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!!other}
                              checked={form.regions.includes(s.code)}
                              onChange={() => toggleRegion(s.code)}
                            />
                            <span className="truncate" title={other ? `In ${other}` : undefined}>
                              {s.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {taken.size > 0 && (
                <p className="text-xs text-slate-400">
                  Greyed-out states already belong to another market.
                </p>
              )}
            </div>
          )}

          {errorMsg && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create market'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          {(['all', 'region'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                filter === f ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? 'All' : 'Regions'}
            </button>
          ))}
          <div className="relative ml-auto min-w-[8rem] flex-1 sm:max-w-[14rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search markets"
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setNewestFirst((v) => !v)}
            aria-label="Change sort order"
            title={newestFirst ? 'Newest first' : 'A to Z'}
            className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => startCreate()}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Add market
          </button>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-slate-400">Loading markets...</p>
        ) : visible.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No markets match.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-4">
                <Globe className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{m.name}</p>
                  <p className="truncate text-xs text-slate-500">{summary(m)}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    m.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {m.status === 'active' ? 'Active' : 'Draft'}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(m)}
                  aria-label={`Edit ${m.name}`}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {!m.is_default && (
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    aria-label={`Delete ${m.name}`}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!loading && !open && suggestion && (
          <button
            type="button"
            onClick={() => startCreate(suggestion)}
            className="flex w-full items-center gap-3 border-t border-slate-100 bg-violet-50 px-4 py-3 text-left text-sm font-medium text-violet-900 hover:bg-violet-100"
          >
            <Sparkles className="h-4 w-4 text-violet-600" />
            Create {suggestion} market
          </button>
        )}
      </div>

      {!open && errorMsg && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
      )}
      <p className="text-xs text-slate-400">
        {states.length} states and the FCT are available. A state can belong to one region market
        at a time.
      </p>
    </div>
  );
}
