import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyLeadAction } from '@/lib/hmac';
import { enqueueConversionForLead } from '@/lib/enqueue-conversion';

function confirmationHtml(input: {
  title: string;
  status: string;
  leadId?: string;
  dashboardUrl?: string;
}) {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${input.title}</title></head><body style="margin:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><section style="width:min(420px,100%);background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.12);text-align:center"><div style="font-size:44px;margin-bottom:8px">✅</div><h1 style="font-size:24px;margin:0 0 8px">${input.title}</h1><p style="margin:0 0 20px;color:#4b5563">Status nou: <strong>${input.status}</strong></p><p style="margin:0 0 18px;color:#6b7280">Poți închide pagina.</p>${input.dashboardUrl ? `<a href="${input.dashboardUrl}" style="display:inline-block;color:#6b7280;font-size:13px;text-decoration:none">Deschide dashboard</a>` : ''}</section></main></body></html>`;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    const { leadId, action } = verifyLeadAction(token);

    const lead = await prisma.leads.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });
    }

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

    await prisma.leads.update({
      where: { id: leadId },
      data: { status: mapping.status },
    });

    await prisma.lead_events.create({
      data: {
        lead_id: leadId,
        event_type: mapping.event_type,
        from_status: lead.status,
        to_status: mapping.status,
      },
    });

    if (mapping.conversion_event) {
      await enqueueConversionForLead({
        leadId,
        conversionEvent: mapping.conversion_event,
      });
    }

    const title = action === 'fake' ? 'Marcat ca spam' : action === 'book' ? 'Marcat ca programat' : action === 'complete' ? 'Marcat ca finalizat' : 'Status actualizat';
    return new NextResponse(confirmationHtml({
      title,
      status: mapping.status,
      leadId,
      dashboardUrl: `${process.env.APP_URL}/leads/${leadId}`,
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
