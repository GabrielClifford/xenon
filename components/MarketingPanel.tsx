'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Check, ChevronRight, Copy, Download, Mail, MessageCircle, QrCode, Send, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';
import type { Tab } from '@/components/DashboardOverview';

type Biz = {
  name: string;
  slug: string;
  published: boolean;
  trade: string | null;
  area: string | null;
  city: string | null;
};

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const hashtag = (s: string | null) => {
  const t = (s ?? '').replace(/[^a-zA-Z0-9]/g, '');
  return t ? `#${t}` : '';
};

export default function MarketingPanel({
  user,
  onNavigate,
}: {
  user: User;
  onNavigate?: (tab: Tab) => void;
}) {
  const [biz, setBiz] = useState<Biz | null | undefined>(undefined);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const link = biz ? `${origin}/b/${biz.slug}` : '';

  useEffect(() => {
    (async () => {
      const { data } = await createClient()
        .from('businesses')
        .select('name,slug,published,trade,area,city')
        .eq('owner_id', user.id)
        .maybeSingle();
      setBiz((data as Biz | null) ?? null);
    })();
  }, [user.id]);

  useEffect(() => {
    if (!link) return;
    let off = false;
    QRCode.toDataURL(link, { width: 800, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } }).then((url) => {
      if (!off) setQr(url);
    });
    return () => {
      off = true;
    };
  }, [link]);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  if (biz === undefined) return <PageSkeleton />;
  if (biz === null) {
    return (
      <div className={`${card} p-6 text-sm text-slate-600`}>
        Create your website first (My website), then you can promote it from here.
      </div>
    );
  }

  const tags = [hashtag(biz.trade), hashtag(biz.city || biz.area)].filter(Boolean).join(' ');
  const captions = [
    {
      key: 'status',
      title: 'WhatsApp status',
      text: `🎉 ${biz.name} is now online!\n\nSee what we offer and send us an enquiry from your phone:\n${link}`,
    },
    {
      key: 'post',
      title: 'Instagram or Facebook post',
      text: `We're officially online! 🙌\n\nVisit the ${biz.name} website to see what we do, ask questions and get in touch anytime.\n\n👉 ${link}${tags ? `\n\n${tags}` : ''}`,
    },
    {
      key: 'dm',
      title: 'Message to customers',
      text: `Hello! 👋 You can now see everything about ${biz.name} on our website and contact us from your phone: ${link}`,
    },
    {
      key: 'refer',
      title: 'Ask happy customers to share',
      text: `Thank you for choosing ${biz.name}! 🙏 If you know someone who needs our service, please share our website with them: ${link}`,
    },
  ];

  const shareText = `${biz.name} is now online! ${link}`;
  const shares = [
    { label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(shareText)}` },
    { label: 'Facebook', icon: Share2, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
    { label: 'X', icon: Share2, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${biz.name} is now online!`)}&url=${encodeURIComponent(link)}` },
    { label: 'Telegram', icon: Send, href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`${biz.name} is now online!`)}` },
    { label: 'Email', icon: Mail, href: `mailto:?subject=${encodeURIComponent(`${biz.name} is now online`)}&body=${encodeURIComponent(shareText)}` },
  ];

  const ideas: { title: string; text: string; tab: Tab }[] = [
    { title: 'Get tracked links', text: 'Separate links for WhatsApp, Instagram and more, so you can see which one brings visits.', tab: 'channels' },
    { title: 'Launch a discount code', text: 'Give new customers a reason to order today.', tab: 'discounts' },
    { title: 'Add more photos', text: 'Clear photos of your best work make people trust you.', tab: 'website' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Marketing</h1>
        <p className="text-sm text-slate-500">Tools to help more people find and visit your website.</p>
      </div>

      {!biz.published && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your website is not published yet, so this link won&apos;t open for other people.{' '}
          <button onClick={() => onNavigate?.('website')} className="font-semibold underline">
            Publish it first
          </button>
        </p>
      )}

      <div className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold text-slate-900">Your website link</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm"
          />
          <button
            onClick={() => copy('link', link)}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === 'link' ? 'Copied!' : 'Copy link'}
          </button>
        </div>
        <p className="mt-4 text-sm font-medium text-slate-700">Share it on</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {shares.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <s.icon className="h-4 w-4" /> {s.label}
            </a>
          ))}
        </div>
      </div>

      <div className={`${card} flex flex-col gap-5 p-5 sm:flex-row sm:items-center`}>
        <div className="mx-auto h-44 w-44 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white sm:mx-0">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${biz.name}`} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <QrCode className="h-12 w-12" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-slate-900">Your QR code</h2>
          <p className="mt-1 text-sm text-slate-600">
            Anyone who scans it with their phone camera opens your website. Print it on flyers, receipts, packaging, your
            shop door or your car.
          </p>
          {qr && (
            <a
              href={qr}
              download={`${biz.slug}-qr.png`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" /> Download QR code
            </a>
          )}
        </div>
      </div>

      <div className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold text-slate-900">Ready-made captions</h2>
        <p className="mt-1 text-sm text-slate-500">Copy one, paste it, and post. Your name and link are already filled in.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {captions.map((c) => (
            <div key={c.key} className="flex flex-col rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">{c.title}</p>
              <p className="mt-2 flex-1 whitespace-pre-line break-words text-sm text-slate-600">{c.text}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => copy(c.key, c.text)}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copied === c.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === c.key ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(c.text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${card} p-5`}>
        <h2 className="font-display text-lg font-semibold text-slate-900">More ways to grow</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {ideas.map((i) => (
            <button
              key={i.title}
              onClick={() => onNavigate?.(i.tab)}
              className="flex w-full items-center gap-4 py-4 text-left hover:bg-slate-50"
            >
              <span className="flex-1">
                <span className="block text-sm font-medium text-slate-900">{i.title}</span>
                <span className="block text-xs text-slate-500">{i.text}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}