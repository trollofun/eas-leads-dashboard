#!/usr/bin/env tsx
/**
 * Retry failed July 2026 conversions
 *
 * Owner approval (EUR-114, 09.10.2026):
 * 1. validate_only=true on all 8
 * 2. Check for duplicates (not already accepted in Google)
 * 3. If validation passes → real upload
 * 4. Report counters: sent / accepted / rejected + reason (no PII)
 */

import { prisma } from '../src/lib/db';
import { uploadGoogleAdsOfflineConversion } from '../src/lib/google-conversions';

const JULY_FAILED_IDS = [
  '7fd0bccb-a958-43f2-a43a-6488f42107f5', // appointment_booked 2026-07-23
  '4c8d8b7f-52c2-483c-8453-9204942f684e', // work_done 2026-07-23
  'deb438a1-26d2-4ea5-a2cf-ca43c9c08d70', // appointment_booked 2026-07-23
  '6f3b28b5-018e-4399-a9fd-6a0fbbbe92bc', // work_done 2026-07-23
  '1f55da2c-723b-4eae-b54e-01453bd15e56', // appointment_booked 2026-07-23
  '84bcc37f-460b-449b-99c6-e30584eec3c1', // work_done 2026-07-23
  '134d9b1a-c67b-45cb-a785-7b8f4e4ef02a', // appointment_booked 2026-07-29
  '9c16383e-affc-4926-8103-0b126f3fe98e', // work_done 2026-07-29
];

interface RetryResult {
  id: string;
  conversion_event: string;
  transaction_id: string;
  validation_passed: boolean;
  upload_passed?: boolean;
  error?: string;
  skipped?: boolean;
  skip_reason?: string;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Retry July 2026 Failed Conversions (EUR-114)');
  console.log('═══════════════════════════════════════════════════════\n');

  const results: RetryResult[] = [];

  // 1. Load conversions
  console.log(`Loading ${JULY_FAILED_IDS.length} conversions...\n`);

  const conversions = await prisma.google_conversion_queue.findMany({
    where: { id: { in: JULY_FAILED_IDS } },
    include: { lead: { include: { ad_click: true } } },
  });

  if (conversions.length !== JULY_FAILED_IDS.length) {
    console.warn(`⚠️  Warning: Found ${conversions.length}/${JULY_FAILED_IDS.length} conversions\n`);
  }

  // 2. Check for duplicates (already sent)
  console.log('Checking for duplicates...\n');

  for (const conv of conversions) {
    const result: RetryResult = {
      id: conv.id,
      conversion_event: conv.conversion_event,
      transaction_id: conv.transaction_id,
      validation_passed: false,
    };

    // Check if same lead has a successful conversion with same event
    const duplicate = await prisma.google_conversion_queue.findFirst({
      where: {
        lead_id: conv.lead_id,
        conversion_event: conv.conversion_event,
        status: 'sent',
        id: { not: conv.id },
      },
    });

    if (duplicate) {
      result.skipped = true;
      result.skip_reason = `Duplicate: already sent ${duplicate.id}`;
      results.push(result);
      console.log(`  ⊘ ${conv.id.slice(0, 8)}... ${conv.conversion_event} — SKIP (duplicate)`);
      continue;
    }

    if (!conv.lead) {
      result.skipped = true;
      result.skip_reason = 'Lead deleted';
      results.push(result);
      console.log(`  ⊘ ${conv.id.slice(0, 8)}... ${conv.conversion_event} — SKIP (no lead)`);
      continue;
    }

    if (conv.lead.status === 'fake') {
      result.skipped = true;
      result.skip_reason = 'Lead marked as fake';
      results.push(result);
      console.log(`  ⊘ ${conv.id.slice(0, 8)}... ${conv.conversion_event} — SKIP (fake)`);
      continue;
    }

    const payload = conv.payload as any;

    // 3. Validate
    console.log(`  ➤ ${conv.id.slice(0, 8)}... ${conv.conversion_event} — VALIDATING...`);

    try {
      await uploadGoogleAdsOfflineConversion({
        conversionActionId: payload.conversionActionId,
        transactionId: conv.transaction_id,
        eventTimestamp: new Date(payload.eventTimestamp),
        value: Number(payload.value),
        currency: payload.currency || 'RON',
        gclid: payload.gclid,
        gbraid: payload.gbraid,
        wbraid: payload.wbraid,
        emailHash: payload.emailHash,
        phoneHash: payload.phoneHash,
        validateOnly: true,
      });

      result.validation_passed = true;
      console.log(`    ✓ Validation passed`);
    } catch (err: any) {
      result.error = err.message;
      console.log(`    ✗ Validation failed: ${err.message}`);
    }

    results.push(result);
  }

