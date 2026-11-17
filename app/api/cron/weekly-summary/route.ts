import { admin, BIZ_COLUMNS, loadSettings, logged, readOrder, sendEmail, senderFor, siteUrl, staffRecipients, type Biz } from '@/lib/notifications/server';
import { renderWeekly, staffOn } from '@/lib/notifications/templates';

// Runs every Monday at 08:00 UTC (9:00 AM in Lagos). See vercel.json.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = admin();
  const { data: rows } = await db.from('notification_settings').select('business_id').eq('staff->>weekly_summary', 'true');
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
  let sent = 0;

  for (const r of rows ?? []) {
    try {
      const { data: biz } = await db.from('businesses').select(BIZ_COLUMNS).eq('id', r.business_id).maybeSingle();
      if (!biz) continue;
      const settings = await loadSettings(db, r.business_id);
      if (!staffOn(settings.staff, 'weekly_summary')) continue;
      const sender = await senderFor(db, biz as Biz, settings);
      const to = await staffRecipients(db, biz as Biz);
      if (!sender || !to.length) continue;

      const { data: orders } = await db.from('orders').select('*').eq('business_id', r.business_id).gte('created_at', since.toISOString());
      const list = (orders ?? []).map((o) => readOrder(o as Record<string, unknown>)).filter((o) => !['cancelled', 'canceled', 'void'].includes(o.status));
      const tally = new Map<string, number>();
      for (const o of list) for (const i of o.items) tally.set(i.name, (tally.get(i.name) ?? 0) + i.qty);
      const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));

      const m = renderWeekly({
        store: (biz as Biz).name,
        from: fmt(since),
        to: fmt(new Date()),
        count: list.length,
        revenue: list.reduce((n, o) => n + o.total, 0),
        top,
        dashboardUrl: `${siteUrl()}/dashboard`,
      });
      const res = await logged(
        db,
        { business_id: r.business_id, event: 'weekly_summary', channel: 'email', target: to.join(', '), dedupe: `weekly:${r.business_id}:${new Date().toISOString().slice(0, 10)}` },
        () => sendEmail({ from: sender.from, to, subject: m.subject, html: m.html, text: m.text, replyTo: sender.replyTo })
      );
      if (res.ok && !res.skipped) sent++;
    } catch (e) {
      console.error('weekly summary failed for', r.business_id, e);
    }
  }
  return Response.json({ ok: true, sent });
}
