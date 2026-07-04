import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncAudienceList } from '@/lib/customer-match';

// POST /api/fake-leads/sync — push fake leads to Google Ads exclusion list
export async function POST() {
  const settings = await prisma.dashboard_settings.findUnique({ where: { key: 'fake_exclusion' } });
  const cfg = settings?.value as any;
  if (!cfg?.enabled || !cfg?.listId) {
    return NextResponse.json({ error: 'fake_exclusion not configured' }, { status: 400 });
  }

  const fakes = await prisma.leads.findMany({
    where: {
      status: 'fake',
      fake_synced_to_google: false,
      OR: [{ phone_hash: { not: null } }, { email_hash: { not: null } }],
    },
    select: {
      id: true, phone_hash: true, email_hash: true,
      ad_click: { select: { ip_address: true, created_at: true } },
    },
    take: 500,
  });

  if (!fakes.length) return NextResponse.json({ synced: 0, message: 'Nothing to sync' });

  const members = fakes.map(f => ({
    hashedPhoneNumber: f.phone_hash || undefined,
    hashedEmailAddress: f.email_hash || undefined,
    ipData: f.ad_click?.ip_address ? [{
      ipAddress: f.ad_click.ip_address,
      observeStartTime: f.ad_click.created_at.toISOString(),
    }] : undefined,
  }));

  const result = await syncAudienceList(members, cfg.listId);

  if (result.uploaded > 0) {
    await prisma.leads.updateMany({
      where: { id: { in: fakes.map(f => f.id) } },
      data: { fake_synced_to_google: true },
    });
  }

  return NextResponse.json({ synced: result.uploaded, total: fakes.length, errors: result.errors });
}
