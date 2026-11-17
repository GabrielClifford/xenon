'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Info, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  MAX_CODE,
  appByKind,
  apps,
  dataSaleOptions,
  eventList,
  permissionOptions,
  validateApp,
  type AppDef,
  type DataSale,
  type Permission,
  type PixelKind,
} from '@/lib/pixels/apps';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const ghost = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const danger = 'rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50';

const MAX_PIXELS = 20;

type Row = {
  id: string;
  kind: PixelKind;
  name: string;
  config: Record<string, unknown>;
  permission: Permission;
  data_sale: DataSale;
  status: 'connected' | 'disconnected';
};

type Screen = { s: 'home' } | { s: 'apps' } | { s: 'learn' } | { s: 'edit'; kind: PixelKind; id: string | null };

const permText = (p: Permission) => permissionOptions.find((o) => o.v === p)?.t.split(' (')[0] ?? p;

// Matches your Settings pattern: <CustomerEvents user={user} />.
// Finds the signed-in owner's business, then shows the panel for it.
export default function CustomerEvents({ user, businessId }: { user?: { id: string } | null; businessId?: string }) {
  const [bid, setBid] = useState<string | null>(businessId ?? null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (businessId || !user?.id) return;
    createClient()
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => {
        if (data?.id) setBid(data.id);
        else setMissing(true);
      });
  }, [user?.id, businessId]);

  if (missing) return <p className="text-sm text-slate-600">Create your business first, then you can manage pixels here.</p>;
  if (!bid) return <p className="text-sm text-slate-500">Loading...</p>;
  return <CustomerEventsInner businessId={bid} />;
}

