'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { Check, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';

type ThemeId = 'classic' | 'bold' | 'spark';

// Edit these lines so they describe how each template really looks.
const templates: { id: ThemeId; name: string; text: string; sample: string }[] = [
  { id: 'classic', name: 'Classic', text: 'Clean and professional.', sample: '/s/steady-flow-plumbing' },
  { id: 'bold', name: 'Bold', text: 'Strong and eye-catching.', sample: '/s/rivers-power-works' },
  { id: 'spark', name: 'Spark', text: 'Bright and modern.', sample: '/s/bright-spark-electricals' },
];

export default function TemplatesPanel({ user, onChanged }: { user: User; onChanged?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [biz, setBiz] = useState<{ id: string; slug: string; published: boolean } | null>(null);
  const [current, setCurrent] = useState<ThemeId>('classic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ThemeId | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('businesses')
        .select('id, slug, published, theme')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (data) {
        setBiz({ id: data.id, slug: data.slug, published: data.published });
        setCurrent(['classic', 'bold', 'spark'].includes(data.theme) ? data.theme : 'classic');
      }
      setLoading(false);
    })();
  }, [supabase, user.id]);

  async function apply(id: ThemeId) {
    if (!biz || id === current) return;
    setSaving(id);
    setMsg('');
    const { error } = await supabase.from('businesses').update({ theme: id }).eq('id', biz.id);
    setSaving(null);
    if (error) return setMsg(error.message);
    setCurrent(id);
    setMsg(`Done. Your website now uses the ${templates.find((t) => t.id === id)?.name} template.`);
    onChanged?.();
  }

  if (loading) return <PageSkeleton />;
  if (!biz) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Create your website first (My website), then you can choose a template.
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Templates</h1>
      <p className="mt-1 text-sm text-slate-500">
        Pick how your website looks. Your content stays the same, and the change shows on your live site straight away.
      </p>

      {msg && (
        <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {msg}{' '}
          {biz.published && !msg.startsWith('Done') ? null : biz.published ? (
            <Link href={`/b/${biz.slug}`} className="font-semibold underline">
              View website
            </Link>
          ) : null}
        </p>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => {
          const active = t.id === current;
          return (
            <div
              key={t.id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                active ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200'
              }`}
            >
              <div className="relative flex aspect-video items-center justify-center bg-slate-100 text-lg font-bold text-slate-400">
                {t.name}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/templates/${t.id}.png`}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                {active && (
                  <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    <Check className="h-3.5 w-3.5" /> In use
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="text-sm text-slate-500">{t.text}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => apply(t.id)}
                    disabled={active || saving !== null}
                    className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {saving === t.id ? 'Applying...' : active ? 'Current template' : 'Use this template'}
                  </button>
                  <Link
                    href={t.sample}
                    target="_blank"
                    className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Preview <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}