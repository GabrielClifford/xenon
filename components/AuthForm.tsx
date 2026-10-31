'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { businessCategories } from '@/data/providers';

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600';

// Every new account is a business owner. The stored value stays 'artisan'
// so existing accounts and the dashboard (isArtisan) keep working.
const role = 'artisan';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup';
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const supabase = createClient();

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: String(form.get('name') ?? '').trim(),
            phone: String(form.get('phone') ?? '').trim(),
            role,
            trade: String(form.get('trade') ?? ''),
          },
        },
      });
      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }
      // Supabase returns an empty identities list when the email is already registered
      if (data.user && data.user.identities?.length === 0) {
        setError('An account with this email already exists. Try logging in.');
        return;
      }
      if (data.session) {
        router.push('/dashboard');
        router.refresh();
        return;
      }
      setCheckEmail(true);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="font-display text-2xl font-bold text-slate-900">Check your email</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          We sent a confirmation link to your email address. Click it to finish creating your account.
          If you don&apos;t see it, check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="font-display text-2xl font-bold text-slate-900">
        {isSignup ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {isSignup ? 'Create your Xenon account and launch your business website in minutes.' : 'Log in to your Xenon account.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        {isSignup && <input required name="name" placeholder="Full name" className={field} />}
        <input required type="email" name="email" placeholder="Email address" className={field} />
        {isSignup && <input required name="phone" placeholder="Phone number" className={field} />}
        {isSignup && (
          <select required name="trade" defaultValue="" className={field}>
            <option value="" disabled>What type of business do you run?</option>
            {businessCategories.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <input
          required
          type="password"
          name="password"
          minLength={8}
          placeholder="Password (at least 8 characters)"
          className={field}
        />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {isSignup ? 'Already have an account? ' : "Don't have an account? "}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-semibold text-blue-600 hover:underline"
        >
          {isSignup ? 'Log in' : 'Sign up'}
        </Link>
      </p>
    </div>
  );
}
