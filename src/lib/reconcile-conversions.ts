import { prisma } from '@/lib/db';
import { retrieveRequestStatus } from '@/lib/google-conversions';

/**
 * Verifică la Google statusul real al conversiilor marcate `sent` și le reclasifică:
 *   SUCCESS / PARTIAL_SUCCESS → `confirmed`
 *   FAILED                   → `rejected` (+ motivul în last_error; lead-ul primește același motiv)
 *   PROCESSING / UNKNOWN     → rămâne `sent`, se reverifică data viitoare
 *
 * Rulează din worker-ul periodic. Nu retrimite nimic: o conversie respinsă ca EVENT_TOO_OLD
 * nu poate fi reparată prin retrimitere (fereastra click-through e de 90 zile).
 */
export async function reconcileSentConversions(limit = 50) {
  const rows = await prisma.google_conversion_queue.findMany({
    where: { status: 'sent', request_id: { not: null } },
    orderBy: { processed_at: 'asc' },
    take: limit,
  });

  let confirmed = 0, rejected = 0, pending = 0, errors = 0;

  for (const row of rows) {
    try {
      const remote = await retrieveRequestStatus(row.request_id!);

      if (remote.requestStatus === 'SUCCESS' || remote.requestStatus === 'PARTIAL_SUCCESS') {
        await prisma.google_conversion_queue.update({
          where: { id: row.id },
          data: { status: 'confirmed', last_error: null },
        });
        if (row.lead_id) {
          await prisma.leads.update({
            where: { id: row.lead_id },
            data: { google_conversion_status: 'confirmed' },
          }).catch(() => {});
        }
        confirmed++;
      } else if (remote.requestStatus === 'FAILED') {
        const reason = remote.errors?.map(e => `${e.reason} (${e.recordCount})`).join(', ') || 'FAILED';
        await prisma.google_conversion_queue.update({
          where: { id: row.id },
          data: { status: 'rejected', last_error: `google: ${reason}` },
        });
        if (row.lead_id) {
          await prisma.leads.update({
            where: { id: row.lead_id },
            data: { google_conversion_status: `rejected: ${reason}` },
          }).catch(() => {});
        }
        rejected++;
      } else {
        pending++;
      }
    } catch (e: any) {
      errors++;
      console.error(`reconcile ${row.id}: ${e.message}`);
    }
  }

  return { checked: rows.length, confirmed, rejected, pending, errors };
}
