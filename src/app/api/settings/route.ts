import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const settings = await prisma.dashboard_settings.findMany();
  const result: Record<string, any> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return NextResponse.json(result);
}