function CustomerEventsInner({ businessId }: { businessId: string }) {
  const [screen, setScreen] = useState<Screen>({ s: 'home' });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: e } = await createClient()
      .from('customer_pixels')
      .select('id,kind,name,config,permission,data_sale,status')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });
    if (e) setError(e.message.includes('customer_pixels') ? 'Run customer-events.sql in Supabase first.' : e.message);
    else setError('');
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const back = () => {
    setScreen({ s: 'home' });
    load();
  };

  if (screen.s === 'apps') return <Apps rows={rows} onBack={back} onPick={(k) => setScreen({ s: 'edit', kind: k, id: null })} />;
  if (screen.s === 'learn') return <Learn onBack={back} />;
  if (screen.s === 'edit') {
    const row = screen.id ? rows.find((r) => r.id === screen.id) ?? null : null;
    return <Editor businessId={businessId} kind={screen.kind} row={row} onBack={back} />;
  }

  const addCustom = () => {
    if (rows.length >= MAX_PIXELS) return setError(`You can have up to ${MAX_PIXELS} pixels.`);
    setScreen({ s: 'edit', kind: 'custom', id: null });
  };
  const explore = () => {
    if (rows.length >= MAX_PIXELS) return setError(`You can have up to ${MAX_PIXELS} pixels.`);
    setScreen({ s: 'apps' });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Customer events</h2>
        <button className={primary} onClick={explore}>
          Explore pixel apps
        </button>
      </div>

      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-slate-900">Pixels</h3>
        <button aria-label="About pixels" onClick={() => setInfo((v) => !v)} className="text-slate-500 hover:text-slate-800">
          <Info size={18} />
        </button>
      </div>
      {info && (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          A pixel is a small piece of tracking that runs on your website. It tells a tool such as Google Analytics or Meta what visitors do, like viewing a product or placing an order, so you can measure sales and advertising.
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : rows.length === 0 ? (
        <div className={`${card} flex flex-col items-center px-6 py-12 text-center`}>
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 font-mono text-2xl text-slate-400">&lt;/&gt;</div>
          <h4 className="text-lg font-semibold text-slate-900">This is where you&apos;ll manage your pixels</h4>
          <p className="mt-1 max-w-sm text-sm text-slate-600">Collect customer events through app pixel or custom pixel integrations.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className={ghost} onClick={addCustom}>
              Add custom pixel
            </button>
            <button className={primary} onClick={explore}>
              Explore pixel apps
            </button>
          </div>
        </div>
      ) : (
        <div className={`${card} p-0`}>
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id}>
                <button onClick={() => setScreen({ s: 'edit', kind: r.kind, id: r.id })} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">{permText(r.permission)}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{r.kind === 'custom' ? 'Custom' : 'App'}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {r.status === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 border-t border-slate-100 p-4">
            <button className={ghost} onClick={addCustom}>
              <Plus size={14} className="mr-1 inline" />
              Add custom pixel
            </button>
          </div>
        </div>
      )}

      <div className="text-center">
        <button className="text-sm font-medium text-blue-600 hover:underline" onClick={() => setScreen({ s: 'learn' })}>
          Learn more about pixels
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Catalogue ------------------------------ */

function Apps({ rows, onBack, onPick }: { rows: Row[]; onBack: () => void; onPick: (k: PixelKind) => void }) {
  const groups = Array.from(new Set(apps.map((a) => a.group)));
  const added = (a: AppDef) => rows.some((r) => r.kind === a.kind);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button className={ghost} onClick={onBack}>
          <ArrowLeft size={14} className="mr-1 inline" />
          Back
        </button>
        <h2 className="text-xl font-bold text-slate-900">Pixel apps</h2>
      </div>
      <p className="text-sm text-slate-600">Connect a tracking app with its ID. No code needed.</p>
      {groups.map((g) => (
        <section key={g} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{g}</h3>
          {apps
            .filter((a) => a.group === g)
            .map((a) => (
              <div key={a.kind} className={`${card} flex items-center gap-4`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{a.name}</p>
                  <p className="text-sm text-slate-600">{a.blurb}</p>
                </div>
                {added(a) ? (
                  <span className="flex items-center gap-1 text-sm text-emerald-700">
                    <Check size={14} /> Added
                  </span>
                ) : (
                  <button className={ghost} onClick={() => onPick(a.kind)}>
                    Add
                  </button>
                )}
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

/* ------------------------------- Learn more ----------------------------- */

function Learn({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button className={ghost} onClick={onBack}>
          <ArrowLeft size={14} className="mr-1 inline" />
          Back
        </button>
        <h2 className="text-xl font-bold text-slate-900">About pixels</h2>
      </div>
      <div className={`${card} space-y-3 text-sm text-slate-700`}>
        <p>Your website sends customer events. Pixels listen to them and pass them to the tools you use.</p>
        <p>
          <strong>App pixels</strong> need only an ID. <strong>Custom pixels</strong> run your own JavaScript, but inside a locked box that cannot read your site, cookies or dashboard.
        </p>
        <p>
          <strong>Consent.</strong> A pixel with a consent requirement waits until the visitor agrees in your cookie banner. Visitors who send the Global Privacy Control signal stop pixels marked as data sale.
        </p>
        <p>
          <strong>Testing.</strong> Open your website with <code className="rounded bg-slate-100 px-1">?xenon_debug</code> on the end of the address. Every event prints in the browser console.
        </p>
      </div>
      <div className={`${card} overflow-x-auto`}>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Events</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-500">
              <th className="pb-2 pr-4">Event</th>
              <th className="pb-2 pr-4">When</th>
              <th className="pb-2">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {eventList.map((e) => (
              <tr key={e.name}>
                <td className="py-2 pr-4 font-mono text-xs">{e.name}</td>
                <td className="py-2 pr-4 text-slate-700">{e.text}</td>
                <td className="py-2 text-xs text-slate-500">{e.fields}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={card}>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Custom pixel example</h3>
        <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{`analytics.subscribe('checkout_completed', function (event) {
  console.log('Order', event.data.orderId, event.data.total);
  // fetch('https://example.com/collect', { method: 'POST', body: JSON.stringify(event) });
});

analytics.subscribe('all_events', function (event) {
  console.log(event.name);
});`}</pre>
      </div>
    </div>
  );
}

/* ----------------------------- Add / edit form --------------------------- */

function Editor({ businessId, kind, row, onBack }: { businessId: string; kind: PixelKind; row: Row | null; onBack: () => void }) {
  const app = kind === 'custom' ? null : appByKind(kind) ?? null;
  const [name, setName] = useState(row?.name ?? app?.name ?? 'Custom pixel');
  const [cfg, setCfg] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row?.config ?? {})) if (typeof v === 'string') out[k] = v;
    return out;
  });
  const [permission, setPermission] = useState<Permission>(row?.permission ?? app?.permission ?? 'both');
  const [dataSale, setDataSale] = useState<DataSale>(row?.data_sale ?? 'qualifies');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const connected = row?.status === 'connected';

  async function save(status: 'connected' | 'disconnected') {
    setErr('');
    setMsg('');
    const nm = name.trim();
    if (!nm) return setErr('Give the pixel a name.');
    if (nm.length > 80) return setErr('The name is too long (80 characters max).');

    let config: Record<string, string> = {};
    if (kind === 'custom') {
      const code = cfg.code ?? '';
      if (code.length > MAX_CODE) return setErr(`Code is too long (${MAX_CODE} characters max).`);
      if (status === 'connected' && !code.trim()) return setErr('Add some code before connecting.');
      config = { code };
    } else if (app) {
      for (const f of app.fields) {
        const raw = (cfg[f.key] ?? '').trim();
        if (raw) config[f.key] = f.upper ? raw.toUpperCase() : raw;
      }
      const bad = validateApp(kind, config);
      if (bad) return setErr(bad);
    }

    setBusy(true);
    const sb = createClient();
    const values = { name: nm, config, permission, data_sale: dataSale, status, updated_at: new Date().toISOString() };
    const res = row
      ? await sb.from('customer_pixels').update(values).eq('id', row.id).eq('business_id', businessId)
      : await sb.from('customer_pixels').insert({ ...values, business_id: businessId, kind });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    if (row) {
      setMsg(status === 'connected' ? 'Saved and connected.' : 'Saved.');
      setTimeout(onBack, 600);
    } else onBack();
  }

  async function remove() {
    if (!row) return;
    setBusy(true);
    const { error } = await createClient().from('customer_pixels').delete().eq('id', row.id).eq('business_id', businessId);
    setBusy(false);
    if (error) return setErr(error.message);
    onBack();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button className={ghost} onClick={onBack}>
          <ArrowLeft size={14} className="mr-1 inline" />
          Back
        </button>
        <h2 className="text-xl font-bold text-slate-900">{row ? 'Edit pixel' : kind === 'custom' ? 'Add custom pixel' : `Add ${app?.name ?? 'pixel'}`}</h2>
        {row && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        )}
      </div>

      <div className={`${card} space-y-4`}>
        <div>
          <label className={label}>Pixel name</label>
          <input className={field} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>

        {app &&
          app.fields.map((f) => (
            <div key={f.key}>
              <label className={label}>{f.label}</label>
              <input
                className={field}
                value={cfg[f.key] ?? ''}
                placeholder={f.placeholder}
                autoComplete="off"
                onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">{f.help}</p>
            </div>
          ))}

        {kind === 'custom' && (
          <div>
            <label className={label}>Code</label>
            <textarea
              className={`${field} h-56 font-mono text-xs`}
              spellCheck={false}
              value={cfg.code ?? ''}
              maxLength={MAX_CODE}
              placeholder={"analytics.subscribe('checkout_completed', function (event) {\n  console.log(event);\n});"}
              onChange={(e) => setCfg({ ...cfg, code: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">
              {(cfg.code ?? '').length}/{MAX_CODE}. Runs in a sandbox: it can receive events with <code>analytics.subscribe</code> and send data to other servers, but cannot read your website, cookies or dashboard.
            </p>
          </div>
        )}
      </div>

      <div className={`${card} space-y-4`}>
        <h3 className="text-sm font-semibold text-slate-900">Customer privacy</h3>
        <div>
          <label className={label}>Permission</label>
          <select className={field} value={permission} onChange={(e) => setPermission(e.target.value as Permission)}>
            {permissionOptions.map((o) => (
              <option key={o.v} value={o.v}>
                {o.t}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">The pixel starts only after the visitor agrees to these categories in your cookie banner.</p>
        </div>
        <div>
          <label className={label}>Data sale</label>
          <select className={field} value={dataSale} onChange={(e) => setDataSale(e.target.value as DataSale)}>
            {dataSaleOptions.map((o) => (
              <option key={o.v} value={o.v}>
                {o.t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button className={primary} disabled={busy} onClick={() => save(connected ? 'connected' : 'disconnected')}>
          {busy ? 'Saving...' : 'Save'}
        </button>
        {!connected && (
          <button className={ghost} disabled={busy} onClick={() => save('connected')}>
            Save and connect
          </button>
        )}
        {connected && (
          <button className={ghost} disabled={busy} onClick={() => save('disconnected')}>
            Disconnect
          </button>
        )}
        {row &&
          (confirmDelete ? (
            <span className="ml-auto flex items-center gap-2 text-sm">
              Delete this pixel?
              <button className={danger} disabled={busy} onClick={remove}>
                Yes, delete
              </button>
              <button className={ghost} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button className={`${danger} ml-auto`} disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} className="mr-1 inline" />
              Delete
            </button>
          ))}
      </div>
    </div>
  );
}
