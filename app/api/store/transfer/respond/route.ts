// POST /api/store/transfer/respond
// Used by the page the new owner opens from the email: look at a request, accept it or decline it.
import { admin } from '@/lib/notifications/server';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { transferId?: string; action?: string } | null;
  const id = body?.transferId ?? '';
  const action = body?.action ?? 'info';
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['info', 'accept', 'decline'].includes(action)) return fail('Bad request');

  let db;
  try {
    db = admin();
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'The server is not set up.', 500);
  }

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user || !user.email) return fail('Please sign in to continue.', 401);

  const { data: t } = await db.from('store_transfers').select('id,business_id,from_user,from_email,to_email,status,expires_at').eq('id', id).maybeSingle();
  // Same answer whether the request is missing or meant for someone else, so ids cannot be probed.
  if (!t || t.to_email.toLowerCase() !== user.email.toLowerCase()) return fail('This transfer request was not found for your account.', 404);

  const { data: biz } = await db.from('businesses').select('id,name,owner_id').eq('id', t.business_id).maybeSingle();
  const expired = new Date(t.expires_at).getTime() < Date.now();
  const open = t.status === 'pending' && !expired && !!biz && biz.owner_id === t.from_user;

  if (action === 'info') {
    return Response.json({ ok: true, storeName: biz?.name ?? 'this store', fromEmail: t.from_email, status: expired && t.status === 'pending' ? 'expired' : t.status, open });
  }
  if (!open) return fail(expired ? 'This request has expired.' : 'This request is no longer open.', 409);

  if (action === 'decline') {
    await db.from('store_transfers').update({ status: 'declined' }).eq('id', t.id).eq('status', 'pending');
    await db.from('store_activity').insert({ business_id: t.business_id, actor_email: user.email.slice(0, 254), action: 'Declined store transfer', detail: '' });
    return Response.json({ ok: true });
  }

  // accept: the new owner cannot already run a store of their own
  const { data: own } = await db.from('businesses').select('id').eq('owner_id', user.id).limit(1);
  if (own && own.length > 0) return fail('Your account already has its own store. A Xenon account can only run one store, so use a different email for the new owner.', 409);

  // Claim the request first so two clicks cannot both succeed.
  const { data: claimed } = await db.from('store_transfers').update({ status: 'accepted' }).eq('id', t.id).eq('status', 'pending').select('id');
  if (!claimed || claimed.length === 0) return fail('This request is no longer open.', 409);

  const { data: moved, error } = await db.from('businesses').update({ owner_id: user.id }).eq('id', t.business_id).eq('owner_id', t.from_user).select('id');
  if (error || !moved || moved.length === 0) {
    await db.from('store_transfers').update({ status: 'pending' }).eq('id', t.id);
    return fail(error?.message ?? 'Could not move the store. Nothing was changed.', 500);
  }

  await db.from('store_activity').insert({ business_id: t.business_id, actor_email: user.email.slice(0, 254), action: 'Store transferred', detail: `From ${t.from_email} to ${user.email}` });
  return Response.json({ ok: true });
}
