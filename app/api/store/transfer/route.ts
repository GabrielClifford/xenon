// POST /api/store/transfer
// The owner asks to hand their store to a new owner. The new owner gets an email
// with a link and must accept it. Nothing changes until they do.
import { admin, BIZ_COLUMNS, loadSettings, sendEmail, senderFor, siteUrl, type Biz } from '@/lib/notifications/server';
import { esc } from '@/lib/notifications/templates';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { businessId?: string; email?: string; confirmName?: string } | null;
  const email = (body?.email ?? '').trim().toLowerCase();
  if (!body?.businessId || !EMAIL.test(email) || email.length > 254) return fail('Enter a valid email address for the new owner.');

  let db;
  try {
    db = admin();
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'The server is not set up.', 500);
  }

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return fail('Please sign in again.', 401);

  const { data: row } = await db.from('businesses').select(BIZ_COLUMNS).eq('id', body.businessId).eq('owner_id', user.id).maybeSingle();
  if (!row) return fail('You can only transfer a store you own.', 403);
  const biz = row as Biz;

  if ((body.confirmName ?? '').trim().toLowerCase() !== biz.name.trim().toLowerCase()) return fail('Type your store name exactly to confirm.');
  if (email === (user.email ?? '').toLowerCase()) return fail('Choose someone other than yourself.');

  // An old request that ran out must not block a new one.
  await db.from('store_transfers').update({ status: 'cancelled' }).eq('business_id', biz.id).eq('status', 'pending').lt('expires_at', new Date().toISOString());

  const { data: made, error } = await db
    .from('store_transfers')
    .insert({ business_id: biz.id, from_user: user.id, from_email: user.email ?? '', to_email: email })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return fail('A transfer is already waiting to be accepted. Cancel it first.', 409);
    return fail(error.message, 500);
  }

  const link = `${siteUrl()}/transfer/${made.id}`;

  // Email the new owner. If sending is not set up, the owner can share the link themselves.
  let emailSent = false;
  try {
    const sender = await senderFor(db, biz, await loadSettings(db, biz.id));
    if (sender) {
      const who = esc(user.email ?? 'The owner');
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
<h2 style="margin:0 0 12px">You were asked to take over ${esc(biz.name)}</h2>
<p style="line-height:1.6">${who} wants to transfer the store <b>${esc(biz.name)}</b> to you on Xenon. You will get full control of its orders, customers and settings.</p>
<p style="margin:20px 0"><a href="${esc(link)}" style="background:#2563eb;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;display:inline-block">Review transfer</a></p>
<p style="font-size:13px;color:#475569;line-height:1.6">Sign in with <b>${esc(email)}</b> to accept. The request expires in 7 days. If you were not expecting this, ignore this email and nothing will change.</p></div>`;
      const text = `${user.email ?? 'The owner'} wants to transfer the store "${biz.name}" to you on Xenon.\nReview it here (sign in with ${email}): ${link}\nThe request expires in 7 days. If you were not expecting this, ignore this email.`;
      const r = await sendEmail({ from: sender.from, to: [email], subject: `${biz.name}: store transfer request`, html, text, replyTo: user.email ?? undefined });
      emailSent = r.ok;
    }
  } catch {
    emailSent = false;
  }

  await db.from('store_activity').insert({ business_id: biz.id, actor_email: (user.email ?? '').slice(0, 254), action: 'Started store transfer', detail: `To ${email}` });

  return Response.json({ ok: true, link, emailSent });
}
