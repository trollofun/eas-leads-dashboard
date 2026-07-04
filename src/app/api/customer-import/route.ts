import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { sha256Hex } from '@/lib/hash';

// POST: single or bulk import
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const items: { name: string; phone?: string; email?: string; address?: string }[] = Array.isArray(body.items) ? body.items : [body];

  if (!items.length) return NextResponse.json({ error: 'empty' }, { status: 400 });

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.name?.trim()) { skipped++; continue; }

    const phoneE164 = normalizePhone(item.phone);
    const phoneHash = phoneE164 ? sha256Hex(phoneE164) : null;

    // Deduplicate by phone_hash (if phone provided)
    if (phoneHash) {
      const existing = await prisma.customer_imports.findFirst({ where: { phone_hash: phoneHash } });
      if (existing) { skipped++; continue; }
    }

    await prisma.customer_imports.create({
      data: {
        name: item.name.trim(),
        phone: item.phone?.trim() || null,
        phone_hash: phoneHash,
        email: item.email?.trim() || null,
        address: item.address?.trim() || null,
        source: items.length > 1 ? 'csv' : 'manual',
        imported_by: (session.user as any)?.id || null,
      },
    });
    created++;
  }

  return NextResponse.json({ created, skipped, total: items.length });
}

// GET: recent imports
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 200);
  const rows = await prisma.customer_imports.findMany({
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true, created_at: true, name: true, phone: true, email: true, address: true,
      source: true, synced_to_google: true,
    },
  });

  const total = await prisma.customer_imports.count();
  return NextResponse.json({ items: rows, total });
}

function normalizePhone(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return '+4' + digits.slice(1);
  if (digits.length === 12 && digits.startsWith('40')) return '+' + digits;
  if (raw.startsWith('+')) return raw.replace(/\s/g, '');
  return null;
}
