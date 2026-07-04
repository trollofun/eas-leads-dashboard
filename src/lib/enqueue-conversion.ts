import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function enqueueConversionForLead(input: {
  leadId: string;
  conversionEvent: string;
  actorId?: string;
}) {
  const lead = await prisma.leads.findUnique({
    where: { id: input.leadId },
    include: { ad_click: true },
  });

  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'fake') return null;
  if (lead.google_conversion_status === 'sent') return null;
  if (!lead.consent_ad_user_data) {
    await prisma.leads.update({
      where: { id: lead.id },
      data: { google_conversion_status: 'conversion_not_ready: missing_consent' },
    });
    return null;
  }

  // Get settings
  const settingsRaw = await prisma.dashboard_settings.findUnique({
    where: { key: 'google_conversions' },
  });

  const settings = settingsRaw?.value as any;
  if (!settings?.enabled) return null;

  const rule = settings.rules?.[input.conversionEvent];
  if (!rule?.enabled) return null;

  const hasMatchData =
    Boolean(lead.ad_click?.gclid) ||
    Boolean(lead.ad_click?.gbraid) ||
    Boolean(lead.ad_click?.wbraid) ||
    Boolean(lead.email_hash) ||
    Boolean(lead.phone_hash);

  if (!hasMatchData) {
    return null;
  }

  const transactionId = `${input.conversionEvent}_${lead.id}`;

  // Check for duplicate
  const existingJob = await prisma.google_conversion_queue.findUnique({
    where: { transaction_id: transactionId },
  });
  if (existingJob) return null;

  const value =
    Number(lead.final_value || lead.estimated_value || rule.defaultValue || 50);

  const payload = {
    conversionActionId: rule.conversionActionId,
    eventTimestamp: new Date().toISOString(),
    value,
    currency: lead.currency || 'RON',
    gclid: lead.ad_click?.gclid,
    gbraid: lead.ad_click?.gbraid,
    wbraid: lead.ad_click?.wbraid,
    emailHash: lead.email_hash,
    phoneHash: lead.phone_hash,
    validateOnly: settings.validateOnly ?? true,
  };

  const job = await prisma.google_conversion_queue.create({
    data: {
      lead_id: lead.id,
      conversion_event: input.conversionEvent,
      transaction_id: transactionId,
      payload,
      status: 'pending',
    },
  });

  await prisma.lead_events.create({
    data: {
      lead_id: lead.id,
      actor_id: input.actorId,
      event_type: 'google_conversion_queued',
      metadata: {
        conversionEvent: input.conversionEvent,
        transactionId,
      },
    },
  });

  await prisma.leads.update({
    where: { id: lead.id },
    data: {
      google_conversion_status: 'queued',
      google_transaction_id: transactionId,
    },
  });

  return job;
}
