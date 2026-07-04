import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { enqueueConversionForLead } from '@/lib/enqueue-conversion';

const STATUS_CONVERSION_MAP: Record<string, string> = {
  confirmed: 'lead_confirmed_by_reception',
  appointment_booked: 'appointment_booked',
  arrived: 'vehicle_arrived',
  itp_done: 'itp_done',
  work_completed: 'work_completed',
  invoiced: 'invoice_paid',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.leads.findUnique({
    where: { id },
    include: { ad_click: true, lead_events: { orderBy: { created_at: 'desc' }, take: 50 }, vehicle_records: true },
  });

  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const lead = await prisma.leads.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const updateData: any = {};
  const allowedFields = [
    'status', 'priority', 'name', 'phone', 'email', 'car_make', 'car_model',
    'car_year', 'registration_number', 'service_type', 'message', 'internal_notes',
    'estimated_value', 'final_value', 'appointment_at', 'arrived_at',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  updateData.updated_at = new Date();

  const updated = await prisma.leads.update({
    where: { id },
    data: updateData,
  });

  // Log status change
  if (body.status && body.status !== lead.status) {
    await prisma.lead_events.create({
      data: {
        lead_id: id,
        actor_id: (session.user as any)?.id,
        event_type: `status_changed`,
        from_status: lead.status,
        to_status: body.status,
        metadata: {},
      },
    });

    // Enqueue conversion if status maps to one
    const conversionEvent = STATUS_CONVERSION_MAP[body.status];
    if (conversionEvent) {
      await enqueueConversionForLead({
        leadId: id,
        conversionEvent,
        actorId: (session.user as any)?.id,
      });
    }

    // Block signals for fake leads
    if (body.status === 'fake') {
      const { blockSignal } = await import('@/lib/scoring');
      if (lead.phone_hash) await blockSignal({ signal_type: 'phone', signal_value_hash: lead.phone_hash, reason: 'marked_fake_by_user', score: 80, lead_id: id });
      if (lead.email_hash) await blockSignal({ signal_type: 'email', signal_value_hash: lead.email_hash, reason: 'marked_fake_by_user', score: 80, lead_id: id });
    }
  }

  return NextResponse.json(updated);
}
