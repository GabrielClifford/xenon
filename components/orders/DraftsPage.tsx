'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { invoiceText, mailLink, naira, orderError, waLink } from '@/lib/orders';
import { Empty, Err, ListSkeleton, Modal, Ok, Pill, btn, card, fmtDate, fmtDay, ghost, small } from './ui';

type Draft = {
  id: string; number: number; status: 'open' | 'invoiced' | 'completed' | 'cancelled'; customer_name: string; phone: string; email: string | null; total: number;
  items: { name: string; quantity: number }[]; due_date: string | null; token: string; invoice_sent_at: string | null; claimed_at: string | null; claim_note: string | null; order_id: string | null; created_at: string;
};

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const tone: Record<Draft['status'], string> = { open: 'bg-slate-100 text-slate-700', invoiced: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800', cancelled: 'bg-slate-200 text-slate-500' };
const label: Record<Draft['status'], string> = { open: 'Open', invoiced: 'Invoice sent', completed: 'Turned into order', cancelled: 'Cancelled' };

export default function DraftsPage({ businessId, storeName, onEdit, onCreate, onOrdersChanged }: { businessId: string; storeName: string; onEdit: (id: string) => void; onCreate: () => void; onOrdersChanged: () => void }) {
  const sb = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [fatal, setFatal] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [filter, setFilter] = useState<'active' | Draft['status']>('active');
  const [busy, setBusy] = useState('');
  const [sendFor, setSendFor] = useState<Draft | null>(null);
  const [completeFor, setCompleteFor] = useState<Draft | null>(null);
  const [delFor, setDelFor] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('draft_orders').select('id,number,status,customer_name,phone,email,total,items,due_date,invoice_token,invoice_sent_at,payment_claimed_at,payment_claim_note,order_id,created_at').eq('business_id', businessId).order('created_at', { ascending: false }).limit(500);
    if (error) { setFatal(orderError(error.message)); setRows([]); return; }
    setFatal('');
    setRows((data ?? []).map((r: Record<string, unknown>) => ({
      id: str(r.id), number: Number(r.number), status: (['open', 'invoiced', 'completed', 'cancelled'].includes(str(r.status)) ? str(r.status) : 'open') as Draft['status'], customer_name: str(r.customer_name), phone: str(r.phone), email: str(r.email) || null,
      total: Number(r.total) || 0, items: Array.isArray(r.items) ? (r.items as Draft['items']) : [], due_date: str(r.due_date) || null, token: str(r.invoice_token), invoice_sent_at: str(r.invoice_sent_at) || null,
      claimed_at: str(r.payment_claimed_at) || null, claim_note: str(r.payment_claim_note) || null, order_id: str(r.order_id) || null, created_at: str(r.created_at),
    })));
  }, [sb, businessId]);
  useEffect(() => { load(); }, [load]);

  async function complete(d: Draft, paid: boolean) {
    setBusy(d.id); setErr(''); setOk('');
    const { data, error } = await sb.rpc('xenon_complete_draft', { p_draft: d.id, p_mark_paid: paid, p_deduct: null });
    setBusy(''); setCompleteFor(null);
    if (error) return setErr(orderError(error.message));
    setOk(`Draft #${d.number} is now order #${(data as { order_number?: number } | null)?.order_number ?? ''}.`);
    await load(); onOrdersChanged();
  }
  async function cancel(d: Draft) {
    setBusy(d.id);
    const { error } = await sb.from('draft_orders').update({ status: 'cancelled' }).eq('id', d.id).eq('business_id', businessId);
    setBusy('');
    if (error) return setErr(orderError(error.message));
    await load();
  }
  async function remove(d: Draft) {
    setBusy(d.id); setDelFor(null);
    const { error } = await sb.from('draft_orders').delete().eq('id', d.id).eq('business_id', businessId);
    setBusy('');
    if (error) return setErr(orderError(error.message));
    setOk(`Draft #${d.number} deleted.`);
    await load();
  }
  async function markSent(d: Draft) {
    if (d.status === 'open') await sb.from('draft_orders').update({ status: 'invoiced', invoice_sent_at: new Date().toISOString() }).eq('id', d.id).eq('business_id', businessId);
    await load();
  }

  const link = (d: Draft) => `${typeof window !== 'undefined' ? window.location.origin : ''}/invoice/${d.token}`;

  if (rows == null) return <ListSkeleton rows={4} />;
  if (fatal) return <Err>{fatal}</Err>;
  if (rows.length === 0) {
    return <Empty title="Manually create orders and invoices" body="Use draft orders to take orders over the phone or WhatsApp, send invoices to customers, and collect payments." action={<button className={btn} onClick={onCreate}>Create draft order</button>} />;
  }

  const shown = rows.filter((d) => (filter === 'active' ? d.status === 'open' || d.status === 'invoiced' : d.status === filter));
  const pending = rows.filter((d) => d.status === 'open' || d.status === 'invoiced');
  const claims = pending.filter((d) => d.claimed_at);
  const chip = (a: boolean) => `rounded-full px-3.5 py-1.5 text-xs font-semibold ${a ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button className={chip(filter === 'active')} onClick={() => setFilter('active')}>Waiting ({pending.length})</button>
          <button className={chip(filter === 'completed')} onClick={() => setFilter('completed')}>Turned into orders</button>
          <button className={chip(filter === 'cancelled')} onClick={() => setFilter('cancelled')}>Cancelled</button>
        </div>
        <p className="text-sm text-slate-500">Waiting to be paid: <b className="text-slate-900">{naira(pending.reduce((a, d) => a + d.total, 0))}</b></p>
      </div>
      {claims.length > 0 && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900">💬 <b>{claims.length}</b> customer{claims.length === 1 ? '' : 's'} said they have paid. Check your bank, then turn the draft into a paid order.</div>}
      <Err>{err}</Err>
      <Ok>{ok}</Ok>

      {shown.length === 0 ? <div className={`${card} p-10 text-center text-sm text-slate-500`}>Nothing here.</div> : (
        <div className={`${card} divide-y divide-slate-100`}>
          {shown.map((d) => {
            const overdue = d.due_date && d.due_date < today && (d.status === 'open' || d.status === 'invoiced');
            const live = d.status === 'open' || d.status === 'invoiced';
            return (
              <div key={d.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold">#{d.number}</span>
                  <span className="font-medium">{d.customer_name || 'No customer yet'}</span>
                  <Pill tone={tone[d.status]}>{label[d.status]}</Pill>
                  {d.claimed_at && live && <Pill tone="bg-green-100 text-green-800">Customer says paid</Pill>}
                  {overdue && <Pill tone="bg-red-100 text-red-700">Overdue</Pill>}
                  <span className="ml-auto font-semibold">{naira(d.total)}</span>
                </div>
                <p className="truncate text-xs text-slate-500">{fmtDate(d.created_at)} · {d.items.map((i) => `${i.quantity} × ${i.name}`).join(', ') || 'No items'}{d.due_date ? ` · due ${fmtDay(d.due_date)}` : ''}</p>
                {d.claim_note && live && <p className="text-xs text-green-800">Customer note: &ldquo;{d.claim_note}&rdquo;</p>}
                <div className="flex flex-wrap gap-2">
                  {live && <button className={small} onClick={() => onEdit(d.id)}>Edit</button>}
                  {live && <button className={small} onClick={() => setSendFor(d)}>Send invoice</button>}
                  {live && <button className={d.claimed_at ? btn + ' !px-3 !py-1.5 !text-xs' : small} disabled={busy === d.id} onClick={() => setCompleteFor(d)}>Turn into order</button>}
                  {live && <button className={small} disabled={busy === d.id} onClick={() => cancel(d)}>Cancel draft</button>}
                  {!live && d.status === 'cancelled' && <button className={small} onClick={() => onEdit(d.id)}>View</button>}
                  {d.status !== 'completed' && <button className={`${small} text-red-600`} disabled={busy === d.id} onClick={() => setDelFor(d)}>Delete</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sendFor && (
        <Modal title={`Invoice #${sendFor.number}`} onClose={() => setSendFor(null)}>
          <p className="text-sm text-slate-600">Your customer opens this link, sees the invoice and your bank details, then taps &ldquo;I have paid&rdquo;.</p>
          <input readOnly className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs" value={link(sendFor)} onFocus={(e) => e.currentTarget.select()} />
          <div className="mt-3 flex flex-wrap gap-2">
            {sendFor.phone && <a className={btn} target="_blank" rel="noopener noreferrer" onClick={() => markSent(sendFor)} href={waLink(sendFor.phone, invoiceText(storeName, sendFor.number, sendFor.total, link(sendFor)))}>Send on WhatsApp</a>}
            {sendFor.email && <a className={ghost} onClick={() => markSent(sendFor)} href={mailLink(sendFor.email, `Invoice #${sendFor.number} from ${storeName}`, invoiceText(storeName, sendFor.number, sendFor.total, link(sendFor)))}>Send by email</a>}
            <button className={ghost} onClick={() => { navigator.clipboard?.writeText(link(sendFor)); markSent(sendFor); }}>Copy link</button>
          </div>
        </Modal>
      )}
      {completeFor && (
        <Modal title={`Turn draft #${completeFor.number} into an order`} onClose={() => setCompleteFor(null)}>
          <p className="text-sm text-slate-600">{completeFor.customer_name || 'This customer'} · {naira(completeFor.total)}</p>
          <div className="mt-4 grid gap-2">
            <button className={btn} disabled={busy === completeFor.id} onClick={() => complete(completeFor, true)}>Order — payment received</button>
            <button className={ghost} disabled={busy === completeFor.id} onClick={() => complete(completeFor, false)}>Order — payment still pending</button>
          </div>
        </Modal>
      )}
      {delFor && (
        <Modal title="Delete this draft?" onClose={() => setDelFor(null)} footer={<><button className={ghost} onClick={() => setDelFor(null)}>Keep</button><button className={btn} onClick={() => remove(delFor)}>Delete draft #{delFor.number}</button></>}>
          <p className="text-sm text-slate-600">Its invoice link will stop working. This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}
