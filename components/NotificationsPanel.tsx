'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, Check, ChevronRight, Copy, Mail, Plus, ShieldCheck, Trash2, Truck, User, Users, Webhook } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  blankSettings,
  customerEvents,
  defaultTemplates,
  mergeTpl,
  renderCustomer,
  sampleOrder,
  staffOn,
  variableList,
  webhookEvents,
  type CustomerKey,
  type Settings,
  type StaffKey,
} from '@/lib/notifications/templates';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const ghost = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

type DnsRec = { record?: string; name: string; type: string; value: string; status?: string; priority?: number };
type DomainRow = { domain: string; status: string; records: DnsRec[]; dmarc_ok: boolean };
type Recipient = { id: string; email: string };
type Hook = {
  id: string;
  url: string;
  format: 'json' | 'xml';
  events: string[];
  secret: string;
  active: boolean;
  last_status: number | null;
  last_at: string | null;
};
type Log = { id: string; event: string; channel: string; target: string; status: string; error: string | null; created_at: string };

type Screen =
  | { k: 'home' }
  | { k: 'domain' }
  | { k: 'customer' }
  | { k: 'tpl'; key: CustomerKey }
  | { k: 'staff' }
  | { k: 'fulfil' }
  | { k: 'hooks' }
  | { k: 'hook'; id: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Switch({ on, onChange, text }: { on: boolean; onChange: (v: boolean) => void; text: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={text}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-slate-900' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: React.ReactNode }) {
  const c = tone === 'ok' ? 'bg-green-100 text-green-800' : tone === 'warn' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600';
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${c}`}>{children}</span>;
}

function Back({ onClick, text }: { onClick: () => void; text: string }) {
  return (
    <button onClick={onClick} className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" /> {text}
    </button>
  );
}

function Row({ icon, title, text, onClick, right }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; right?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 py-3.5 text-left">
      <span className="mt-0.5 text-slate-700">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{text}</span>
        {right ? <span className="mt-2 block">{right}</span> : null}
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

export default function NotificationsPanel({
  businessId,
  businessName,
  ownerEmail,
}: {
  businessId: string;
  businessName: string;
  ownerEmail: string;
}) {
  const sb = useMemo(() => createClient(), []);
  const [screen, setScreen] = useState<Screen>({ k: 'home' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [s, setS] = useState<Settings>(blankSettings);
  const [domain, setDomain] = useState<DomainRow | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);

  // drafts
  const [dName, setDName] = useState('');
  const [dReply, setDReply] = useState('');
  const [dLocal, setDLocal] = useState('orders');
  const [newDomain, setNewDomain] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tBody, setTBody] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fStatus, setFStatus] = useState('processing');
  const [hUrl, setHUrl] = useState('');
  const [hFormat, setHFormat] = useState<'json' | 'xml'>('json');
  const [hEvents, setHEvents] = useState<string[]>(['order_placed']);
  const [hActive, setHActive] = useState(true);
  const [hSecret, setHSecret] = useState('');

  const flash = (ok: boolean, text: string) => setMsg({ ok, text });
  const go = (next: Screen) => {
    setMsg(null);
    setScreen(next);
  };

  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([
      sb.from('notification_settings').select('*').eq('business_id', businessId).maybeSingle(),
      sb.from('notification_domains').select('domain,status,records,dmarc_ok').eq('business_id', businessId).maybeSingle(),
      sb.from('notification_recipients').select('id,email').eq('business_id', businessId).order('created_at'),
      sb.from('notification_webhooks').select('*').eq('business_id', businessId).order('created_at'),
      sb.from('notification_log').select('id,event,channel,target,status,error,created_at').eq('business_id', businessId).order('created_at', { ascending: false }).limit(10),
    ]);
    const err = a.error ?? b.error ?? c.error ?? d.error ?? e.error;
    if (err) {
      flash(false, 'Could not load: ' + err.message + '. Have you run notifications.sql in Supabase?');
      setLoading(false);
      return;
    }
    const r = (a.data ?? {}) as Partial<Settings>;
    const next: Settings = {
      sender_name: r.sender_name ?? '',
      sender_local: r.sender_local || 'orders',
      reply_to: r.reply_to ?? '',
      customer: r.customer ?? {},
      staff: r.staff ?? {},
      fulfillment: r.fulfillment ?? {},
    };
    setS(next);
    setDName(next.sender_name);
    setDReply(next.reply_to);
    setDLocal(next.sender_local);
    setFEmail(next.fulfillment.email ?? '');
    setFStatus(next.fulfillment.trigger_status ?? 'processing');
    setDomain((b.data as DomainRow | null) ?? null);
    setRecipients((c.data ?? []) as Recipient[]);
    setHooks((d.data ?? []) as Hook[]);
    setLogs((e.data ?? []) as Log[]);
    setLoading(false);
  }, [sb, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  async function api(action: string, extra: object = {}) {
    const { data } = await sb.auth.getSession();
    const res = await fetch('/api/notifications/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ action, businessId, ...extra }),
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(j.error ?? 'Something went wrong.'));
    return j;
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      flash(false, 'Could not finish: ' + (e instanceof Error ? e.message : 'unexpected error'));
    }
    setBusy(false);
  }

  async function persist(next: Settings, ok = 'Saved.') {
    setS(next);
    const { error } = await sb
      .from('notification_settings')
      .upsert({ business_id: businessId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'business_id' });
    if (error) {
      flash(false, 'Could not save: ' + error.message);
      return false;
    }
    flash(true, ok);
    return true;
  }

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      flash(true, 'Copied.');
    } catch {
      flash(false, 'Could not copy. Select the text and copy it by hand.');
    }
  };

  const verified = domain?.status === 'verified';
  const senderLine = verified ? `${s.sender_local}@${domain?.domain}` : 'Your Xenon address (verify your own domain to send from it)';

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  const note = msg ? <p className={`mt-3 text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p> : null;

  /* ================= domain ================= */
  if (screen.k === 'domain') {
    return (
      <div className="space-y-5">
        <Back onClick={() => go({ k: 'home' })} text="Notifications" />
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold text-slate-900">Email domain authentication</h2>
          {domain ? <Chip tone={verified ? 'ok' : 'warn'}>{verified ? 'Verified' : 'Needs setup'}</Chip> : null}
        </div>

        {!domain ? (
          <div className={card}>
            <p className="text-sm text-slate-600">
              Send emails from your own address, like orders@mail.yourbrand.com, so they land in inboxes and not in spam. A subdomain such as
              mail.yourbrand.com is the safest choice.
            </p>
            <label className={`${label} mt-4`}>Domain</label>
            <input className={field} placeholder="mail.yourbrand.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
            <button
              disabled={busy}
              className={`${primary} mt-3`}
              onClick={() =>
                run(async () => {
                  await api('domain_add', { domain: newDomain });
                  setNewDomain('');
                  await load();
                  flash(true, 'Domain added. Now add the DNS records below at your domain provider.');
                })
              }
            >
              {busy ? 'Adding...' : 'Add domain'}
            </button>
          </div>
        ) : (
          <>
            <div className={card}>
              <p className="text-sm font-semibold text-slate-900">{domain.domain}</p>
              <p className="mt-1 text-xs text-slate-500">
                Add these records where you manage this domain (Cloudflare, Namecheap, GoDaddy and so on), then press Check status. DNS changes can take a few
                minutes, sometimes longer.
              </p>
              <div className="mt-4 space-y-3">
                {domain.records.map((r, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{r.record ?? r.type}</span>
                      {r.status ? <Chip tone={r.status === 'verified' ? 'ok' : 'muted'}>{r.status.replace('_', ' ')}</Chip> : null}
                    </div>
                    <p className="mt-2 text-slate-500">Type</p>
                    <p className="font-mono text-slate-900">{r.type}{r.priority !== undefined ? `  (priority ${r.priority})` : ''}</p>
                    <p className="mt-2 text-slate-500">Name</p>
                    <p className="flex items-start gap-2 break-all font-mono text-slate-900">
                      {r.name}
                      <button onClick={() => copy(r.name)} aria-label="Copy name"><Copy className="h-3.5 w-3.5 text-slate-500" /></button>
                    </p>
                    <p className="mt-2 text-slate-500">Value</p>
                    <p className="flex items-start gap-2 break-all font-mono text-slate-900">
                      {r.value}
                      <button onClick={() => copy(r.value)} aria-label="Copy value"><Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" /></button>
                    </p>
                  </div>
                ))}
              </div>
              <button
                disabled={busy}
                className={`${primary} mt-4`}
                onClick={() =>
                  run(async () => {
                    const j = await api('domain_check');
                    await load();
                    flash(j.status === 'verified', j.status === 'verified' ? 'Domain verified. Your emails now send from it.' : `Not verified yet (status: ${String(j.status).replace('_', ' ')}). Check the records and try again in a few minutes.`);
                  })
                }
              >
                {busy ? 'Checking...' : 'Check status'}
              </button>
            </div>

            {verified && (
              <div className={card}>
                <label className={label}>Sender address</label>
                <div className="flex items-center gap-2">
                  <input className={`${field} max-w-[9rem]`} value={dLocal} onChange={(e) => setDLocal(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} />
                  <span className="text-sm text-slate-600">@{domain.domain}</span>
                </div>
                <button disabled={busy} className={`${ghost} mt-3`} onClick={() => run(async () => void (await persist({ ...s, sender_local: dLocal || 'orders' })))}>
                  Save
                </button>
              </div>
            )}

            <div className={card}>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-slate-900">DMARC record</p>
                {verified ? <Chip tone={domain.dmarc_ok ? 'ok' : 'warn'}>{domain.dmarc_ok ? 'Found' : 'Not found'}</Chip> : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                DMARC tells inboxes your emails are really yours, which improves delivery. Add this TXT record at your domain provider.
              </p>
              <p className="mt-3 text-xs text-slate-500">Name</p>
              <p className="flex items-center gap-2 font-mono text-xs text-slate-900">_dmarc <button onClick={() => copy('_dmarc')} aria-label="Copy"><Copy className="h-3.5 w-3.5 text-slate-500" /></button></p>
              <p className="mt-2 text-xs text-slate-500">Type</p>
              <p className="font-mono text-xs text-slate-900">TXT</p>
              <p className="mt-2 text-xs text-slate-500">Value</p>
              <p className="flex items-center gap-2 font-mono text-xs text-slate-900">
                v=DMARC1; p=none; <button onClick={() => copy('v=DMARC1; p=none;')} aria-label="Copy"><Copy className="h-3.5 w-3.5 text-slate-500" /></button>
              </p>
              <button
                disabled={busy}
                className={`${ghost} mt-3`}
                onClick={() =>
                  run(async () => {
                    const j = await api('dmarc_check');
                    await load();
                    flash(Boolean(j.dmarc), j.dmarc ? 'DMARC record found.' : 'No DMARC record found yet. It can take a while to appear.');
                  })
                }
              >
                Check DMARC
              </button>
            </div>

            <button
              className="text-sm font-medium text-red-600 hover:underline"
              onClick={() => {
                if (!confirm('Remove this domain? Emails will go back to your Xenon address.')) return;
                run(async () => {
                  await api('domain_remove');
                  await load();
                  flash(true, 'Domain removed.');
                });
              }}
            >
              Remove domain
            </button>
          </>
        )}
        {note}
      </div>
    );
  }

  /* ================= customer list ================= */
  if (screen.k === 'customer') {
    return (
      <div className="space-y-5">
        <Back onClick={() => go({ k: 'home' })} text="Notifications" />
        <h2 className="font-display text-xl font-bold text-slate-900">Customer notifications</h2>
        <div className={`${card} divide-y divide-slate-100 !py-2`}>
          {customerEvents.map((e) => {
            const t = mergeTpl(s.customer, e.key);
            return (
              <div key={e.key} className="flex items-center gap-3 py-3.5">
                <button className="min-w-0 flex-1 text-left" onClick={() => {
                  setTSubject(t.subject);
                  setTBody(t.body);
                  go({ k: 'tpl', key: e.key });
                }}>
                  <span className="block text-sm font-semibold text-slate-900">{e.title}</span>
                  <span className="block text-xs text-slate-500">{e.hint}</span>
                </button>
                <Switch on={t.enabled} text={`Send ${e.title}`} onChange={(v) => persist({ ...s, customer: { ...s.customer, [e.key]: { ...s.customer[e.key], enabled: v } } })} />
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">Customers only get these if they gave an email address at checkout.</p>
        {note}
      </div>
    );
  }

  /* ================= template editor ================= */
  if (screen.k === 'tpl') {
    const ev = customerEvents.find((e) => e.key === screen.key)!;
    const preview = renderCustomer(
      { enabled: true, subject: tSubject, body: tBody },
      { store: businessName, storeUrl: 'https://example.com', contact: s.reply_to || ownerEmail, order: sampleOrder }
    );
    return (
      <div className="space-y-5">
        <Back onClick={() => go({ k: 'customer' })} text="Customer notifications" />
        <h2 className="font-display text-xl font-bold text-slate-900">{ev.title}</h2>
        <div className={card}>
          <label className={label}>Subject</label>
          <input className={field} value={tSubject} onChange={(e) => setTSubject(e.target.value)} />
          <label className={`${label} mt-4`}>Message</label>
          <textarea rows={8} className={field} value={tBody} onChange={(e) => setTBody(e.target.value)} />
          <p className="mt-2 text-xs text-slate-500">Tap a name to add it. It is replaced with the real value in each email. The order summary and a store link are added automatically.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {variableList.map((v) => (
              <button key={v} type="button" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100" onClick={() => setTBody((b) => `${b}{{${v}}}`)}>
                {`{{${v}}}`}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={busy}
              className={primary}
              onClick={() =>
                run(async () => {
                  if (!tSubject.trim() || !tBody.trim()) throw new Error('Subject and message cannot be empty.');
                  await persist({ ...s, customer: { ...s.customer, [screen.key]: { ...s.customer[screen.key], subject: tSubject, body: tBody } } });
                })
              }
            >
              Save
            </button>
            <button
              disabled={busy}
              className={ghost}
              onClick={() =>
                run(async () => {
                  await api('test_email', { template: screen.key });
                  flash(true, `Test sent to ${ownerEmail}. It uses your last saved version.`);
                })
              }
            >
              Send test to me
            </button>
            <button
              disabled={busy}
              className={ghost}
              onClick={() => {
                const d = defaultTemplates[screen.key];
                setTSubject(d.subject);
                setTBody(d.body);
              }}
            >
              Reset to default
            </button>
          </div>
          {note}
        </div>
        <div className={card}>
          <p className="mb-1 text-sm font-semibold text-slate-900">Preview</p>
          <p className="mb-3 text-xs text-slate-500">Subject: {preview.subject}</p>
          <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[32rem] w-full rounded-xl border border-slate-200" />
        </div>
      </div>
    );
  }

  /* ================= staff ================= */
  if (screen.k === 'staff') {
    const toggles: { key: StaffKey; title: string; hint: string; test: string }[] = [
      { key: 'weekly_summary', title: 'Store order summary', hint: 'Sent every Monday at 9:00 AM (Lagos time)', test: 'weekly_summary' },
      { key: 'new_order', title: 'New order', hint: 'Sent when a customer places an order', test: 'staff_new_order' },
      { key: 'order_cancelled', title: 'Order cancelled', hint: 'Sent when an order is cancelled', test: 'staff_order_cancelled' },
    ];
    return (
      <div className="space-y-5">
        <Back onClick={() => go({ k: 'home' })} text="Notifications" />
        <h2 className="font-display text-xl font-bold text-slate-900">Staff notifications</h2>
        <div className={`${card} divide-y divide-slate-100 !py-2`}>
          {toggles.map((t) => (
            <div key={t.key} className="py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{t.title}</span>
                  <span className="block text-xs text-slate-500">{t.hint}</span>
                </span>
                <Switch on={staffOn(s.staff, t.key)} text={t.title} onChange={(v) => persist({ ...s, staff: { ...s.staff, [t.key]: v } })} />
              </div>
              <button
                disabled={busy}
                className="mt-2 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                onClick={() => run(async () => {
                  await api('test_email', { template: t.test });
                  flash(true, `Test sent to ${ownerEmail}.`);
                })}
              >
                Send me a test
              </button>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Recipients</h3>
          <div className={card}>
            {recipients.length === 0 ? (
              <p className="text-sm text-slate-500">No recipients added, so staff emails go to your account email ({ownerEmail}).</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recipients.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{r.email}</span>
                    <span className="text-xs text-slate-500">All orders</span>
                    <button
                      aria-label={`Remove ${r.email}`}
                      className="rounded p-2 text-red-600 hover:bg-red-50"
                      onClick={() => run(async () => {
                        const { error } = await sb.from('notification_recipients').delete().eq('id', r.id);
                        if (error) throw new Error(error.message);
                        await load();
                      })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <input className={field} inputMode="email" placeholder="Email address" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <button
                disabled={busy}
                className={primary}
                onClick={() => run(async () => {
                  const email = newEmail.trim().toLowerCase();
                  if (!EMAIL.test(email)) throw new Error('Enter a valid email address.');
                  const { error } = await sb.from('notification_recipients').insert({ business_id: businessId, email });
                  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'That email is already added.' : error.message);
                  setNewEmail('');
                  await load();
                })}
              >
                Add
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Shopify also has change requests, sales attribution, order disputes and draft orders. Xenon does not have those features yet, so there is nothing to notify about.
        </p>
        {note}
      </div>
    );
  }

  /* ================= fulfillment ================= */
  if (screen.k === 'fulfil') {
    return (
      <div className="space-y-5">
        <Back onClick={() => go({ k: 'home' })} text="Notifications" />
        <h2 className="font-display text-xl font-bold text-slate-900">Fulfillment request notification</h2>
        <div className={card}>
          <p className="text-sm text-slate-600">Email your fulfillment partner (a packer, rider or warehouse) the order details when an order reaches a status you choose.</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex-1 text-sm font-medium text-slate-900">Send fulfillment requests</span>
            <Switch on={s.fulfillment.enabled === true} text="Send fulfillment requests" onChange={(v) => persist({ ...s, fulfillment: { ...s.fulfillment, enabled: v } })} />
          </div>
          <label className={`${label} mt-4`}>Fulfillment partner email</label>
          <input className={field} inputMode="email" placeholder="packing@example.com" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
          <label className={`${label} mt-4`}>Send when an order&apos;s status becomes</label>
          <input className={field} placeholder="processing" value={fStatus} onChange={(e) => setFStatus(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Type the status exactly as you set it on the Orders page, for example processing or confirmed.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={busy}
              className={primary}
              onClick={() => run(async () => {
                const email = fEmail.trim().toLowerCase();
                if (email && !EMAIL.test(email)) throw new Error('Enter a valid email address.');
                await persist({ ...s, fulfillment: { ...s.fulfillment, email, trigger_status: fStatus.trim() || 'processing' } });
              })}
            >
              Save
            </button>
            <button disabled={busy} className={ghost} onClick={() => run(async () => {
              await api('test_email', { template: 'fulfillment' });
              flash(true, `Test sent to ${ownerEmail}.`);
            })}>
              Send me a test
            </button>
          </div>
          {note}
        </div>
      </div>
    );
  }

  /* ================= webhooks ================= */
  if (screen.k === 'hooks') {
    return (
      <div className="space-y-5">
        <Back onClick={() => go({ k: 'home' })} text="Notifications" />
        <h2 className="font-display text-xl font-bold text-slate-900">Webhooks</h2>
        <p className="text-sm text-slate-500">Send JSON or XML about store events to a web address, so other tools can react to your orders.</p>
        <div className={card}>
          {hooks.length === 0 ? (
            <p className="text-sm text-slate-500">No webhooks yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {hooks.map((h) => (
                <button key={h.id} className="flex w-full items-center gap-3 py-3 text-left" onClick={() => {
                  setHUrl(h.url); setHFormat(h.format); setHEvents(h.events); setHActive(h.active); setHSecret(h.secret);
                  go({ k: 'hook', id: h.id });
                }}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{h.url}</span>
                    <span className="block text-xs text-slate-500">
                      {h.format.toUpperCase()} · {h.events.length} event{h.events.length === 1 ? '' : 's'} · {h.active ? 'Active' : 'Paused'}
                      {h.last_at ? ` · last ${h.last_status && h.last_status < 300 ? 'OK' : 'failed'} ${when(h.last_at)}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              const b = crypto.getRandomValues(new Uint8Array(24));
              setHUrl(''); setHFormat('json'); setHEvents(['order_placed']); setHActive(true);
              setHSecret('whsec_' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''));
              go({ k: 'hook', id: null });
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            <Plus className="h-4 w-4" /> Add webhook
          </button>
        </div>
        {note}
      </div>
    );
  }

  if (screen.k === 'hook') {
    const id = screen.id;
    return (
      <div className="space-y-5">
        <Back onClick={() => go({ k: 'hooks' })} text="Webhooks" />
        <h2 className="font-display text-xl font-bold text-slate-900">{id ? 'Edit webhook' : 'New webhook'}</h2>
        <div className={card}>
          <label className={label}>URL</label>
          <input className={field} inputMode="url" placeholder="https://example.com/xenon-webhook" value={hUrl} onChange={(e) => setHUrl(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Must be a public https address.</p>

          <p className={`${label} mt-4`}>Format</p>
          <div className="flex gap-4">
            {(['json', 'xml'] as const).map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <input type="radio" name="fmt" checked={hFormat === f} onChange={() => setHFormat(f)} /> {f.toUpperCase()}
              </label>
            ))}
          </div>

          <p className={`${label} mt-4`}>Events</p>
          <div className="space-y-2">
            {webhookEvents.map((e) => (
              <label key={e.v} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hEvents.includes(e.v)} onChange={(c) => setHEvents((l) => (c.target.checked ? [...l, e.v] : l.filter((x) => x !== e.v)))} /> {e.t}
              </label>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hActive} onChange={(e) => setHActive(e.target.checked)} /> Active
          </label>

          <p className={`${label} mt-4`}>Signing secret</p>
          <p className="flex items-center gap-2 break-all font-mono text-xs text-slate-800">
            {hSecret}
            <button onClick={() => copy(hSecret)} aria-label="Copy secret"><Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" /></button>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Every request has an X-Xenon-Signature header: sha256= followed by the HMAC-SHA256 of the raw body using this secret. Check it to know the call is from Xenon.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              disabled={busy}
              className={primary}
              onClick={() => run(async () => {
                const url = hUrl.trim();
                if (!/^https:\/\//i.test(url)) throw new Error('The URL must start with https://');
                if (hEvents.length === 0) throw new Error('Choose at least one event.');
                const row = { url, format: hFormat, events: hEvents, active: hActive, secret: hSecret };
                const { error } = id
                  ? await sb.from('notification_webhooks').update(row).eq('id', id)
                  : await sb.from('notification_webhooks').insert({ ...row, business_id: businessId });
                if (error) throw new Error(error.message);
                await load();
                go({ k: 'hooks' });
              })}
            >
              Save
            </button>
            {id && (
              <>
                <button disabled={busy} className={ghost} onClick={() => run(async () => {
                  await api('test_webhook', { webhookId: id });
                  await load();
                  flash(true, 'Test sent and your server answered OK.');
                })}>
                  Send test
                </button>
                <button className="text-sm font-medium text-red-600 hover:underline" onClick={() => {
                  if (!confirm('Delete this webhook?')) return;
                  run(async () => {
                    const { error } = await sb.from('notification_webhooks').delete().eq('id', id);
                    if (error) throw new Error(error.message);
                    await load();
                    go({ k: 'hooks' });
                  });
                }}>
                  Delete
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">Send test uses the last saved version of this webhook.</p>
          {note}
        </div>
      </div>
    );
  }

  /* ================= home ================= */
  const emailOk = (v: string) => v === '' || EMAIL.test(v);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">Notifications</h2>
        <p className="mt-1 text-sm text-slate-500">Choose which emails your customers and your team get, and how they look.</p>
      </div>

      <div className={card}>
        <p className="font-semibold text-slate-900">Sender email</p>
        <p className="mt-1 text-xs text-slate-500">The name customers see, and where their replies go.</p>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">Emails are sent from: {senderLine}</p>
        <label className={`${label} mt-4`}>Sender name</label>
        <input className={field} maxLength={60} placeholder={businessName} value={dName} onChange={(e) => setDName(e.target.value)} />
        <label className={`${label} mt-4`}>Reply-to email</label>
        <input className={field} inputMode="email" placeholder={ownerEmail} value={dReply} onChange={(e) => setDReply(e.target.value)} />
        <button
          disabled={busy}
          className={`${primary} mt-4`}
          onClick={() => run(async () => {
            if (!emailOk(dReply.trim())) throw new Error('Enter a valid reply-to email.');
            await persist({ ...s, sender_name: dName.trim(), reply_to: dReply.trim() });
          })}
        >
          Save
        </button>
        <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
          <Row
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Email domain authentication"
            text="Send from your own domain"
            onClick={() => go({ k: 'domain' })}
            right={<Chip tone={verified ? 'ok' : 'warn'}>{verified ? 'Verified' : domain ? 'Needs setup' : 'Not set up'}</Chip>}
          />
          <Row
            icon={<Check className="h-5 w-5" />}
            title="DMARC record setup"
            text="Improve delivery by protecting your sending domain"
            onClick={() => go({ k: 'domain' })}
            right={domain ? <Chip tone={domain.dmarc_ok ? 'ok' : 'muted'}>{domain.dmarc_ok ? 'Found' : 'View steps'}</Chip> : undefined}
          />
        </div>
      </div>

      <div className={`${card} divide-y divide-slate-100 !py-2`}>
        <Row icon={<User className="h-5 w-5" />} title="Customer notifications" text="Notify customers about order events" onClick={() => go({ k: 'customer' })} />
        <Row icon={<Users className="h-5 w-5" />} title="Staff notifications" text="Notify your team about new orders and weekly sales" onClick={() => go({ k: 'staff' })} />
        <Row icon={<Truck className="h-5 w-5" />} title="Fulfillment request notification" text="Notify your packer or rider when an order is ready to fulfill" onClick={() => go({ k: 'fulfil' })} />
      </div>

      <div className={`${card} !py-2`}>
        <Row icon={<Webhook className="h-5 w-5" />} title="Webhooks" text="Send XML or JSON notifications about store events to a URL" onClick={() => go({ k: 'hooks' })} />
      </div>

      <div className={card}>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-600" />
          <p className="font-semibold text-slate-900">Recent activity</p>
        </div>
        {logs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nothing sent yet. Place a test order on your site to see it here.</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100">
            {logs.map((l) => (
              <div key={l.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  <Chip tone={l.status === 'sent' ? 'ok' : l.status === 'failed' ? 'warn' : 'muted'}>{l.status}</Chip>
                  <span className="text-sm text-slate-900">{l.event.replace(/_/g, ' ')}</span>
                  <span className="ml-auto text-xs text-slate-500">{when(l.created_at)}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{l.channel} to {l.target}</p>
                {l.error ? <p className="mt-1 text-xs text-red-600">{l.error}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
      {note}
    </div>
  );
}
