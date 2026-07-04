import { PrismaClient } from '@prisma/client';
import { uploadGoogleAdsOfflineConversion } from '../lib/google-conversions';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const prisma = new PrismaClient();

async function processQueue() {
  const jobs = await prisma.google_conversion_queue.findMany({
    where: {
      status: 'pending',
      attempts: { lt: 5 },
    },
    orderBy: { created_at: 'asc' },
    take: 25,
  });

  console.log(`Processing ${jobs.length} conversion jobs`);

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
        continue;
      }

      if (!lead.consent_ad_user_data) {
        await prisma.google_conversion_queue.update({
          where: { id: job.id },
          data: { status: 'skipped', last_error: 'No ad_user_data consent' },
        });
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

      console.log(`✓ Conversion sent: ${job.transaction_id}`);
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
      console.error(`✗ Conversion failed (attempt ${newAttempts}): ${job.transaction_id}`, error.message);
    }
  }

  console.log('Queue processing complete');
}

processQueue()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
