import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const status = request.nextUrl.searchParams.get('status');
  const where: any = {};
  if (status && status !== 'all') where.status = status;

  const jobs = await prisma.google_conversion_queue.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 200,
    include: {
      lead: { select: { name: true, phone: true } },
    },
  });

  return NextResponse.json({ jobs, total: jobs.length });
}
