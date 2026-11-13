'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { requestKinds } from '@/lib/privacy';

const field = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500';

export default function PrivacyRequestForm({ businessId }: { businessId: string }) {
  const [f, setF] = useState({ name: '', contact: '', kind: 'access', details: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  async function send() {
    setMsg(null);
    if (!f.name.trim() || !f.contact.trim()) return setMsg({ t: 'Please enter your name and a phone number or email.', ok: false });
    setBusy(true);
    const { error } = await createClient().rpc('submit_privacy_request', {
      p_business_id: businessId,
      p_name: f.name,
      p_contact: f.contact,
      p_kind: f.kind,
      p_details: f.details,
    });
    setBusy(false);
    if (error) return setMsg({ t: error.message, ok: false });
    setF({ name: '', contact: '', kind: 'access', details: '' });
    setMsg({ t: 'Your request was sent. The store will contact you.', ok: true });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">What would you like to do?</label>
        <select className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {requestKinds.map((k) => (
            <option key={k.v} value={k.v}>{k.t}</option>
          ))}
        </select>
      </div>
      <input className={field} placeholder="Your name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className={field} placeholder="Phone number or email *" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
      <textarea
        className={field}
        rows={4}
        maxLength={1000}
        placeholder="Anything else we should know (optional)"
        value={f.details}
        onChange={(e) => setF({ ...f, details: e.target.value })}
      />
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.t}</p>}
      <button
        onClick={send}
        disabled={busy}
        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? 'Sending...' : 'Send request'}
      </button>
    </div>
  );
}