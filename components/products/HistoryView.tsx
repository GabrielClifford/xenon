'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MOVE_COLS, fmtDate, inventoryError, movementsToCsv, readMovement, reasonLabel, type Loc, type Movement, type Reason } from '@/lib/inventory';
import { Badge, Err, ListSkeleton, field, ghost } from '@/components/products/ui';
import { downloadCsv, today } from '@/components/products/inventoryUi';

const PAGE = 50;
const ranges = [
  { v: '7', t: 'Last 7 days' },
  { v: '30', t: 'Last 30 days' },
  { v: '90', t: 'Last 90 days' },
  { v: 'all', t: 'All time' },
];

export default function HistoryView({ businessId, locs }: { businessId: string; locs: Loc[] }) {
  const sb = useMemo(() => createClient(), []);
  const [list, setList] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [loc, setLoc] = useState('');
  const [reason, setReason] = useState('');
  const [range, setRange] = useState('30');

  // Wait a moment after typing before searching
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(
    async (from: number) => {
      let query = sb.from('inventory_movements').select(MOVE_COLS).eq('business_id', businessId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + PAGE - 1);
      if (loc) query = query.eq('location_id', loc);
      if (reason) query = query.eq('reason', reason);
      if (term) query = query.ilike('item_name', `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
      if (range !== 'all') query = query.gte('created_at', new Date(Date.now() - Number(range) * 86400000).toISOString());
      const { data, error } = await query;
      if (error) {
        setErr(inventoryError(error.message));
        return null;
      }
      setErr('');
      return ((data ?? []) as Record<string, unknown>[]).map(readMovement);
    },
    [sb, businessId, loc, reason, term, range],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPage(0).then((rows) => {
      if (!alive) return;
      if (rows) {
        setList(rows);
        setMore(rows.length === PAGE);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  async function loadMore() {
    const rows = await fetchPage(list.length);
    if (rows) {
      setList((l) => [...l, ...rows]);
      setMore(rows.length === PAGE);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${field} pl-9`} placeholder="Search by item name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={`${field} w-auto`} value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Location">
          <option value="">All locations</option>
          {locs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select className={`${field} w-auto`} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
          <option value="">All reasons</option>
          {(Object.keys(reasonLabel) as Reason[]).map((r) => (
            <option key={r} value={r}>
              {reasonLabel[r]}
            </option>
          ))}
        </select>
        <select className={`${field} w-auto`} value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
          {ranges.map((r) => (
            <option key={r.v} value={r.v}>
              {r.t}
            </option>
          ))}
        </select>
        <button type="button" className={`${ghost} inline-flex items-center gap-1.5`} disabled={list.length === 0} onClick={() => downloadCsv(`stock-history-${today()}.csv`, movementsToCsv(list))}>
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <Err text={err} />

      {loading ? (
        <ListSkeleton rows={5} />
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">No stock changes match. Every time stock is added, removed, counted or moved, it shows up here.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">When</th>
                <th className="px-2 py-2.5">Item</th>
                <th className="px-2 py-2.5">Location</th>
                <th className="px-2 py-2.5 text-right">Change</th>
                <th className="px-2 py-2.5 text-right">After</th>
                <th className="px-2 py-2.5">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(m.created_at)}</td>
                  <td className="px-2 py-2">
                    <span className="block font-medium text-slate-900">{m.item_name ?? 'Deleted item'}</span>
                    {m.note && <span className="block text-xs text-slate-400">{m.note}</span>}
                  </td>
                  <td className="px-2 py-2 text-slate-600">{m.location_name ?? 'Removed location'}</td>
                  <td className={`px-2 py-2 text-right font-semibold ${m.delta > 0 ? 'text-green-700' : 'text-red-600'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td className="px-2 py-2 text-right text-slate-700">{m.quantity_after}</td>
                  <td className="px-2 py-2">
                    <Badge tone={m.delta > 0 ? 'green' : 'amber'}>{reasonLabel[m.reason]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {more && !loading && (
        <div className="text-center">
          <button type="button" className={ghost} onClick={loadMore}>
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
