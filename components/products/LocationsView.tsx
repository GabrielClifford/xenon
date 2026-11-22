'use client';

import { useMemo, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { inventoryError, qtyAt, type Item, type Loc } from '@/lib/inventory';
import { Badge, Err, Modal, Toggle, btn, card, danger, field, ghost, labelCls } from '@/components/products/ui';

export default function LocationsView({ businessId, locs, items, onChanged }: { businessId: string; locs: Loc[]; items: Item[]; onChanged: () => void }) {
  const sb = useMemo(() => createClient(), []);
  const [editing, setEditing] = useState<Loc | 'new' | null>(null);
  const [moving, setMoving] = useState<Loc | null>(null);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const stats = (l: Loc) => {
    let units = 0;
    let lines = 0;
    for (const i of items) {
      const n = qtyAt(i, l.id);
      if (n > 0) {
        units += n;
        lines += 1;
      }
    }
    return { units, lines };
  };

  async function makeDefault(l: Loc) {
    setErr('');
    setBusy(l.id);
    const { error } = await sb.rpc('xenon_set_default_location', { p_location: l.id });
    setBusy('');
    if (error) return setErr(inventoryError(error.message));
    setNotice(`${l.name} is now your default location. New stock goes there.`);
    onChanged();
  }

  async function remove(l: Loc) {
    if (!window.confirm(`Delete the location "${l.name}"? Its stock history is kept.`)) return;
    setErr('');
    setBusy(l.id);
    const { error } = await sb.from('inventory_locations').delete().eq('id', l.id).eq('business_id', businessId);
    setBusy('');
    if (error) return setErr(inventoryError(error.message));
    setNotice(`${l.name} was deleted.`);
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-slate-500">Places where you keep stock, like your shop and a warehouse. Each product has its own count at every location.</p>
        <button type="button" className={`${btn} inline-flex items-center gap-1.5`} onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Add location
        </button>
      </div>

      {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      <Err text={err} />

      <ul className="space-y-3">
        {locs.map((l) => {
          const s = stats(l);
          return (
            <li key={l.id} className={`${card} ${l.active ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-start gap-3">
                <span className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-600">
                  <MapPin className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-bold text-slate-900">{l.name}</p>
                    {l.is_default && <Badge tone="blue">Default</Badge>}
                    {!l.active && <Badge tone="grey">Off</Badge>}
                    {l.active && (l.sells_online ? <Badge tone="green">Sells online</Badge> : <Badge tone="amber">Not sold online</Badge>)}
                  </div>
                  {(l.address || l.phone) && (
                    <p className="mt-0.5 text-sm text-slate-500">
                      {l.address}
                      {l.address && l.phone ? ' · ' : ''}
                      {l.phone}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-600">
                    {s.units.toLocaleString('en-NG')} unit{s.units === 1 ? '' : 's'} across {s.lines} item{s.lines === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={ghost} onClick={() => setEditing(l)}>
                    Edit
                  </button>
                  {s.units > 0 && locs.some((x) => x.id !== l.id && x.active) && (
                    <button type="button" className={ghost} onClick={() => setMoving(l)}>
                      Move stock
                    </button>
                  )}
                  {l.active && !l.is_default && (
                    <button type="button" className={ghost} disabled={busy === l.id} onClick={() => makeDefault(l)}>
                      Make default
                    </button>
                  )}
                  {!l.is_default && (
                    <button type="button" className={danger} disabled={busy === l.id || s.units > 0} title={s.units > 0 ? 'Move the stock out first' : undefined} onClick={() => remove(l)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <LocationModal
          businessId={businessId}
          loc={editing === 'new' ? null : editing}
          units={editing === 'new' ? 0 : stats(editing).units}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setNotice(msg);
            onChanged();
          }}
        />
      )}
      {moving && (
        <MoveModal
          from={moving}
          locs={locs.filter((l) => l.active && l.id !== moving.id)}
          onClose={() => setMoving(null)}
          onDone={(msg) => {
            setMoving(null);
            setNotice(msg);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function LocationModal({ businessId, loc, units, onClose, onSaved }: { businessId: string; loc: Loc | null; units: number; onClose: () => void; onSaved: (msg: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [name, setName] = useState(loc?.name ?? '');
  const [address, setAddress] = useState(loc?.address ?? '');
  const [phone, setPhone] = useState(loc?.phone ?? '');
  const [online, setOnline] = useState(loc?.sells_online ?? true);
  const [active, setActive] = useState(loc?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return setErr('Enter a name for this location.');
    setBusy(true);
    const payload = { name: n, address: address.trim() || null, phone: phone.trim() || null, sells_online: online, active };
    const { error } = loc ? await sb.from('inventory_locations').update(payload).eq('id', loc.id).eq('business_id', businessId) : await sb.from('inventory_locations').insert({ ...payload, business_id: businessId });
    if (error) {
      setBusy(false);
      setErr(/duplicate key|inventory_locations_name_idx/i.test(error.message) ? 'You already have a location with that name.' : inventoryError(error.message));
      return;
    }
    onSaved(loc ? `${n} was updated.` : `${n} was added. Use Adjust or a stock count in Stock to put items there.`);
  }

  return (
    <Modal title={loc ? 'Edit location' : 'Add location'} onClose={onClose}>
      <div className="space-y-4">
        <Err text={err} />
        <div>
          <label className={labelCls}>Name</label>
          <input className={field} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Warehouse" autoFocus />
        </div>
        <div>
          <label className={labelCls}>Address (optional)</label>
          <input className={field} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Phone (optional)</label>
          <input className={field} maxLength={30} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Toggle on={online} onChange={setOnline} label="Stock here can be sold online" hint="When off, items kept here do not count toward what your website can sell." />
        {loc && !loc.is_default && (
          <div>
            <Toggle on={active} onChange={setActive} label="Location is on" hint="Turn off a place you no longer use. Its stock must be moved out first." />
            {!active && loc.active && units > 0 && <p className="mt-2 text-xs text-amber-700">This location still has {units} unit{units === 1 ? '' : 's'}. Close this window and use Move stock first.</p>}
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={save} disabled={busy}>
            {busy ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MoveModal({ from, locs, onClose, onDone }: { from: Loc; locs: Loc[]; onClose: () => void; onDone: (msg: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [to, setTo] = useState(locs[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setErr('');
    setBusy(true);
    const { data, error } = await sb.rpc('xenon_move_location_stock', { p_from: from.id, p_to: to });
    if (error) {
      setBusy(false);
      return setErr(inventoryError(error.message));
    }
    const n = typeof data === 'number' ? data : 0;
    onDone(`Moved ${n} item${n === 1 ? '' : 's'} from ${from.name} to ${locs.find((l) => l.id === to)?.name ?? 'the new location'}.`);
  }

  return (
    <Modal title={`Move stock out of ${from.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Everything kept at {from.name} moves to the location you choose. Each move is saved in History.</p>
        <Err text={err} />
        <div>
          <label className={labelCls}>Move to</label>
          <select className={field} value={to} onChange={(e) => setTo(e.target.value)}>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={go} disabled={busy || !to}>
            {busy ? 'Moving...' : 'Move all stock'}
          </button>
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
