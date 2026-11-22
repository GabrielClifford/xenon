'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PRODUCT_COLS, VARIANT_COLS, readProduct, readVariant } from '@/lib/products';
import { LOC_COLS, buildItems, inventoryError, readLevel, readLoc, type Item, type Loc } from '@/lib/inventory';
import { ListSkeleton, fetchAll, needsSql } from '@/components/products/ui';
import StockView from '@/components/products/StockView';
import HistoryView from '@/components/products/HistoryView';
import LocationsView from '@/components/products/LocationsView';

type Sub = 'stock' | 'history' | 'locations';
const subs: { id: Sub; label: string }[] = [
  { id: 'stock', label: 'Stock' },
  { id: 'history', label: 'History' },
  { id: 'locations', label: 'Locations' },
];

export default function InventoryPage({ businessId }: { businessId: string }) {
  const sb = useMemo(() => createClient(), []);
  const [sub, setSub] = useState<Sub>('stock');
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [locs, setLocs] = useState<Loc[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    let l = await sb.from('inventory_locations').select(LOC_COLS).eq('business_id', businessId).order('created_at', { ascending: true });
    if (!l.error && (l.data ?? []).length === 0) {
      // A new shop gets its first location, "Shop", on demand.
      const made = await sb.rpc('xenon_default_location', { p_business: businessId });
      if (made.error) {
        setFatal(needsSql(made.error.message) ? inventoryError('does not exist') : made.error.message);
        setLoading(false);
        return;
      }
      l = await sb.from('inventory_locations').select(LOC_COLS).eq('business_id', businessId).order('created_at', { ascending: true });
    }
    const [p, v, lv] = await Promise.all([
      fetchAll<Record<string, unknown>>((a, b) => sb.from('products').select(PRODUCT_COLS).eq('business_id', businessId).order('created_at', { ascending: false }).range(a, b)),
      fetchAll<Record<string, unknown>>((a, b) => sb.from('product_variants').select(VARIANT_COLS).eq('business_id', businessId).order('position', { ascending: true }).range(a, b)),
      fetchAll<Record<string, unknown>>((a, b) => sb.from('inventory_levels').select('location_id,product_id,variant_id,on_hand').eq('business_id', businessId).range(a, b)),
    ]);
    const msg = l.error?.message || p.error || v.error || lv.error;
    if (msg) {
      setFatal(needsSql(msg) ? inventoryError('does not exist') : msg);
      setLoading(false);
      return;
    }
    setFatal('');
    setLocs(((l.data ?? []) as Record<string, unknown>[]).map(readLoc));
    setItems(buildItems(p.data.map(readProduct), v.data.map(readVariant), lv.data.map(readLevel)));
    setLoading(false);
  }, [sb, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <ListSkeleton rows={5} />;
  if (fatal) return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{fatal}</p>;

  return (
    <div className="space-y-4">
      <nav className="flex gap-2" aria-label="Inventory sections">
        {subs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSub(s.id)}
            aria-current={sub === s.id ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${sub === s.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {s.label}
          </button>
        ))}
      </nav>
      {sub === 'stock' && <StockView businessId={businessId} locs={locs.filter((l) => l.active)} items={items} onChanged={load} />}
      {sub === 'history' && <HistoryView businessId={businessId} locs={locs} />}
      {sub === 'locations' && <LocationsView businessId={businessId} locs={locs} items={items} onChanged={load} />}
    </div>
  );
}
