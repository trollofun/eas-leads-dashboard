import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { sha256Hex } from '@/lib/hash';
import { syncCustomerMatch } from '@/lib/customer-match';

// POST: sync unsynced customers to Google Customer Match
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const unsynced = await prisma.customer_imports.findMany({
    where: { synced_to_google: false, phone_hash: { not: null } },
    take: 500,
    select: { id: true, phone_hash: true, email: true },
  });

  if (!unsynced.length) {
    return NextResponse.json({ synced: 0, message: 'Nothing to sync' });
  }

  const members = unsynced.map(c => ({
    hashedPhoneNumber: c.phone_hash || undefined,
    hashedEmailAddress: c.email ? sha256Hex(c.email) : undefined,
  }));

  const result = await syncCustomerMatch(members);

  // Mark synced (even if errors — don't retry forever; errors are logged)
  if (result.uploaded > 0) {
    const ids = unsynced.slice(0, result.uploaded).map(c => c.id);
    await prisma.customer_imports.updateMany({
      where: { id: { in: ids } },
      data: { synced_to_google: true, synced_at: new Date() },
    });
  }

  return NextResponse.json({
    synced: result.uploaded,
    total: unsynced.length,
    errors: result.errors,
  });
}
