'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { naira, waLink } from '@/lib/orders';

type Inv = {
  store: string; store_phone: string | null; bank_name: string | null; account_number: string | null; account_name: string | null;
  number: number; status: string; paid: boolean; claimed: boolean; customer_name: string;
  items: { name: string; price: number; quantity: number; variant_title?: string }[];
  subtotal: number; discount_amount: number; discount_reason: string | null; shipping_title: string | null; shipping_fee: number;
  tax_amount: number; tax_included: boolean; tax_label: string; total: number; payment_method: string; due_date: string | null; note: string | null; invoice_note: string | null; created_at: string;
};

function InvoiceInner() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? '');
  const sb = useMemo(() => createClient(), []);
  const [inv, setInv] = useState<Inv | null | undefined>(undefined);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.rpc('xenon_get_invoice', { p_token: token });
      setInv(error || !data ? null : (data as Inv));
    })();
  }, [sb, token]);

  async function claim() {
    setBusy(true); setErr('');
    const { error } = await sb.rpc('xenon_invoice_claim', { p_token: token, p_note: note.trim() || null });
    setBusy(false);
    if (error) return setErr(error.message);
    setSent(true);
  }

  if (inv === undefined) {
    return <div className="mx-auto max-w-xl space-y-3 p-6">{[24, 48, 64].map((h) => <div key={h} className="animate-pulse rounded-2xl bg-slate-200/70" style={{ height: h * 4 }} />)}</div>;
  }
  if (inv === null) {
    return <div className="mx-auto max-w-xl p-10 text-center"><h1 className="text-xl font-bold">Invoice not found</h1><p className="mt-2 text-sm text-slate-500">This link may be wrong or the invoice was removed. Please ask the shop to send it again.</p></div>;
  }
  const closed = inv.status === 'completed' || inv.status === 'cancelled';
  const hasBank = !!inv.account_number;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm text-slate-500">Invoice from</p><h1 className="text-xl font-bold">{inv.store}</h1></div>
            <div className="text-right"><p className="text-lg font-bold">#{inv.number}</p><p className="text-xs text-slate-500">{new Date(inv.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' })}</p></div>
          </div>
          <p className="mt-4 text-sm">For <b>{inv.customer_name || 'you'}</b></p>
          {inv.due_date && <p className="text-xs text-slate-500">Due {new Date(inv.due_date + 'T00:00:00').toLocaleDateString('en-NG', { dateStyle: 'medium' })}</p>}

          <div className="mt-4 divide-y divide-slate-100 text-sm">
            {inv.items.map((i, k) => (
              <div key={k} className="flex justify-between gap-3 py-2.5"><span>{i.quantity} × {i.name}{i.variant_title ? ` (${i.variant_title})` : ''}</span><span>{naira(i.price * i.quantity)}</span></div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
            <div className="flex justify-between"><span>Subtotal</span><span>{naira(inv.subtotal)}</span></div>
            {inv.discount_amount > 0 && <div className="flex justify-between text-green-700"><span>Discount{inv.discount_reason ? ` (${inv.discount_reason})` : ''}</span><span>−{naira(inv.discount_amount)}</span></div>}
            {inv.shipping_fee > 0 && <div className="flex justify-between"><span>{inv.shipping_title || 'Delivery'}</span><span>{naira(inv.shipping_fee)}</span></div>}
            {inv.tax_amount > 0 && <div className="flex justify-between"><span>{inv.tax_label}{inv.tax_included ? ' (included)' : ''}</span><span>{naira(inv.tax_amount)}</span></div>}
            <div className="flex justify-between pt-1 text-lg font-bold text-slate-900"><span>Total</span><span>{naira(inv.total)}</span></div>
          </div>
          {inv.note && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{inv.note}</p>}
          {inv.invoice_note && <p className="mt-3 text-xs text-slate-500">{inv.invoice_note}</p>}
        </div>

        {inv.paid || inv.status === 'completed' ? (
          <div className="rounded-2xl bg-green-50 p-5 text-center text-green-900"><p className="text-lg font-bold">{inv.paid ? 'Paid — thank you! ✅' : 'This invoice is now an order.'}</p></div>
        ) : inv.status === 'cancelled' ? (
          <div className="rounded-2xl bg-slate-100 p-5 text-center text-slate-600">This invoice was cancelled.</div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold">How to pay</h2>
            {inv.payment_method === 'cod' || !hasBank ? (
              <p className="text-sm text-slate-600">{inv.payment_method === 'cod' ? 'You will pay when your order is delivered.' : 'Please contact the shop to arrange payment.'}</p>
            ) : (
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">Transfer {naira(inv.total)} to</p>
                <p className="mt-1 text-lg font-bold tracking-wide">{inv.account_number}</p>
                <p>{inv.bank_name}</p><p>{inv.account_name}</p>
                <button className="mt-2 text-xs font-semibold text-blue-700 underline" onClick={() => navigator.clipboard?.writeText(inv.account_number ?? '')}>Copy account number</button>
              </div>
            )}
            {inv.payment_method !== 'cod' && hasBank && (inv.claimed || sent ? (
              <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900">Thanks! We told the shop you have paid. They will confirm shortly.</p>
            ) : (
              <>
                <input className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" placeholder="Optional: your bank or transfer reference" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button disabled={busy || closed} onClick={claim} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">I have paid</button>
              </>
            ))}
            {inv.store_phone && <a className="block text-center text-sm text-blue-700 underline" target="_blank" rel="noopener noreferrer" href={waLink(inv.store_phone, `Hello, about invoice #${inv.number}`)}>Questions? Chat with {inv.store} on WhatsApp</a>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl p-6"><div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" /></div>}>
      <InvoiceInner />
    </Suspense>
  );
}
