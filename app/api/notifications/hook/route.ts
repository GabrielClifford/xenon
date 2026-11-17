import { after } from 'next/server';
import { admin, BIZ_COLUMNS, dispatchOrder, eventFromStatus, readOrder, safeEqual, type Biz } from '@/lib/notifications/server';

// Called by the database trigger in notifications.sql whenever an order is
// placed or its status changes.
export async function POST(req: Request) {
  const secret = process.env.NOTIFY_HOOK_SECRET;
  const got = req.headers.get('x-hook-secret') ?? '';
  if (!secret || !safeEqual(got, secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { event?: string; order_id?: string } | null;
  if (!body?.order_id || (body.event !== 'order_placed' && body.event !== 'order_status_changed')) {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  const placed = body.event === 'order_placed';
  const orderId = body.order_id;

  // Answer straight away and do the sending afterwards.
  after(async () => {
    try {
      // On a new order, give the checkout a moment to finish saving the items.
      if (placed) await new Promise((r) => setTimeout(r, 2500));
      const db = admin();
      const { data: row } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (!row) return;
      const { data: biz } = await db.from('businesses').select(BIZ_COLUMNS).eq('id', (row as Record<string, unknown>).business_id as string).maybeSingle();
      if (!biz) return;
      const order = readOrder(row as Record<string, unknown>);
      const event = placed ? 'order_placed' : eventFromStatus(order.status);
      await dispatchOrder(db, biz as Biz, order, event, !placed);
    } catch (e) {
      console.error('notification hook failed', e);
    }
  });

  return Response.json({ ok: true });
}
