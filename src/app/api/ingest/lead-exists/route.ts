import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizePhoneRO } from '@/lib/normalize';
import { sha256Hex } from '@/lib/hash';
import { verifyIngestHMAC } from '@/lib/hmac';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-EAS-Api-Key');
    const timestamp = request.headers.get('X-EAS-Timestamp');
    const signature = request.headers.get('X-EAS-Signature');

    if (apiKey !== process.env.INGEST_API_KEY) {
      return NextResponse.json({ error: 'auth_failed' }, { status: 401 });
    }

    if (!timestamp || !signature) {
      return NextResponse.json({ error: 'auth_failed' }, { status: 401 });
    }

    const body = await request.text();
    const valid = verifyIngestHMAC(timestamp, body, signature);
    if (!valid) {
      return NextResponse.json({ error: 'auth_failed' }, { status: 401 });
    }

    const { phone } = JSON.parse(body);
    if (!phone) {
      return NextResponse.json({ exists: false });
    }

    const hash = sha256Hex(normalizePhoneRO(phone));

    const recent = await prisma.leads.findFirst({
      where: {
        phone_hash: hash,
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ exists: !!recent });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
