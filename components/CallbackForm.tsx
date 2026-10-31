'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600';

export default function CallbackForm({ name, businessId }: { name: string; businessId?: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const real = Boolean(businessId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);

    // Sample websites are demos, so nothing is saved
    if (!real) {
      setSent(true);
      return;
    }
    // Hidden field that only bots fill in
    if (String(form.get('website') ?? '')) {
      setSent(true);
      return;
    }

    const last = Number(localStorage.getItem('Xenon_enq') || 0);
    if (Date.now() - last < 60_000) {
      setError('Please wait a minute before sending another request.');
      return;
    }

    const text = (k: string) => String(form.get(k) ?? '').trim();
    setSending(true);
    const { error: err } = await createClient()
      .from('enquiries')
      .insert({
        business_id: businessId,
        name: text('name').slice(0, 80),
        phone: text('phone').slice(0, 30),
        message: text('message').slice(0, 1000) || null,
      });
    setSending(false);

    if (err) {
      setError('Sorry, we could not send your request. Please try again.');
      return;
    }
    localStorage.setItem('Xenon_enq', String(Date.now()));
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm">
        <p className="font-display text-lg font-semibold text-slate-900">Request received</p>
        <p className="mt-1 text-slate-600">
          {real ? `${name} will contact you on the number you gave.` : `${name} would get back to you shortly.`}
        </p>
        {!real && <p className="mt-3 text-xs text-slate-400">Demo form: nothing is actually sent.</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input required name="name" maxLength={80} placeholder="Your name" className={field} />
      <input required name="phone" type="tel" minLength={5} maxLength={30} placeholder="Phone number" className={field} />
      <textarea
        name="message"
        rows={3}
        maxLength={1000}
        defaultValue={`Hello, I'd like to book ${name}.`}
        className={field}
      />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px]" />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {sending ? 'Sending...' : 'Request a callback'}
      </button>
      {real && <p className="text-xs text-slate-400">Your name and phone number will be shared with {name}.</p>}
    </form>
  );
}