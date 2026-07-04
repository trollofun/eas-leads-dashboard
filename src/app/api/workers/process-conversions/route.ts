import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadGoogleAdsOfflineConversion } from '@/lib/google-conversions';
import { syncAudienceList } from '@/lib/customer-match';

// GET /api/workers/process-conversions — trigger queue processing
// Called by cron every 5 minutes or manually
export async function GET() {
  try {
    const jobs = await prisma.google_conversion_queue.findMany({
      where: {
        status: 'pending',
        attempts: { lt: 5 },
      },
      orderBy: { created_at: 'asc' },
      take: 25,
    });

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const lead = await prisma.leads.findUnique({
          where: { id: job.lead_id! },
          include: { ad_click: true },
        });

        if (!lead || lead.status === 'fake') {
          await prisma.google_conversion_queue.update({
            where: { id: job.id },
            data: { status: 'skipped', last_error: 'Lead is fake or deleted' },
          });
          failed++;
          continue;
        }

        if (!lead.consent_ad_user_data) {
          await prisma.google_conversion_queue.update({
            where: { id: job.id },
            data: { status: 'skipped', last_error: 'No ad_user_data consent' },
          });
          failed++;
          continue;
        }

        const payload = job.payload as any;

        const result = await uploadGoogleAdsOfflineConversion({
          conversionActionId: payload.conversionActionId,
          transactionId: job.transaction_id,
          eventTimestamp: new Date(payload.eventTimestamp),
          value: Number(payload.value),
          currency: payload.currency || 'RON',
          gclid: payload.gclid,
          gbraid: payload.gbraid,
          wbraid: payload.wbraid,
          emailHash: payload.emailHash,
          phoneHash: payload.phoneHash,
          validateOnly: payload.validateOnly,
        });

        await prisma.google_conversion_queue.update({
          where: { id: job.id },
          data: {
            status: 'sent',
            processed_at: new Date(),
            request_id: result.requestId,
          },
        });

        await prisma.leads.update({
          where: { id: lead.id },
          data: {
            google_conversion_status: 'sent',
            google_conversion_sent_at: new Date(),
          },
        });

        processed++;
      } catch (error: any) {
        const newAttempts = job.attempts + 1;
        await prisma.google_conversion_queue.update({
          where: { id: job.id },
          data: {
            attempts: newAttempts,
            last_error: error.message,
            status: newAttempts >= 5 ? 'failed' : 'pending',
          },
        });
        failed++;
      }
    }

    // Auto-sync fake leads to Google Ads exclusion list
    let fakesSynced = 0;
    try {
      const cfg = (await prisma.dashboard_settings.findUnique({ where: { key: 'fake_exclusion' } }))?.value as any;
      if (cfg?.enabled && cfg?.listId) {
        const fakes = await prisma.leads.findMany({
          where: {
            status: 'fake',
            fake_synced_to_google: false,
            OR: [{ phone_hash: { not: null } }, { email_hash: { not: null } }],
          },
          select: { id: true, phone_hash: true, email_hash: true },
          take: 500,
        });
        if (fakes.length) {
          const result = await syncAudienceList(
            fakes.map(f => ({ hashedPhoneNumber: f.phone_hash || undefined, hashedEmailAddress: f.email_hash || undefined })),
            cfg.listId
          );
          if (result.uploaded > 0) {
            await prisma.leads.updateMany({
              where: { id: { in: fakes.map(f => f.id) } },
              data: { fake_synced_to_google: true },
            });
            fakesSynced = result.uploaded;
          }
        }
      }
    } catch (e: any) {
      console.error('Fake exclusion sync error:', e.message);
    }

    return NextResponse.json({ processed, failed, total: jobs.length, fakesSynced });
  } catch (error: any) {
    console.error('Worker error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
