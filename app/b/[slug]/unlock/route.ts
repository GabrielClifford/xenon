import { NextResponse, type NextRequest } from 'next/server';
import { anon, cookieName } from '@/lib/store/access';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const form = await req.formData();
  const password = String(form.get('password') ?? '');
  const client = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const back = new URL(`/b/${slug}`, req.url);
  const { data, error } = await anon().rpc('xenon_store_check_password', { p_slug: slug, p_password: password, p_client: client });
  if (error || !data) {
    back.searchParams.set('wrong', error ? 'limit' : '1');
    return NextResponse.redirect(back, 303);
  }
  const res = NextResponse.redirect(back, 303);
  res.cookies.set(cookieName(slug), String(data), { httpOnly: true, sameSite: 'lax', secure: true, path: `/b/${slug}`, maxAge: 60 * 60 * 24 * 14 });
  return res;
}
