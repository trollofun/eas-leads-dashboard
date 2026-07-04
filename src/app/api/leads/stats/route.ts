import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  const [todayCount, confirmedToday, appointmentsToday, arrivedToday, completedToday, queueCount, fakeCount, failedConvCount] = await Promise.all([
    prisma.leads.count({ where: { created_at: { gte: startOfDay } } }),
    prisma.leads.count({ where: { status: 'confirmed', updated_at: { gte: startOfDay } } }),
    prisma.leads.count({ where: { status: 'appointment_booked', appointment_at: { gte: startOfDay } } }),
    prisma.leads.count({ where: { status: 'arrived', updated_at: { gte: startOfDay } } }),
    prisma.leads.count({ where: { status: 'work_completed', updated_at: { gte: startOfDay } } }),
    prisma.google_conversion_queue.count({ where: { status: 'pending' } }),
    prisma.leads.count({ where: { status: 'fake', created_at: { gte: startOfWeek } } }),
    prisma.google_conversion_queue.count({ where: { status: 'failed' } }),
  ]);

  return NextResponse.json([
    { label: 'Leaduri azi', value: todayCount },
    { label: 'Confirmate azi', value: confirmedToday },
    { label: 'Programări azi', value: appointmentsToday },
    { label: 'Sosite azi', value: arrivedToday },
    { label: 'Finalizate azi', value: completedToday },
    { label: 'Conversii în coadă', value: queueCount },
    { label: 'Conversii eșuate', value: failedConvCount },
    { label: 'Fake-uri (7z)', value: fakeCount },
  ]);
}