  // Summary after validation
  const validCount = results.filter(r => r.validation_passed).length;
  const skipCount = results.filter(r => r.skipped).length;
  const failCount = results.filter(r => !r.validation_passed && !r.skipped).length;

  console.log('\n─────────────────────────────────────────────────────');
  console.log('VALIDATION SUMMARY:');
  console.log(`  ✓ Passed:  ${validCount}`);
  console.log(`  ⊘ Skipped: ${skipCount}`);
  console.log(`  ✗ Failed:  ${failCount}`);
  console.log('─────────────────────────────────────────────────────\n');

  if (validCount === 0) {
    console.log('No conversions to upload. Exiting.\n');
    return;
  }

  // 4. Real upload (only validated ones)
  console.log(`Uploading ${validCount} validated conversions...\n`);

  for (const result of results) {
    if (!result.validation_passed) continue;

    const conv = conversions.find(c => c.id === result.id)!;
    const payload = conv.payload as any;

    console.log(`  ➤ ${conv.id.slice(0, 8)}... ${conv.conversion_event} — UPLOADING...`);

    try {
      const uploadResult = await uploadGoogleAdsOfflineConversion({
        conversionActionId: payload.conversionActionId,
        transactionId: conv.transaction_id,
        eventTimestamp: new Date(payload.eventTimestamp),
        value: Number(payload.value),
        currency: payload.currency || 'RON',
        gclid: payload.gclid,
        gbraid: payload.gbraid,
        wbraid: payload.wbraid,
        emailHash: payload.emailHash,
        phoneHash: payload.phoneHash,
        validateOnly: false, // REAL upload
      });

      // Mark as sent in DB
      await prisma.google_conversion_queue.update({
        where: { id: conv.id },
        data: {
          status: 'sent',
          processed_at: new Date(),
          request_id: uploadResult.requestId,
          attempts: 0, // reset attempts
        },
      });

      await prisma.leads.update({
        where: { id: conv.lead_id! },
        data: {
          google_conversion_status: 'sent',
          google_conversion_sent_at: new Date(),
        },
      });

      result.upload_passed = true;
      console.log(`    ✓ Uploaded (requestId: ${uploadResult.requestId})`);
    } catch (err: any) {
      result.upload_passed = false;
      result.error = err.message;
      console.log(`    ✗ Upload failed: ${err.message}`);
    }
  }

  // Final summary
  const uploadedCount = results.filter(r => r.upload_passed).length;
  const uploadFailedCount = results.filter(r => r.validation_passed && !r.upload_passed).length;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FINAL SUMMARY:');
  console.log(`  Total conversions:     ${JULY_FAILED_IDS.length}`);
  console.log(`  Skipped (duplicates):  ${skipCount}`);
  console.log(`  Validation failed:     ${failCount}`);
  console.log(`  ✓ Uploaded:            ${uploadedCount}`);
  console.log(`  ✗ Upload failed:       ${uploadFailedCount}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Detailed failure reasons (no PII)
  const failures = results.filter(r => r.error);
  if (failures.length > 0) {
    console.log('FAILURE DETAILS:\n');
    failures.forEach(f => {
      console.log(`  ${f.id.slice(0, 8)}... ${f.conversion_event}`);
      console.log(`    Reason: ${f.error}\n`);
    });
  }

  // Skipped details
  const skipped = results.filter(r => r.skipped);
  if (skipped.length > 0) {
    console.log('SKIPPED DETAILS:\n');
    skipped.forEach(s => {
      console.log(`  ${s.id.slice(0, 8)}... ${s.conversion_event}`);
      console.log(`    Reason: ${s.skip_reason}\n`);
    });
  }
}

main()
  .catch(err => {
    console.error('\n❌ Script error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
