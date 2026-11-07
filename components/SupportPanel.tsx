'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Mail, MessageCircle } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/Skeleton';

// Fill these in so the contact buttons appear. Leave empty to hide a button.
const SUPPORT_WHATSAPP = '2348054309585';
const SUPPORT_EMAIL = 'karocliff73@gmail.com';

type Msg = { id: string; subject: string; message: string; status: string; reply: string | null; created_at: string };

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';

const faqs: { q: string; a: string }[] = [
  {
    q: 'How do I publish my website?',
    a: 'Open My website, fill in your business details and photos, then tick the option to publish and save. Your link appears on the Dashboard and under Marketing.',
  },
  {
    q: 'How do I add products?',
    a: 'Go to Products and press Add product. Add a photo, name, price and category. If you fill in Stock, the number goes down with every order and the product shows "Sold out" at zero. Leave Stock empty if you do not want to count it.',
  },
  {
    q: 'How can I hide a product without deleting it?',
    a: 'Edit the product and untick "Show this product on my website". You can tick it again any time.',
  },
  {
    q: 'How do my customers pay?',
    a: 'At checkout they choose Pay on delivery, or Bank transfer if you have added your account details at the bottom of the Orders page. Payments go directly between you and your customer. Xenon does not handle the money, and card payments are not available yet.',
  },
  {
    q: 'Where do I see my orders?',
    a: 'Open Orders. New orders show a number beside Orders in the menu and on the bell. Use the status menu on each order to mark it as preparing, delivered or cancelled.',
  },
  {
    q: 'How do discount codes work?',
    a: 'Open Discounts and create a code. Choose a percentage or a fixed amount, and optionally a minimum order, a maximum number of uses and an expiry date. Customers type the code in their cart before they check out.',
  },
  {
    q: 'How do I change how my website looks?',
    a: 'Open Templates and press "Use this template" on the one you like. Your content stays the same and the change shows on your live site straight away.',
  },
  {
    q: 'How do I see who is visiting my website?',
    a: 'The Dashboard and Analytics pages show visits, orders and revenue. To see which platform brings visitors, share the tracked links under Sales channels instead of the plain link.',
  },
];

export default function SupportPanel({ user }: { user: User }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [bizId, setBizId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function loadMsgs() {
    const { data } = await createClient()
      .from('support_messages')
      .select('id,subject,message,status,reply,created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    setMsgs((data as Msg[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: b } = await createClient().from('businesses').select('id').eq('owner_id', user.id).maybeSingle();
      setBizId(b?.id ?? null);
      await loadMsgs();
    })();
  }, [user.id]);

  async function send() {
    if (!subject.trim()) return setError('Add a short subject.');
    if (message.trim().length < 5) return setError('Please describe your problem or question.');
    setSending(true);
    setError('');
    setSent(false);
    const { error: err } = await createClient()
      .from('support_messages')
      .insert({ business_id: bizId, subject: subject.trim(), message: message.trim() });
    setSending(false);
    if (err) return setError('We could not send your message. Please try again.');
    setSubject('');
    setMessage('');
    setSent(true);
    await loadMsgs();
  }

  const wa = SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hello Xenon support, I need help with my website.')}`
    : '';
  const mail = SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Xenon support')}` : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Support</h1>
        <p className="text-sm text-slate-500">Find quick answers, or send us a message and we will get back to you.</p>
      </div>

      {(wa || mail) && (
        <div className={`${card} flex flex-wrap items-center gap-3 p-5`}>
          <p className="flex-1 text-sm font-medium text-slate-900">Need help right now? Talk to us directly.</p>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp us
            </a>
          )}
          {mail && (
            <a
              href={mail}
              className="flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Mail className="h-4 w-4" /> Email us
            </a>
          )}
        </div>
      )}

      <div className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold text-slate-900">Common questions</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {faqs.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm font-medium text-slate-900">
                <span className="flex-1">{f.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <p className="pb-3 pr-7 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold text-slate-900">Send us a message</h2>
        <div className="mt-4 space-y-3">
          <input
            className={field}
            placeholder="Subject"
            maxLength={120}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className={field}
            rows={5}
            placeholder="Tell us what is happening or what you need help with..."
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {sent && <p className="text-sm text-green-700">Message sent. We will reply here as soon as we can.</p>}
          <button
            onClick={send}
            disabled={sending}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send message'}
          </button>
        </div>
      </div>

      <div className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold text-slate-900">Your messages</h2>
        {msgs === null ? (
          <Skeleton className="mt-3 h-16 w-full" />
        ) : msgs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Messages you send will show here, together with our replies.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {msgs.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{m.subject}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      m.status === 'answered' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {m.status === 'answered' ? 'Answered' : m.status === 'closed' ? 'Closed' : 'Waiting for reply'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(m.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-600">{m.message}</p>
                {m.reply && (
                  <div className="mt-3 rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-semibold text-blue-800">Xenon support</p>
                    <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-700">{m.reply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}