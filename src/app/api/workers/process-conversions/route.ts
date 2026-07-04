import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadGoogleAdsOfflineConversion } from '@/lib/google-conversions';

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

    if (jobs.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

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

    return NextResponse.json({ processed, failed, total: jobs.length });
  } catch (error: any) {
    console.error('Worker error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
