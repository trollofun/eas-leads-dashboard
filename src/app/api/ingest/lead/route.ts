import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizePhoneRO, normalizeEmail } from '@/lib/normalize';
import { sha256Hex } from '@/lib/hash';
import { verifyIngestHMAC } from '@/lib/hmac';
import { calculateFakeScore } from '@/lib/scoring';

export async function POST(request: NextRequest) {
  try {
    // Auth
    const apiKey = request.headers.get('X-EAS-Api-Key');
    const timestamp = request.headers.get('X-EAS-Timestamp');
    const signature = request.headers.get('X-EAS-Signature');
    const idempotencyKey = request.headers.get('X-Idempotency-Key');

    if (apiKey !== process.env.INGEST_API_KEY) {
      return NextResponse.json({ error: 'auth_failed' }, { status: 401 });
    }

    if (!timestamp || !signature) {
      return NextResponse.json({ error: 'auth_failed' }, { status: 401 });
    }

    const body = await request.text();
    const valid = verifyIngestHMAC(timestamp, body, signature);
    if (!valid) {
      return NextResponse.json({ error: 'auth_failed' }, { status: 401 });
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await prisma.leads.findUnique({
        where: { idempotency_key: idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { lead_id: existing.id, duplicate: true },
          { status: 200 }
        );
      }
    }

    const payload = JSON.parse(body);

    // Normalize + hash
    let phoneHash: string | null = null;
    let emailHash: string | null = null;

    try {
      if (payload.contact?.phone) {
        const normalized = normalizePhoneRO(payload.contact.phone);
        phoneHash = sha256Hex(normalized);
      }
    } catch {}

    try {
      if (payload.contact?.email) {
        const normalized = normalizeEmail(payload.contact.email);
        emailHash = sha256Hex(normalized);
      }
    } catch {}

    // Fake scoring
    const fakeResult = await calculateFakeScore({
      phone: payload.contact?.phone,
      email: payload.contact?.email,
      phone_hash: phoneHash,
      email_hash: emailHash,
      cookie_id: payload.ad_click?.first_party_cookie_id,
      browser_risk_score: payload.ad_click?.browser_risk_score,
      ip_hash: null, // n8n doesn't send IP
      message: payload.message,
    });

    const blocked = fakeResult.score >= 100;

    // Create ad_click if click data present
    let adClickId: string | null = null;
    if (payload.ad_click?.gclid || payload.ad_click?.first_party_cookie_id) {
      const adClick = await prisma.ad_clicks.create({
        data: {
          gclid: payload.ad_click.gclid,
          gbraid: payload.ad_click.gbraid,
          wbraid: payload.ad_click.wbraid,
          utm_source: payload.ad_click.utm_source,
          utm_medium: payload.ad_click.utm_medium,
          utm_campaign: payload.ad_click.utm_campaign,
          utm_term: payload.ad_click.utm_term,
          utm_content: payload.ad_click.utm_content,
          landing_page: payload.ad_click.landing_page,
          referrer: payload.ad_click.referrer,
          first_party_cookie_id: payload.ad_click.first_party_cookie_id,
          session_id: payload.ad_click.session_id,
          browser_risk_score: payload.ad_click.browser_risk_score || 0,
          browser_risk_reasons: payload.ad_click.browser_risk_reasons || '[]',
        },
      });
      adClickId = adClick.id;
    }

    // Create lead
    const lead = await prisma.leads.create({
      data: {
        source: payload.source || 'website',
        service_type: payload.service_type || 'altul',
        name: payload.contact?.name,
        phone: payload.contact?.phone,
        phone_hash: phoneHash,
        email: payload.contact?.email,
        email_hash: emailHash,
        car_make: payload.vehicle?.make,
        car_model: payload.vehicle?.model,
        car_year: payload.vehicle?.year,
        registration_number: payload.vehicle?.registration_number,
        message: payload.message,
        ad_click_id: adClickId,
        fake_score: fakeResult.score,
        fake_reasons: fakeResult.reasons,
        idempotency_key: idempotencyKey,
        consent_ad_user_data: payload.consent?.ad_user_data,
        consent_ad_personalization: payload.consent?.ad_personalization,
        consent_collected_at: payload.consent?.collected_at ? new Date(payload.consent.collected_at) : null,
        consent_method: payload.consent?.method,
      },
    });

    // Create lead_submitted event
    await prisma.lead_events.create({
      data: {
        lead_id: lead.id,
        event_type: 'lead_submitted',
        metadata: {
          source: payload.source,
          service_type: payload.service_type,
          fake_score: fakeResult.score,
          blocked,
          n8n_workflow_id: payload.raw_metadata?.n8n_workflow_id,
        },
      },
    });

    return NextResponse.json(
      {
        lead_id: lead.id,
        status: lead.status,
        fake_score: fakeResult.score,
        blocked,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      { error: 'server_error', message: error.message },
      { status: 500 }
    );
  }
}
