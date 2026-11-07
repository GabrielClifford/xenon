'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { channels, loadSources, sourceLabels, type ChannelId, type SourceCount } from '@/lib/channels';
import { PageSkeleton } from '@/components/Skeleton';

type Biz = { id: string; slug: string; published: boolean };

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';

export default function ChannelsPanel({
  user,
  channel,
  onSelect,
}: {
  user: User;
  channel: ChannelId;
  onSelect: (c: ChannelId) => void;
}) {
  const [biz, setBiz] = useState<Biz | null | undefined>(undefined);
  const [sources, setSources] = useState<SourceCount[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('businesses')
        .select('id,slug,published')
        .eq('owner_id', user.id)
        .maybeSingle();
      const b = (data as Biz | null) ?? null;
      setBiz(b);
      if (b) {
        try {
          setSources(await loadSources(supabase, b.id));
        } catch {
          setSources([]);
        }
      }
    })();
  }, [user.id]);

  if (biz === undefined) return <PageSkeleton />;
  if (!biz) {
    return (
      <div className={`${card} p-6`}>
        <h1 className="font-display text-2xl font-bold text-slate-900">Sales channels</h1>
        <p className="mt-2 text-sm text-slate-600">Create your website first, then your channel links will appear here.</p>
      </div>
    );
  }

  const current = channels.find((c) => c.id === channel) ?? channels[0];
  const origin = window.location.origin;
  const link = `${origin}/b/${biz.slug}${current.id === 'website' ? '' : `?ref=${current.id}`}`;
  const total = sources.reduce((n, s) => n + s.visits, 0);
  const visits = current.id === 'website' ? total : sources.find((s) => s.source === current.id)?.visits ?? 0;
  const Icon = current.icon;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-slate-900">Sales channels</h1>
        <p className="mt-1 text-slate-500">Share a different link on each channel to see which one brings visitors.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {channels.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              c.id === current.id
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className={`${card} p-6`}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">{current.label}</h2>
            <p className="text-sm text-slate-500">
              {visits} visit{visits === 1 ? '' : 's'} in the last 7 days
              {current.id === 'website' ? ' (all channels)' : ''}
            </p>
          </div>
        </div>

        {!biz.published && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your website isn&apos;t published yet, so these links won&apos;t work. Publish it from My website first.
          </p>
        )}

        <p className="mt-5 text-sm font-medium text-slate-700">Your {current.label} link</p>
        <p className="mt-1 break-all rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">{link}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={copy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          {current.id === 'whatsapp' && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Check out my website: ${link}`)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Share on WhatsApp
            </a>
          )}
        </div>
        <p className="mt-4 text-sm text-slate-500">{current.tip}</p>
      </div>

      <div className={`${card} p-6`}>
        <h2 className="font-display text-lg font-semibold text-slate-900">All channels</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {sources.map((s) => (
            <div key={s.source} className="flex justify-between py-3 text-sm">
              <span className="text-slate-700">{sourceLabels[s.source]}</span>
              <span className="font-medium text-slate-900">{s.visits}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}