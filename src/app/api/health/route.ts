import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'eas-leads-dashboard',
    time: new Date().toISOString(),
  });
}
