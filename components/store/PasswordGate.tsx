import { Lock } from 'lucide-react';

export default function PasswordGate({ slug, name, wrong }: { slug: string; name: string; wrong?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5 text-center">
      <Lock className="h-8 w-8 text-slate-400" />
      <h1 className="mt-3 text-xl font-bold text-slate-900">{name}</h1>
      <p className="mt-1 text-sm text-slate-600">This store is private. Enter the password the owner gave you.</p>
      <form action={`/b/${slug}/unlock`} method="post" className="mt-5 w-full space-y-3">
        <input name="password" type="password" required autoFocus placeholder="Password" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" />
        {wrong && <p className="text-sm text-red-600">{wrong === 'limit' ? 'Too many wrong tries. Please wait a few minutes.' : 'That password is not right.'}</p>}
        <button className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700">Enter store</button>
      </form>
    </main>
  );
}
