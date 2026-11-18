'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ChevronRight, MoreHorizontal, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  PLAN_LOCATION_LIMIT,
  blankLocation,
  formatAddress,
  hasAddress,
  readLocations,
  type Address,
  type Location,
} from '@/lib/locations';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const sel = 'rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500';

type Filter = 'all' | 'active' | 'inactive';

function Heading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl font-bold text-slate-900">{title}</h2>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
    </div>
  );
}

function Note({ text }: { text: string }) {
  if (!text) return null;
  const bad = /fail|error|could not|must|match|least|invalid/i.test(text);
  return <p className={`mt-3 text-sm ${bad ? 'text-red-600' : 'text-green-700'}`}>{text}</p>;
}

function Sec({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
      {text && <p className="mt-0.5 text-sm text-slate-500">{text}</p>}
      <div className={`${card} mt-3`}>{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  text,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  text: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 py-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </label>
  );
}

function Pill({ tone, children }: { tone: 'green' | 'gray'; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        tone === 'green' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {children}
    </span>
  );
}

export default function LocationsPage({ user, onGo }: { user: User; onGo: (id: 'shipping') => void }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState('');
  const [locs, setLocs] = useState<Location[]>([]);
  const [draft, setDraft] = useState<Location | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('id,locations_options')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message);
          setBizId(null);
          return;
        }
        setBizId(data?.id ?? null);
        if (data) setLocs(readLocations(data.locations_options));
      });
  }, [user.id]);

  const activeCount = locs.filter((l) => l.active).length;
  const atLimit = activeCount >= PLAN_LOCATION_LIMIT;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locs
      .filter((l) => (filter === 'all' ? true : filter === 'active' ? l.active : !l.active))
      .filter((l) => !q || l.name.toLowerCase().includes(q) || formatAddress(l.address).toLowerCase().includes(q))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }, [locs, query, filter]);

  async function persist(next: Location[]): Promise<boolean> {
    if (!bizId) return false;
    setSaving(true);
    setMsg('');
    const { error } = await createClient()
      .from('businesses')
      .update({ locations_options: { locations: next } })
      .eq('id', bizId);
    setSaving(false);
    if (error) {
      setMsg('Could not save: ' + error.message);
      return false;
    }
    setLocs(next);
    return true;
  }

  function openNew() {
    setDraft(blankLocation());
    setIsNew(true);
    setAddrOpen(true);
    setMenu(false);
    setMsg('');
  }

  function openEdit(l: Location) {
    setDraft(l);
    setIsNew(false);
    setAddrOpen(false);
    setMenu(false);
    setMsg('');
  }

  const patch = (p: Partial<Location>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchAddr = (p: Partial<Address>) => setDraft((d) => (d ? { ...d, address: { ...d.address, ...p } } : d));

  async function save() {
    if (!draft) return;
    const name = draft.name.trim();
    const others = locs.filter((l) => l.id !== draft.id);
    if (!name) return setMsg('Could not save: enter a name for this location.');
    if (others.some((l) => l.name.trim().toLowerCase() === name.toLowerCase()))
      return setMsg('Could not save: you already have a location with this name.');
    if (!hasAddress(draft.address)) {
      setAddrOpen(true);
      return setMsg('Could not save: add a street address, city and country.');
    }
    if (draft.active && others.filter((l) => l.active).length >= PLAN_LOCATION_LIMIT)
      return setMsg(`Could not save: your plan allows ${PLAN_LOCATION_LIMIT} active locations.`);

    const first = others.length === 0;
    const isDefault = first || draft.isDefault;
    const clean: Location = {
      ...draft,
      name,
      isDefault,
      fulfillOnline: isDefault ? true : draft.fulfillOnline,
      posPro: draft.pos && draft.posPro,
    };
    const next = isNew ? [...locs, clean] : locs.map((l) => (l.id === clean.id ? clean : l));
    if (!(await persist(next))) return;
    if (isNew) {
      setDraft(null);
      setMsg('Location added.');
    } else {
      setDraft(clean);
      setMsg('Saved.');
    }
  }

  async function makeDefault(l: Location) {
    setMenu(false);
    const next = locs.map((x) =>
      x.id === l.id ? { ...x, isDefault: true, active: true, fulfillOnline: true } : { ...x, isDefault: false }
    );
    if (await persist(next)) {
      setDraft(next.find((x) => x.id === l.id) ?? null);
      setMsg('Default location updated.');
    }
  }

  async function toggleActive(l: Location) {
    setMenu(false);
    if (l.isDefault) return;
    if (l.active && !confirm('Deactivate this location? It will stop being used for orders.')) return;
    if (!l.active && atLimit)
      return setMsg(`Could not activate: your plan allows ${PLAN_LOCATION_LIMIT} active locations.`);
    const next = locs.map((x) => (x.id === l.id ? { ...x, active: !l.active } : x));
    if (await persist(next)) {
      setDraft(next.find((x) => x.id === l.id) ?? null);
      setMsg(l.active ? 'Location deactivated.' : 'Location activated.');
    }
  }

  async function remove(l: Location) {
    setMenu(false);
    if (l.isDefault || l.active) return;
    if (!confirm('Delete this location permanently?')) return;
    if (await persist(locs.filter((x) => x.id !== l.id))) {
      setDraft(null);
      setMsg('Location deleted.');
    }
  }

  if (bizId === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (bizId === null) {
    return (
      <div className="space-y-5">
        <Heading title="Locations" />
        <div className={card}>
          {loadError ? (
            <p className="text-sm text-red-600">
              Could not load locations: {loadError}
              {/locations_options/.test(loadError) && (
                <span className="mt-2 block text-slate-600">
                  Run this in your Supabase SQL editor, then refresh: alter table businesses add column if not exists locations_options jsonb;
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
          )}
        </div>
      </div>
    );
  }

  // ----- add or edit one location -----
  if (draft) {
    const saved = locs.find((l) => l.id === draft.id);
    const dirty = isNew || JSON.stringify(draft) !== JSON.stringify(saved);
    const isDefault = draft.isDefault || (isNew && locs.length === 0);
    const fulfillOn = isDefault || draft.fulfillOnline;

    return (
      <div className="space-y-7">
        <div>
          <button
            onClick={() => {
              setDraft(null);
              setMsg('');
            }}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Locations
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {isNew ? 'Add location' : saved?.name || 'Location'}
              </h2>
              {!isNew && saved && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill tone={saved.active ? 'green' : 'gray'}>{saved.active ? 'Active' : 'Inactive'}</Pill>
                  {saved.isDefault && <Pill tone="gray">Default</Pill>}
                </div>
              )}
            </div>
            {!isNew && saved && (
              <div className="relative">
                <button
                  onClick={() => setMenu((o) => !o)}
                  className="rounded-full border border-slate-200 bg-white p-2.5 hover:bg-slate-50"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {menu && (
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(false)} aria-label="Close menu" />
                    <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      {saved.isDefault ? (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          Make another location the default before you deactivate or delete this one.
                        </p>
                      ) : (
                        <>
                          {saved.active && (
                            <button onClick={() => makeDefault(saved)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">
                              Make default location
                            </button>
                          )}
                          <button onClick={() => toggleActive(saved)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">
                            {saved.active ? 'Deactivate location' : 'Activate location'}
                          </button>
                          {!saved.active && (
                            <button onClick={() => remove(saved)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50">
                              Delete location
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={card}>
          <div>
            <label className={label}>Name</label>
            <input
              className={field}
              maxLength={60}
              placeholder="e.g. Paris Warehouse"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">Customers see this name at checkout if you offer local pickup.</p>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <button onClick={() => setAddrOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
              <span className="flex-1">
                <span className="block text-sm font-semibold text-slate-900">Address</span>
                <span className="block text-xs text-slate-500">
                  {hasAddress(draft.address) ? formatAddress(draft.address) : 'No address'}
                </span>
              </span>
              <ChevronRight className={`h-4 w-4 text-slate-400 transition ${addrOpen ? 'rotate-90' : ''}`} />
            </button>
            {addrOpen && (
              <div className="mt-3 space-y-3">
                <input className={field} placeholder="Street address *" value={draft.address.line1} onChange={(e) => patchAddr({ line1: e.target.value })} />
                <input className={field} placeholder="Apartment, suite, etc. (optional)" value={draft.address.line2} onChange={(e) => patchAddr({ line2: e.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={field} placeholder="City *" value={draft.address.city} onChange={(e) => patchAddr({ city: e.target.value })} />
                  <input className={field} placeholder="State" value={draft.address.state} onChange={(e) => patchAddr({ state: e.target.value })} />
                  <input className={field} placeholder="Postal code" value={draft.address.postalCode} onChange={(e) => patchAddr({ postalCode: e.target.value })} />
                  <input className={field} placeholder="Country *" value={draft.address.country} onChange={(e) => patchAddr({ country: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 border-t border-slate-100">
            <Toggle
              checked={draft.storefront}
              onChange={(v) => patch({ storefront: v })}
              title="Physical storefront"
              text="Show this physical store's location on your online store."
            />
          </div>
        </div>

        <Sec title="Fulfillment">
          <Toggle
            checked={fulfillOn}
            disabled={isDefault}
            onChange={(v) => patch({ fulfillOnline: v })}
            title="Use inventory at this location to fulfill online orders"
            text="Turn this off for a place that only sells in person."
          />
          {isDefault && (
            <p className="mb-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
              This is your default location. To change whether you fulfill online orders from this location, select another
              default location first.
            </p>
          )}
          <div className={`divide-y divide-slate-100 border-t border-slate-100 ${fulfillOn ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-3 pr-1">
              <div className="flex-1">
                <Toggle
                  checked={draft.shipping && fulfillOn}
                  disabled={!fulfillOn}
                  onChange={(v) => patch({ shipping: v })}
                  title="Shipping"
                  text="Ship orders from this location."
                />
              </div>
              <Pill tone={draft.shipping && fulfillOn ? 'green' : 'gray'}>{draft.shipping && fulfillOn ? 'On' : 'Off'}</Pill>
            </div>
            <div className="flex items-center gap-3 pr-1">
              <div className="flex-1">
                <Toggle
                  checked={draft.pickup && fulfillOn}
                  disabled={!fulfillOn}
                  onChange={(v) => patch({ pickup: v })}
                  title="Pickup in store"
                  text="Customers can collect orders from this location."
                />
              </div>
              <Pill tone={draft.pickup && fulfillOn ? 'green' : 'gray'}>{draft.pickup && fulfillOn ? 'On' : 'Off'}</Pill>
            </div>
            <div className="flex items-center gap-3 pr-1">
              <div className="flex-1">
                <Toggle
                  checked={draft.localDelivery && fulfillOn}
                  disabled={!fulfillOn}
                  onChange={(v) => patch({ localDelivery: v })}
                  title="Local delivery"
                  text="Deliver to nearby customers from this location."
                />
              </div>
              <Pill tone={draft.localDelivery && fulfillOn ? 'green' : 'gray'}>{draft.localDelivery && fulfillOn ? 'On' : 'Off'}</Pill>
            </div>
          </div>
          <button onClick={() => onGo('shipping')} className="mt-2 text-sm font-medium text-blue-600 hover:underline">
            Set rates, areas and pickup details in Shipping and delivery
          </button>
        </Sec>

        <Sec title="Point of Sale" text="Set up physical retail operations at this location.">
          <Toggle
            checked={draft.pos}
            onChange={(v) => patch({ pos: v, posPro: v ? draft.posPro : false })}
            title="Point of Sale"
            text="Sell in person from this location."
          />
          <div className="border-t border-slate-100">
            <Toggle
              checked={draft.pos && draft.posPro}
              disabled={!draft.pos}
              onChange={(v) => patch({ posPro: v })}
              title="POS Pro"
              text="Extra in-person selling features. Turn on Point of Sale first."
            />
          </div>
          <p className="mt-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
            The Xenon sales terminal is coming soon. These settings are saved for when it is ready.
          </p>
        </Sec>

        <div>
          <button onClick={save} disabled={saving || !dirty} className={primary}>
            {saving ? 'Saving...' : isNew ? 'Add location' : 'Save changes'}
          </button>
          {!isNew && dirty && !msg && <span className="ml-3 text-xs text-amber-700">You have unsaved changes.</span>}
          <Note text={msg} />
        </div>
      </div>
    );
  }

  // ----- the list -----
  const posCount = locs.filter((l) => l.active && l.pos).length;

  return (
    <div className="space-y-7">
      <Heading title="Locations" text="The places you ship from, sell in person, and let customers collect from." />

      <div>
        <h3 className="font-display text-base font-semibold text-slate-900">All locations</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Using {activeCount} of {PLAN_LOCATION_LIMIT} active locations available on your plan
        </p>
        <div className={`${card} mt-3`}>
          <div className="flex items-center gap-2">
            <select aria-label="Filter locations" className={sel} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={`${field} !py-2 pl-9`}
                placeholder="Search and filter"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-2 divide-y divide-slate-100">
            {locs.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                No locations yet. Add the place you ship orders from. Your first location becomes your default.
              </p>
            )}
            {locs.length > 0 && visible.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No locations match your search.</p>
            )}
            {visible.map((l) => (
              <button key={l.id} onClick={() => openEdit(l)} className="flex w-full items-center gap-3 py-3.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{l.name}</span>
                  <span className="block truncate text-xs text-slate-500">{formatAddress(l.address)}</span>
                  <span className="mt-1.5 flex flex-wrap gap-2">
                    <Pill tone={l.active ? 'green' : 'gray'}>{l.active ? 'Active' : 'Inactive'}</Pill>
                    {l.isDefault && <Pill tone="gray">Default</Pill>}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={openNew}
          disabled={atLimit}
          className="mt-3 w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Location
        </button>
        {atLimit && (
          <p className="mt-2 text-xs text-slate-500">
            You have reached your plan limit. Deactivate a location to add another.
          </p>
        )}
        <Note text={msg} />
      </div>

      <Sec title="Point of Sale" text="Start selling in person from any location.">
        <p className="text-sm font-semibold text-slate-900">
          {posCount === 0 ? 'No locations set up yet' : `${posCount} location${posCount === 1 ? '' : 's'} set up`}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Open a location and turn on Point of Sale. The Xenon sales terminal is coming soon.
        </p>
      </Sec>
    </div>
  );
}
