import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const limit = Number(request.nextUrl.searchParams.get('limit')) || 50;
  const status = request.nextUrl.searchParams.get('status');
  const serviceType = request.nextUrl.searchParams.get('service_type');

  const where: any = {};
  if (status) where.status = status;
  if (serviceType) where.service_type = serviceType;

  const leads = await prisma.leads.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: Math.min(limit, 200),
    select: {
      id: true,
      created_at: true,
      source: true,
      service_type: true,
      status: true,
      priority: true,
      name: true,
      phone: true,
      email: true,
      car_make: true,
      car_model: true,
      car_year: true,
      registration_number: true,
      fake_score: true,
      google_conversion_status: true,
      appointment_at: true,
    },
  });

  return NextResponse.json({ leads, total: leads.length });
}
