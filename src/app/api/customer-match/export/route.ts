import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET: export un-synced customers as Google Ads Customer Match CSV
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const unsyncedOnly = request.nextUrl.searchParams.get('unsynced') === 'true';

  const where: any = {};
  if (unsyncedOnly) where.synced_to_google = false;

  const rows = await prisma.customer_imports.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 5000,
    select: { phone: true, email: true, name: true, address: true },
  });

  // Google Ads Customer Match CSV format:
  // First row: header with MATCH_TYPE, IDENTIFIER_TYPE, IDENTIFIER
  // Phone = PHONE, Email = EMAIL, Name+Country = NAME
  const lines: string[] = [];
  lines.push('MATCH_TYPE,IDENTIFIER_TYPE,IDENTIFIER');

  for (const row of rows) {
    if (row.phone) {
      const normalized = normalizePhoneE164(row.phone);
      if (normalized) {
        lines.push(`CONTACT_INFO,PHONE,${normalized}`);
      }
    }
    if (row.email) {
      lines.push(`CONTACT_INFO,EMAIL,${row.email.trim().toLowerCase()}`);
    }
    // Name+Address combo for postal match (optional enrichment)
    if (row.name && row.address) {
      lines.push(`CONTACT_INFO,ADDRESS,"${row.name}||${row.address}"`);
    }
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="customer-match-export-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}

function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return '+4' + digits.slice(1);
  if (digits.length === 12 && digits.startsWith('40')) return '+' + digits;
  if (raw.startsWith('+')) return raw.replace(/\s/g, '');
  return null;
}
