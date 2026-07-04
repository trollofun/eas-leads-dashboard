import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyLeadAction } from '@/lib/hmac';

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

    // Map action to status
    const actionMap: Record<string, { status: string; event_type: string }> = {
      confirm: { status: 'confirmed', event_type: 'lead_confirmed_by_reception' },
      fake: { status: 'fake', event_type: 'fake_lead' },
      no_answer: { status: 'no_answer', event_type: 'no_answer' },
      book: { status: 'appointment_booked', event_type: 'appointment_booked' },
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

    // Redirect to dashboard lead detail
    return NextResponse.redirect(
      `${process.env.APP_URL}/leads/${leadId}`
    );
  } catch (error: any) {
    console.error('Lead action error:', error);
    return NextResponse.json(
      { error: 'invalid_token', message: error.message },
      { status: 400 }
    );
  }
}
