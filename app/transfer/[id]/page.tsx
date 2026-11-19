'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Info = { storeName: string; fromEmail: string; status: string; open: boolean };

const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const ghost = 'rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

async function call(id: string, action: 'info' | 'accept' | 'decline') {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, json: { error: 'Please sign in to continue.' } as Record<string, unknown> };
  const res = await fetch('/api/store/transfer/respond', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ transferId: id, action }),
  });
  return { status: res.status, json: ((await res.json().catch(() => ({}))) as Record<string, unknown>) ?? {} };
}

// Page at /transfer/[id]: the new owner opens it from the email.
// useParams() has to sit inside a Suspense boundary, so the page wraps this component.
function TransferInner() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';
  const [info, setInfo] = useState<Info | null>(null);
  const [state, setState] = useState<'loading' | 'signin' | 'ready' | 'done' | 'declined' | 'error'>('loading');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    call(id, 'info').then((r) => {
      if (!live) return;
      if (r.status === 401) return setState('signin');
      if (r.status !== 200) {
        setMsg(String(r.json.error ?? 'Something went wrong.'));
        return setState('error');
      }
      setInfo(r.json as unknown as Info);
      setState('ready');
    });
    return () => {
      live = false;
    };
  }, [id]);

  async function respond(action: 'accept' | 'decline') {
    setBusy(true);
    setMsg('');
    const r = await call(id, action);
    setBusy(false);
    if (r.status === 200) return setState(action === 'accept' ? 'done' : 'declined');
    setMsg(String(r.json.error ?? 'Something went wrong.'));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {state === 'loading' && <div className="h-32 animate-pulse rounded-xl bg-slate-100" />}

        {state === 'signin' && (
          <>
            <h1 className="text-xl font-bold text-slate-900">Sign in to continue</h1>
            <p className="mt-2 text-sm text-slate-600">Sign in to Xenon with the email address this request was sent to, then open the link from your email again.</p>
            <a href="/" className={`${primary} mt-5 inline-block`}>
              Go to Xenon
            </a>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 className="text-xl font-bold text-slate-900">Transfer request</h1>
            <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{msg}</p>
            <a href="/" className={`${ghost} mt-5 inline-block`}>
              Go to Xenon
            </a>
          </>
        )}

        {state === 'ready' && info && (
          <>
            <h1 className="text-xl font-bold text-slate-900">Take over {info.storeName}?</h1>
            <p className="mt-2 text-sm text-slate-600">
              <b>{info.fromEmail}</b> wants to transfer this store to you. You will get full control of its orders, customers and settings, and they will lose access.
            </p>
            {!info.open && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This request is {info.status === 'pending' ? 'no longer open' : info.status}.</p>}
            {msg && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{msg}</p>}
            {info.open && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button className={primary} disabled={busy} onClick={() => respond('accept')}>
                  {busy ? 'Working...' : 'Accept transfer'}
                </button>
                <button className={ghost} disabled={busy} onClick={() => respond('decline')}>
                  Decline
                </button>
              </div>
            )}
          </>
        )}

        {state === 'done' && (
          <>
            <h1 className="text-xl font-bold text-slate-900">The store is yours</h1>
            <p className="mt-2 text-sm text-slate-600">The transfer is complete. Open your dashboard to manage the store.</p>
            <a href="/dashboard" className={`${primary} mt-5 inline-block`}>
              Open dashboard
            </a>
          </>
        )}

        {state === 'declined' && (
          <>
            <h1 className="text-xl font-bold text-slate-900">Request declined</h1>
            <p className="mt-2 text-sm text-slate-600">Nothing was changed. The owner can send a new request if they need to.</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function TransferPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
          <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-100" />
        </main>
      }
    >
      <TransferInner />
    </Suspense>
  );
}
