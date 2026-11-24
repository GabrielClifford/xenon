'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fillTemplate, itemsText, mailLink, naira, orderError, waLink } from '@/lib/orders';
import { Err, ListSkeleton, Modal, Ok, Pill, Stat, ago, btn, card, field, ghost, small } from './ui';

type Item = { name: string; price: number; quantity: number; variant_title?: string; product_id?: string | null; variant_id?: string | null; image_url?: string };
type Cart = {
  id: string; name: string; phone: string; email: string; items: Item[]; subtotal: number; status: 'incomplete' | 'recovered' | 'blocked'; blocked_reason: string;
  count: number; sent_at: string | null; last: string; recovered_order_id: string | null;
};
type Msg = { subject: string; body: string };

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const DEF: Msg = {
  subject: 'You left something in your cart',
  body: 'Hi {name},\n\nYou left these in your cart at {store}:\n{items}\n\nTotal: {total}\n\nFinish your order here: {link}\n\nNeed help? Just reply to this message.',
};

export default function AbandonedPage({ businessId, storeName, shopUrl, onDraftCreated }: { businessId: string; storeName: string; shopUrl: string; onDraftCreated: (id: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Cart[] | null>(null);
  const [fatal, setFatal] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [view, setView] = useState<'incomplete' | 'recovered' | 'blocked'>('incomplete');
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState<Msg>(DEF);
  const [editMsg, setEditMsg] = useState(false);
  const [open, setOpen] = useState<Cart | null>(null);
  const [blockFor, setBlockFor] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      sb.from('abandoned_checkouts').select('id,customer_name,phone,email,items,subtotal,status,blocked_reason,recovery_count,recovery_sent_at,recovered_order_id,last_activity_at').eq('business_id', businessId).order('last_activity_at', { ascending: false }).limit(400),
      sb.rpc('xenon_order_settings', { p_business: businessId }),
    ]);
    if (c.error) { setFatal(orderError(c.error.message)); setRows([]); return; }
    setFatal('');
    const st = (s.data ?? {}) as Record<string, unknown>;
    setMsg({ subject: str(st.recovery_subject) || DEF.subject, body: str(st.recovery_body) || DEF.body });
    setRows((c.data ?? []).map((r: Record<string, unknown>) => ({
      id: str(r.id), name: str(r.customer_name), phone: str(r.phone), email: str(r.email), items: Array.isArray(r.items) ? (r.items as Item[]) : [], subtotal: Number(r.subtotal) || 0,
      status: (['incomplete', 'recovered', 'blocked'].includes(str(r.status)) ? str(r.status) : 'incomplete') as Cart['status'], blocked_reason: str(r.blocked_reason), count: Number(r.recovery_count) || 0,
      sent_at: str(r.recovery_sent_at) || null, last: str(r.last_activity_at), recovered_order_id: str(r.recovered_order_id) || null,
    })));
  }, [sb, businessId]);
  useEffect(() => { load(); }, [load]);

  const text = (c: Cart) => fillTemplate(msg.body, { name: c.name.split(' ')[0] || 'there', store: storeName, items: itemsText(c.items), total: naira(c.subtotal), link: shopUrl });

  async function contacted(c: Cart) {
    await sb.from('abandoned_checkouts').update({ recovery_count: c.count + 1, recovery_sent_at: new Date().toISOString() }).eq('id', c.id).eq('business_id', businessId);
    load();
  }
  async function block(c: Cart, what: 'phone' | 'email') {
    setBusy(true); setErr('');
    const { error } = await sb.rpc('xenon_block_contact', { p_business: businessId, p_value: what === 'phone' ? c.phone : c.email, p_reason: 'Blocked from abandoned checkouts' });
    setBusy(false); setBlockFor(null);
    if (error) return setErr(orderError(error.message));
    setOk('Blocked. Their future carts will land in Blocked and you will not be reminded.');
    load();
  }
  async function unblock(c: Cart) {
    setBusy(true);
    const val = c.phone || c.email;
    const { error } = await sb.rpc('xenon_unblock_contact', { p_business: businessId, p_value: val });
    setBusy(false);
    if (error) return setErr(orderError(error.message));
    load();
  }
  async function remove(c: Cart) {
    const { error } = await sb.from('abandoned_checkouts').delete().eq('id', c.id).eq('business_id', businessId);
    if (error) return setErr(orderError(error.message));
    setOpen(null); load();
  }
  async function toDraft(c: Cart) {
    setBusy(true); setErr('');
    const { data, error } = await sb.from('draft_orders').insert({
      business_id: businessId, customer_name: c.name, phone: c.phone, email: c.email || null,
      items: c.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity, product_id: i.product_id || null, variant_id: i.variant_id || null, variant_title: i.variant_title || null, image_url: i.image_url || null, custom: !i.product_id })),
      subtotal: c.subtotal, total: c.subtotal,
    }).select('id').single();
    setBusy(false);
    if (error || !data) return setErr(orderError(error?.message ?? 'Could not create the draft.'));
    setOpen(null);
    onDraftCreated(str(data.id));
  }
  async function saveMsg(m: Msg) {
    const cur = await sb.from('order_settings').select('data').eq('business_id', businessId).maybeSingle();
    const data = { ...((cur.data?.data as Record<string, unknown>) ?? {}), recovery_subject: m.subject, recovery_body: m.body };
    const { error } = await sb.from('order_settings').upsert({ business_id: businessId, data, updated_at: new Date().toISOString() }, { onConflict: 'business_id' });
    if (error) return setErr(orderError(error.message));
    setMsg(m); setEditMsg(false); setOk('Recovery message saved.');
  }

  if (rows == null) return <ListSkeleton rows={3} />;
  if (fatal) return <Err>{fatal}</Err>;

  const mine = rows.filter((r) => r.status === view);
  const risk = rows.filter((r) => r.status === 'incomplete').reduce((a, r) => a + r.subtotal, 0);
  const won = rows.filter((r) => r.status === 'recovered');
  const rate = rows.filter((r) => r.status !== 'blocked').length ? Math.round((won.length / rows.filter((r) => r.status !== 'blocked').length) * 100) : 0;
  const labels = { incomplete: 'Incomplete', recovered: 'Recovered', blocked: 'Blocked' } as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <button className={ghost} onClick={() => setMenu(!menu)}>{labels[view]} <ChevronDown size={15} /></button>
          {menu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {(['incomplete', 'recovered', 'blocked'] as const).map((v) => (
                <button key={v} className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${v === view ? 'bg-slate-100 font-semibold' : ''}`} onClick={() => { setView(v); setMenu(false); }}>{v === view ? '✓ ' : ''}{labels[v]}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Sales at risk" value={naira(risk)} tone="text-orange-600" />
        <Stat label="Recovered" value={naira(won.reduce((a, r) => a + r.subtotal, 0))} tone="text-green-700" />
        <Stat label="Recovery rate" value={`${rate}%`} />
      </div>
      <Err>{err}</Err>
      <Ok>{ok}</Ok>

      {mine.length === 0 ? (
        <div className={`${card} overflow-hidden`}>
          <div className="px-6 py-8">
            <h3 className="text-lg font-semibold">{view === 'incomplete' ? 'Abandoned checkouts will show here' : view === 'recovered' ? 'Recovered checkouts will show here' : 'Blocked checkouts will show here'}</h3>
            <p className="mt-1 text-sm text-slate-500">See when customers put an item in their cart but don&rsquo;t check out. You can message them a link to finish their order.</p>
          </div>
          <div className="bg-slate-50 px-6 py-5">
            <h4 className="font-semibold">Recover sales with your abandoned checkout message</h4>
            <p className="mt-1 text-sm text-slate-500">A WhatsApp and email message is ready for you. Review it and make any changes.</p>
            <button className={`${ghost} mt-3`} onClick={() => setEditMsg(true)}>Review message</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-end"><button className={small} onClick={() => setEditMsg(true)}>Edit recovery message</button></div>
          <div className={`${card} divide-y divide-slate-100`}>
            {mine.map((c) => (
              <button key={c.id} onClick={() => setOpen(c)} className="block w-full px-4 py-3 text-left hover:bg-slate-50">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{c.name || c.phone || c.email}</span>
                  {c.count > 0 && <Pill tone="bg-blue-100 text-blue-800">Reminded {c.count}×</Pill>}
                  {c.status === 'blocked' && <Pill tone="bg-slate-200 text-slate-600">Blocked</Pill>}
                  <span className="ml-auto font-semibold">{naira(c.subtotal)}</span>
                </div>
                <p className="truncate text-xs text-slate-500">{ago(c.last)} · {c.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {open && (
        <Modal title="Abandoned checkout" onClose={() => setOpen(null)} wide>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold">{open.name || 'Customer'}</p>
              {open.phone && <a href={`tel:${open.phone}`} className="block text-blue-600">{open.phone}</a>}
              {open.email && <p className="text-slate-600">{open.email}</p>}
              <p className="mt-1 text-xs text-slate-500">Last active {ago(open.last)}{open.sent_at ? ` · last reminded ${ago(open.sent_at)}` : ''}</p>
            </div>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
              {open.items.map((i, k) => <div key={k} className="flex justify-between py-2"><span>{i.quantity} × {i.name}{i.variant_title ? ` (${i.variant_title})` : ''}</span><span>{naira(i.price * i.quantity)}</span></div>)}
              <div className="flex justify-between py-2 font-bold"><span>Total</span><span>{naira(open.subtotal)}</span></div>
            </div>
            {open.status === 'incomplete' && (
              <>
                <textarea readOnly className={`${field} min-h-[150px] text-xs`} value={text(open)} />
                <div className="flex flex-wrap gap-2">
                  {open.phone && <a className={btn} target="_blank" rel="noopener noreferrer" onClick={() => contacted(open)} href={waLink(open.phone, text(open))}>Remind on WhatsApp</a>}
                  {open.email && <a className={ghost} onClick={() => contacted(open)} href={mailLink(open.email, msg.subject, text(open))}>Remind by email</a>}
                  <button className={ghost} disabled={busy} onClick={() => toDraft(open)}>Create draft order</button>
                </div>
              </>
            )}
            {open.status === 'recovered' && <p className="rounded-xl bg-green-50 px-3 py-2 text-green-900">This customer went on to place an order. 🎉</p>}
            {open.status === 'blocked' && <p className="rounded-xl bg-slate-100 px-3 py-2">{open.blocked_reason || 'Blocked'}</p>}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {open.status === 'blocked' ? <button className={small} disabled={busy} onClick={async () => { await unblock(open); setOpen(null); }}>Unblock</button> : <button className={small} onClick={() => setBlockFor(open)}>Block this customer</button>}
              <button className={`${small} text-red-600`} onClick={() => remove(open)}>Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {blockFor && (
        <Modal title="Block this customer?" onClose={() => setBlockFor(null)}>
          <p className="text-sm text-slate-600">Blocked contacts move to the Blocked list and are never shown as lost sales. Useful for spam and test orders. They can still shop.</p>
          <div className="mt-4 grid gap-2">
            {blockFor.phone && <button className={btn} disabled={busy} onClick={() => block(blockFor, 'phone')}>Block {blockFor.phone}</button>}
            {blockFor.email && <button className={ghost} disabled={busy} onClick={() => block(blockFor, 'email')}>Block {blockFor.email}</button>}
          </div>
        </Modal>
      )}
      {editMsg && <MsgModal msg={msg} onClose={() => setEditMsg(false)} onSave={saveMsg} />}
    </div>
  );
}

function MsgModal({ msg, onClose, onSave }: { msg: Msg; onClose: () => void; onSave: (m: Msg) => void }) {
  const [m, setM] = useState(msg);
  return (
    <Modal title="Recovery message" onClose={onClose} wide footer={<><button className={`${ghost} mr-auto`} onClick={() => setM(DEF)}>Reset</button><button className={ghost} onClick={onClose}>Cancel</button><button className={btn} disabled={!m.body.trim()} onClick={() => onSave(m)}>Save</button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-500">Used for WhatsApp and email reminders. Words in curly brackets are filled in for each customer: <code>{'{name}'}</code> <code>{'{store}'}</code> <code>{'{items}'}</code> <code>{'{total}'}</code> <code>{'{link}'}</code></p>
        <input className={field} value={m.subject} maxLength={150} onChange={(e) => setM({ ...m, subject: e.target.value })} placeholder="Email subject" />
        <textarea className={`${field} min-h-[220px]`} value={m.body} maxLength={2000} onChange={(e) => setM({ ...m, body: e.target.value })} />
      </div>
    </Modal>
  );
}
