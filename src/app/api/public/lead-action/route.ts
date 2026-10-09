import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyLeadAction } from '@/lib/hmac';
import { enqueueConversionForLead } from '@/lib/enqueue-conversion';
import { validateAndNormalizePlate } from '@/lib/plate-validator';

function confirmationHtml(input: {
  title: string;
  status: string;
  leadId?: string;
  dashboardUrl?: string;
}) {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${input.title}</title></head><body style="margin:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><section style="width:min(420px,100%);background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.12);text-align:center"><div style="font-size:44px;margin-bottom:8px">✅</div><h1 style="font-size:24px;margin:0 0 8px">${input.title}</h1><p style="margin:0 0 20px;color:#4b5563">Status nou: <strong>${input.status}</strong></p><p style="margin:0 0 18px;color:#6b7280">Poți închide pagina.</p>${input.dashboardUrl ? `<a href="${input.dashboardUrl}" style="display:inline-block;color:#6b7280;font-size:13px;text-decoration:none">Deschide dashboard</a>` : ''}</section></main></body></html>`;
}

// GET = doar pagină de confirmare (scannerele de linkuri din email fac GET automat;
// fără asta ar crea conversii Google Ads false). Schimbarea se face doar prin POST.
const LABELS: Record<string, [string, string]> = {
  book: ['✅ Confirm: Programat', '#16a34a'], complete: ['🏁 Confirm: A venit', '#2563eb'],
  fake: ['🚫 Confirm: Fake / spam', '#6b7280'], confirm: ['Confirm', '#2563eb'],
  no_answer: ['Confirm: Nu răspunde', '#6b7280'], accept: ['Confirm: Acceptat', '#2563eb'],
};

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  try {
    const { leadId, action } = verifyLeadAction(token);
    const [label, bg] = LABELS[action] || ['Confirm', '#2563eb'];
    const t = token.replace(/[^A-Za-z0-9_-]/g, '');

    // CRITICAL: book/complete actions require registration number
    const criticalActions = ['book', 'complete'];
    if (criticalActions.includes(action)) {
      // Check if lead has registration number
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId);
      const lead = isUuid
        ? await prisma.leads.findFirst({
            where: { OR: [{ id: leadId }, { idempotency_key: leadId }] },
            select: { registration_number: true },
          })
        : await prisma.leads.findFirst({
            where: { idempotency_key: leadId },
            select: { registration_number: true },
          });

      if (!lead?.registration_number) {
        // Show form that asks for registration number
        return new NextResponse(`<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Completează număr înmatriculare</title></head><body style="margin:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><form method="post" action="/api/public/lead-action" style="width:min(420px,100%);background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.12)"><input type="hidden" name="token" value="${t}"><h1 style="font-size:22px;margin:0 0 8px;font-weight:700">Număr de înmatriculare necesar</h1><p style="margin:0 0 20px;color:#6b7280;font-size:15px">Pentru a marca acest lead ca <strong>${action === 'book' ? 'Programat' : 'Finalizat'}</strong>, introduceți numărul de înmatriculare:</p><label style="display:block;margin-bottom:16px"><span style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#374151">Număr înmatriculare</span><input type="text" name="registration_number" required placeholder="CT-05-EAM sau B-123-ABC" pattern="[A-Z]{1,2}[\\s\\-]?\\d{2,3}[\\s\\-]?[A-Z]{3}" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;text-transform:uppercase" autocomplete="off"></label><button type="submit" style="width:100%;padding:14px;border:0;border-radius:10px;background:${bg};color:#fff;font-size:16px;font-weight:700;cursor:pointer">${label}</button><p style="margin:16px 0 0;color:#9ca3af;font-size:12px;text-align:center">Format: cod județ + cifre + litere<br>Exemplu: CT-05-EAM, B-123-ABC</p></form></main></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
    }

    // Normal confirmation button (no registration number needed, or already has one)
    return new NextResponse(`<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Confirmă</title></head><body style="margin:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><form method="post" action="/api/public/lead-action" style="width:min(380px,100%)"><input type="hidden" name="token" value="${t}"><button type="submit" style="width:100%;padding:18px;border:0;border-radius:12px;background:${bg};color:#fff;font-size:18px;font-weight:700">${label}</button></form></main></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = String(formData.get('token') || '');
    const registrationNumber = String(formData.get('registration_number') || '');

    if (!token) {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    const { leadId, action } = verifyLeadAction(token);

    // leadId may be a UUID (dashboard email) or an idempotency_key hex (n8n email).
    // Querying a UUID column with a 64-char hex makes Prisma throw, so branch.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId);
    const lead = isUuid
      ? await prisma.leads.findFirst({
          where: { OR: [{ id: leadId }, { idempotency_key: leadId }] },
        })
      : await prisma.leads.findFirst({
          where: { idempotency_key: leadId },
        });

    if (!lead) {
      return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });
    }

    const realLeadId = lead.id;

    // Map action to status. Public email actions must use same terminal statuses as dashboard UI,
    // otherwise Google conversion queue never fires.
    const actionMap: Record<string, { status: string; event_type: string; conversion_event?: string }> = {
      confirm: { status: 'confirmed', event_type: 'lead_confirmed_by_reception' },
      fake: { status: 'fake', event_type: 'fake_lead' },
      no_answer: { status: 'no_answer', event_type: 'no_answer' },
      book: { status: 'appointment_booked', event_type: 'appointment_booked', conversion_event: 'appointment_booked' },
      accept: { status: 'appointment_accepted', event_type: 'appointment_accepted' },
      complete: { status: 'work_completed', event_type: 'work_done', conversion_event: 'work_done' },
    };

    const mapping = actionMap[action];
    if (!mapping) {
      return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
    }

    // CRITICAL: book/complete require registration number
    const criticalActions = ['book', 'complete'];
    if (criticalActions.includes(action)) {
      const finalRegNumber = registrationNumber || lead.registration_number;
      if (!finalRegNumber) {
        return NextResponse.json(
          {
            error: 'registration_number_required',
            message: 'Numărul de înmatriculare este obligatoriu pentru această acțiune.',
          },
          { status: 400 }
        );
      }

      // Validate and normalize registration number if provided
      if (registrationNumber) {
        try {
          const normalized = validateAndNormalizePlate(registrationNumber);
          await prisma.leads.update({
            where: { id: realLeadId },
            data: { registration_number: normalized },
          });
        } catch (err: any) {
          return new NextResponse(
            `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Eroare validare</title></head><body style="margin:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><section style="width:min(420px,100%);background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.12);text-align:center"><div style="font-size:44px;margin-bottom:8px">⚠️</div><h1 style="font-size:24px;margin:0 0 8px;color:#dc2626">Număr invalid</h1><p style="margin:0 0 20px;color:#4b5563">${err.message}</p><a href="javascript:history.back()" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">← Încearcă din nou</a></section></main></body></html>`,
            {
              status: 400,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        }
      }
    }

    await prisma.leads.update({
      where: { id: realLeadId },
      data: { status: mapping.status },
    });

    await prisma.lead_events.create({
      data: {
        lead_id: realLeadId,
        event_type: mapping.event_type,
        from_status: lead.status,
        to_status: mapping.status,
      },
    });

    if (mapping.conversion_event) {
      await enqueueConversionForLead({
        leadId: realLeadId,
        conversionEvent: mapping.conversion_event,
      });
    }

    const title = action === 'fake' ? 'Marcat ca spam' : action === 'book' ? 'Marcat ca programat' : action === 'complete' ? 'Marcat ca finalizat' : 'Status actualizat';
    return new NextResponse(confirmationHtml({
      title,
      status: mapping.status,
      leadId: realLeadId,
      dashboardUrl: `${process.env.APP_URL}/leads/${realLeadId}`,
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('Lead action error:', error);
    return NextResponse.json(
      { error: 'invalid_token', message: error.message },
      { status: 400 }
    );
  }
}
