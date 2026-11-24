'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Printer, MessageCircle, Mail, Truck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  balanceOf, mailLink, naira, orderError, paymentReminder, payLabel, payTone, parseTags, printOrdersHtml, sourceLabel, statusLabel, statusMessage, statusTone, trackingMessage, waLink,
  needsAttention, type Order, type OrderStatus,
} from '@/lib/orders';
import { Err, Grey, Modal, Ok, Pill, btn, card, field, fmtDate, ghost, openPrint, small } from './ui';

type Ev = { id: string; kind: string; message: string; actor: string | null; created_at: string };
type Bank = { bank_name: string; account_number: string; account_name: string };

export default function OrderDetail({
  order, businessId, storeName, bank, doubleOptIn, onClose, onChanged, onDuplicate,
}: { order: Order; businessId: string; storeName: string; bank: Bank; doubleOptIn: boolean; onClose: () => void; onChanged: (msg?: string) => void; onDuplicate: (o: Order) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [o, setO] = useState(order);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'' | 'cancel' | 'pay' | 'refund'>('');
  const [courier, setCourier] = useState(order.courier ?? '');
  const [tracking, setTracking] = useState(order.tracking_number ?? '');
  const [staff, setStaff] = useState(order.staff_note ?? '');
  const [tagText, setTagText] = useState('');
  const [noteText, setNoteText] = useState('');

  const loadEvents = useCallback(async () => {
    const { data, error } = await sb.from('order_events').select('id,kind,message,actor,created_at').eq('order_id', order.id).order('created_at', { ascending: false }).limit(100);
    setEvents(error ? [] : ((data ?? []) as Ev[]));
  }, [sb, order.id]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const patch = (p: Partial<Order>) => setO((x) => ({ ...x, ...p }));

  async function run<T>(fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>, done: string, after?: (d: T | null) => void) {
    setErr(''); setOk(''); setBusy(true);
    const { data, error } = await fn();
    setBusy(false);
    if (error) { setErr(orderError(error.message)); return false; }
    setOk(done); after?.(data); await loadEvents(); onChanged();
    return true;
  }

  async function setStatus(status: OrderStatus, reason?: string) {
    const stockNote = (d: unknown) => {
      const st = (d as { stock?: { short?: unknown[] } | null } | null)?.stock;
      return st?.short?.length ? ` ${st.short.length} item(s) did not have enough stock.` : '';
    };
    let extra = '';
    const good = await run(() => sb.rpc('xenon_set_order_status', { p_order: o.id, p_status: status, p_reason: reason ?? null }), `Marked as ${statusLabel[status].toLowerCase()}.`, (d) => { extra = stockNote(d); });
    if (good) {
      patch({ status, cancel_reason: status === 'cancelled' ? reason ?? null : null, request_type: status === 'cancelled' ? null : o.request_type });
      if (extra) setOk((v) => v + extra);
    }
  }

  async function saveFulfil() {
    await run(() => sb.from('orders').update({ courier: courier.trim() || null, tracking_number: tracking.trim() || null }).eq('id', o.id), 'Delivery details saved.', () => patch({ courier: courier.trim() || null, tracking_number: tracking.trim() || null }));
  }
  async function saveStaff() {
    await run(() => sb.from('orders').update({ staff_note: staff.trim() || null }).eq('id', o.id), 'Private note saved.', () => patch({ staff_note: staff.trim() || null }));
  }
  async function saveTags(tags: string[]) {
    await run(() => sb.from('orders').update({ tags }).eq('id', o.id), 'Tags saved.', () => patch({ tags }));
  }
  async function clearRequest() {
    await run(() => sb.from('orders').update({ request_type: null, request_note: null, request_at: null }).eq('id', o.id), 'Request dismissed.', () => patch({ request_type: null, request_note: null }));
  }
  async function confirmOptIn() {
    await run(() => sb.from('orders').update({ optin_confirmed: true }).eq('id', o.id), 'Marked as confirmed.', () => patch({ optin_confirmed: true }));
  }
  async function addNote() {
    const t = noteText.trim();
    if (!t) return;
    const good = await run(() => sb.rpc('xenon_add_order_note', { p_order: o.id, p_message: t }), 'Note added.');
    if (good) setNoteText('');
  }
  async function archive(v: boolean) {
    await run(() => sb.from('orders').update({ archived: v }).eq('id', o.id), v ? 'Archived.' : 'Restored.', () => patch({ archived: v }));
  }

  const owed = balanceOf(o);
  const attention = needsAttention(o);
  const sub = o.items.reduce((a, i) => a + i.price * i.quantity, 0);
  const confirmText = `Hi ${o.customer_name}, you asked ${storeName || 'our store'} to send you news and offers. Please reply YES to confirm.`;

  return (
    <Modal title={`Order #${o.order_number}`} onClose={onClose} wide>
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={statusTone[o.status]}>{statusLabel[o.status]}</Pill>
          <Pill tone={payTone[o.payment_status]}>{payLabel[o.payment_status]}</Pill>
          <span className="text-xs text-slate-500">{fmtDate(o.created_at)} · {sourceLabel(o.source)}</span>
          {o.archived && <Pill tone="bg-slate-200 text-slate-600">Archived</Pill>}
        </div>
        <Err>{err}</Err>
        <Ok>{ok}</Ok>
        {attention && !o.request_type && <div className="rounded-xl bg-amber-50 px-4 py-2.5 text-amber-900">⚠ {attention}</div>}

        {o.request_type && (
          <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
            <p className="font-semibold">Customer asked to {o.request_type === 'cancel' ? 'cancel this order' : 'return this order'}</p>
            {o.request_note && <p className="mt-1">&ldquo;{o.request_note}&rdquo;</p>}
            {o.request_fee > 0 && <p className="mt-1">Fee that may apply: {naira(o.request_fee)}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {o.request_type === 'cancel' && o.status !== 'cancelled' && <button className={small} disabled={busy} onClick={() => setStatus('cancelled', 'Customer asked to cancel')}>Approve and cancel order</button>}
              {o.request_type === 'return' && o.amount_paid > o.refunded_amount && <button className={small} onClick={() => setModal('refund')}>Approve and refund</button>}
              <button className={small} disabled={busy} onClick={clearRequest}>Dismiss request</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {o.status === 'new' && <button className={btn} disabled={busy} onClick={() => setStatus('preparing')}>Start preparing</button>}
          {(o.status === 'new' || o.status === 'preparing') && <button className={o.status === 'new' ? ghost : btn} disabled={busy} onClick={() => setStatus('delivered')}>Mark delivered</button>}
          {o.status !== 'cancelled' && o.status !== 'delivered' && <button className={ghost} disabled={busy} onClick={() => setModal('cancel')}>Cancel order</button>}
          {(o.status === 'cancelled' || o.status === 'delivered') && <button className={ghost} disabled={busy} onClick={() => setStatus('new')}>Reopen</button>}
          {owed > 0 && <button className={ghost} onClick={() => setModal('pay')}>Record payment</button>}
          {o.amount_paid > o.refunded_amount && <button className={ghost} onClick={() => setModal('refund')}>Refund</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={small} onClick={() => !openPrint(printOrdersHtml([o], storeName, 'invoice')) && setErr('Allow pop-ups to print.')}><Printer size={14} /> Invoice</button>
          <button className={small} onClick={() => !openPrint(printOrdersHtml([o], storeName, 'packing')) && setErr('Allow pop-ups to print.')}><Printer size={14} /> Packing slip</button>
          <button className={small} onClick={() => onDuplicate(o)}><Copy size={14} /> Duplicate</button>
          <button className={small} onClick={() => archive(!o.archived)} disabled={busy}>{o.archived ? 'Restore' : 'Archive'}</button>
        </div>

        {/* Customer */}
        <div className={`${card} p-4`}>
          <p className="font-semibold">{o.customer_name}</p>
          <a href={`tel:${o.phone}`} className="text-blue-600">{o.phone}</a>
          {o.alt_phone && <p className="text-slate-600">Second phone: {o.alt_phone}</p>}
          {o.email && <p className="text-slate-600">{o.email}</p>}
          {o.company && <p className="text-slate-600">{o.company}</p>}
          {o.address && <p className="text-slate-600">{o.address}{o.address2 ? `, ${o.address2}` : ''}</p>}
          {o.delivery_method && (
            <p className="mt-1 text-slate-600">
              {o.delivery_method === 'pickup' ? 'Pickup in store' : o.delivery_method === 'local' ? 'Local delivery' : 'Delivery'}
              {o.delivery_zone ? ` · ${o.delivery_zone}` : ''}{o.delivery_fee > 0 ? ` · ${naira(o.delivery_fee)}` : ''}{o.delivery_eta ? ` · ${o.delivery_eta}` : ''}
            </p>
          )}
          {o.note && <p className="mt-1 text-slate-500">Customer note: {o.note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {o.phone && <a className={small} target="_blank" rel="noopener noreferrer" href={waLink(o.phone, statusMessage(o, storeName))}><MessageCircle size={14} /> Message on WhatsApp</a>}
            {o.phone && owed > 0 && o.status !== 'cancelled' && <a className={small} target="_blank" rel="noopener noreferrer" href={waLink(o.phone, paymentReminder(o, storeName, bank))}>Payment reminder</a>}
            {o.email && <a className={small} href={mailLink(o.email, `Your order #${o.order_number}`, statusMessage(o, storeName))}><Mail size={14} /> Email</a>}
          </div>
        </div>

        {/* Items */}
        <div className={`${card} p-4`}>
          <div className="divide-y divide-slate-100">
            {o.items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-2.5">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">{i.image_url && <img src={i.image_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.name}</p>
                  <p className="text-xs text-slate-500">{[i.variant_title, i.sku && `SKU ${i.sku}`, i.is_custom && 'Custom item'].filter(Boolean).join(' · ')}{i.stock_deducted > 0 ? ' · stock taken out' : ''}</p>
                </div>
                <span className="text-slate-500">{i.quantity} × {naira(i.price)}</span>
                <span className="w-24 text-right font-medium">{naira(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-slate-600">
            <Line l="Subtotal" v={naira(sub)} />
            {o.discount_amount > 0 && <Line l={`Discount${o.discount_code ? ` (${o.discount_code})` : ''}`} v={'−' + naira(o.discount_amount)} g />}
            {o.delivery_fee > 0 && <Line l="Delivery" v={naira(o.delivery_fee)} />}
            {o.tip > 0 && <Line l="Tip" v={naira(o.tip)} />}
            {o.tax_amount > 0 && <Line l={`${o.tax_label || 'VAT'}${o.tax_included ? ' (included)' : ''}`} v={naira(o.tax_amount)} />}
            {o.credit_used > 0 && <Line l="Store credit used" v={'−' + naira(o.credit_used)} />}
            <Line l="Total" v={naira(o.total)} b />
            <Line l={`Paid (${o.payment_method === 'cod' ? 'pay on delivery' : 'bank transfer'})`} v={naira(o.amount_paid)} />
            {o.refunded_amount > 0 && <Line l="Refunded" v={'−' + naira(o.refunded_amount)} />}
            {owed > 0 && <Line l="Balance due" v={naira(owed)} b />}
          </div>
        </div>

        {/* Delivery tracking */}
        {o.delivery_method !== 'pickup' && o.status !== 'cancelled' && (
          <div className={`${card} p-4`}>
            <p className="mb-2 flex items-center gap-1.5 font-semibold"><Truck size={16} /> Delivery tracking</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Courier or rider (e.g. GIG, Kwik)" value={courier} onChange={(e) => setCourier(e.target.value)} />
              <input className={field} placeholder="Tracking number or rider phone" value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={small} disabled={busy} onClick={saveFulfil}>Save</button>
              {o.phone && (courier.trim() || tracking.trim()) && <a className={small} target="_blank" rel="noopener noreferrer" href={waLink(o.phone, trackingMessage({ ...o, courier: courier.trim() || null, tracking_number: tracking.trim() || null }, storeName))}>Send tracking on WhatsApp</a>}
            </div>
          </div>
        )}

        {/* Opt-in (kept from the old Orders page) */}
        {(o.opt_email || o.opt_sms || o.opt_whatsapp) && (
          <div className="text-xs text-slate-500">
            <p>Agreed to receive news and offers by: {[o.opt_email && 'Email', o.opt_sms && 'SMS', o.opt_whatsapp && 'WhatsApp'].filter(Boolean).join(', ')}{doubleOptIn && (o.optin_confirmed ? ' · Confirmed' : ' · Not confirmed yet')}</p>
            {doubleOptIn && !o.optin_confirmed && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(o.opt_whatsapp || o.opt_sms) && <a className={small} target="_blank" rel="noopener noreferrer" href={waLink(o.phone, confirmText)}>Send WhatsApp confirmation</a>}
                {o.opt_email && o.email && <a className={small} href={mailLink(o.email, 'Please confirm', confirmText)}>Send email confirmation</a>}
                <button className={small} disabled={busy} onClick={confirmOptIn}>Mark as confirmed</button>
              </div>
            )}
          </div>
        )}

        {/* Tags + private note */}
        <div className={`${card} space-y-3 p-4`}>
          <div>
            <p className="mb-1.5 font-semibold">Tags</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {o.tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">{t}<button aria-label={`Remove ${t}`} onClick={() => saveTags(o.tags.filter((x) => x !== t))}><X size={12} /></button></span>)}
              {o.tags.length === 0 && <span className="text-xs text-slate-400">No tags yet</span>}
            </div>
            <input className={field} placeholder="Add a tag and press Enter" value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const t = parseTags(tagText, o.tags); setTagText(''); if (t.length !== o.tags.length) saveTags(t); } }} />
          </div>
          <div>
            <p className="mb-1.5 font-semibold">Private note</p>
            <textarea className={`${field} min-h-[60px]`} placeholder="Only you see this" value={staff} onChange={(e) => setStaff(e.target.value)} maxLength={2000} />
            {staff.trim() !== (o.staff_note ?? '') && <button className={`${small} mt-2`} disabled={busy} onClick={saveStaff}>Save note</button>}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <p className="mb-2 font-semibold">Timeline</p>
          <div className="mb-3 flex gap-2">
            <input className={field} placeholder="Add a comment (e.g. customer called, rider delayed)" value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} maxLength={1000} />
            <button className={ghost} disabled={busy || !noteText.trim()} onClick={addNote}>Post</button>
          </div>
          {events == null ? <Grey className="h-16 w-full" /> : (
            <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400" />
                  <p>{e.message}</p>
                  <p className="text-xs text-slate-400">{fmtDate(e.created_at)}{e.actor === 'customer' ? ' · customer' : e.actor === 'system' ? ' · automatic' : ''}</p>
                </li>
              ))}
              <li className="relative"><span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-300" /><p className="text-slate-500">Order placed</p><p className="text-xs text-slate-400">{fmtDate(o.created_at)}</p></li>
            </ol>
          )}
        </div>
      </div>

      {modal === 'cancel' && <CancelModal stockTaken={o.stock_committed} paid={o.amount_paid > 0} onClose={() => setModal('')} onGo={async (r) => { setModal(''); await setStatus('cancelled', r); }} />}
      {modal === 'pay' && (
        <AmountModal title="Record a payment" hint={`Balance due ${naira(owed)}`} max={Math.max(owed, 1)} initial={owed} cta="Record payment" onClose={() => setModal('')}
          onGo={async (amt, note) => { setModal(''); const good = await run(() => sb.rpc('xenon_record_payment', { p_order: o.id, p_amount: amt, p_note: note || null }), 'Payment recorded.', (d) => { const r = d as { payment_status?: Order['payment_status']; amount_paid?: number } | null; if (r?.payment_status) patch({ payment_status: r.payment_status, amount_paid: r.amount_paid ?? o.amount_paid }); }); void good; }} />
      )}
      {modal === 'refund' && (
        <AmountModal title="Record a refund" hint={`You can refund up to ${naira(o.amount_paid - o.refunded_amount)}. Xenon records it; send the money yourself.`} max={o.amount_paid - o.refunded_amount} initial={o.amount_paid - o.refunded_amount} cta="Record refund" restock={o.stock_committed} onClose={() => setModal('')}
          onGo={async (amt, note, restock) => { setModal(''); await run(() => sb.rpc('xenon_refund_order', { p_order: o.id, p_amount: amt, p_note: note || null, p_restock: !!restock }), 'Refund recorded.', () => patch({ refunded_amount: o.refunded_amount + amt, payment_status: o.refunded_amount + amt >= o.amount_paid ? 'refunded' : o.payment_status, request_type: null })); }} />
      )}
    </Modal>
  );
}

function Line({ l, v, b, g }: { l: string; v: string; b?: boolean; g?: boolean }) {
  return <div className={`flex justify-between ${b ? 'font-bold text-slate-900' : ''} ${g ? 'text-green-700' : ''}`}><span>{l}</span><span>{v}</span></div>;
}

function CancelModal({ stockTaken, paid, onClose, onGo }: { stockTaken: boolean; paid: boolean; onClose: () => void; onGo: (reason: string) => void }) {
  const [r, setR] = useState('');
  const quick = ['Customer changed mind', 'Out of stock', 'Could not reach customer', 'Payment not received', 'Duplicate order'];
  return (
    <Modal title="Cancel this order" onClose={onClose} footer={<><button className={ghost} onClick={onClose}>Keep order</button><button className={btn} onClick={() => onGo(r.trim())}>Cancel order</button></>}>
      <div className="space-y-3 text-sm">
        {stockTaken && <p className="rounded-xl bg-blue-50 px-3 py-2 text-blue-900">Items already taken out of stock will be put back automatically.</p>}
        {paid && <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">This order has a payment. After cancelling, use Refund to record what you paid back.</p>}
        <div className="flex flex-wrap gap-2">{quick.map((q) => <button key={q} className={small} onClick={() => setR(q)}>{q}</button>)}</div>
        <input className={field} placeholder="Reason (optional)" value={r} maxLength={300} onChange={(e) => setR(e.target.value)} />
      </div>
    </Modal>
  );
}

function AmountModal({ title, hint, max, initial, cta, restock, onClose, onGo }: { title: string; hint: string; max: number; initial: number; cta: string; restock?: boolean; onClose: () => void; onGo: (amount: number, note: string, restock?: boolean) => void }) {
  const [a, setA] = useState(String(initial));
  const [n, setN] = useState('');
  const [rs, setRs] = useState(false);
  const amt = Math.round(Number(a) || 0);
  return (
    <Modal title={title} onClose={onClose} footer={<><button className={ghost} onClick={onClose}>Cancel</button><button className={btn} disabled={amt <= 0 || amt > max} onClick={() => onGo(amt, n.trim(), rs)}>{cta}</button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-500">{hint}</p>
        <input autoFocus className={field} inputMode="numeric" value={a} onChange={(e) => setA(e.target.value.replace(/[^\d]/g, ''))} />
        {amt > max && <p className="text-xs text-red-600">That is more than {naira(max)}.</p>}
        <input className={field} placeholder="Note (e.g. transfer from GTBank, ref 12345)" value={n} maxLength={200} onChange={(e) => setN(e.target.value)} />
        {restock && <label className="flex items-center gap-2"><input type="checkbox" checked={rs} onChange={(e) => setRs(e.target.checked)} /> Put the items back in stock</label>}
      </div>
    </Modal>
  );
}
