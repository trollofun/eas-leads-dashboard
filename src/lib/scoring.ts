import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BLOCK_DURATIONS = {
  phone: 180 * 24 * 60 * 60 * 1000,
  email: 180 * 24 * 60 * 60 * 1000,
  cookie: 90 * 24 * 60 * 60 * 1000,
  ip: 7 * 24 * 60 * 60 * 1000,
} as const;

export async function calculateFakeScore(input: {
  phone?: string | null;
  email?: string | null;
  phone_hash?: string | null;
  email_hash?: string | null;
  cookie_id?: string | null;
  browser_risk_score?: number;
  ip_hash?: string | null;
  message?: string | null;
  submit_speed_ms?: number;
}): Promise<{ score: number; reasons: string[] }> {
  let score = 0;
  const reasons: string[] = [];

  // Check blocked signals
  if (input.phone_hash) {
    const phoneBlock = await prisma.blocked_signals.findFirst({
      where: {
        signal_type: 'phone',
        signal_value_hash: input.phone_hash,
        expires_at: { gt: new Date() },
      },
      orderBy: { score: 'desc' },
    });
    if (phoneBlock) {
      score += 80;
      reasons.push('phone_blocked');
    }
  }

  if (input.email_hash) {
    const emailBlock = await prisma.blocked_signals.findFirst({
      where: {
        signal_type: 'email',
        signal_value_hash: input.email_hash,
        expires_at: { gt: new Date() },
      },
      orderBy: { score: 'desc' },
    });
    if (emailBlock) {
      score += 80;
      reasons.push('email_blocked');
    }
  }

  // Browser automation risk
  if (input.browser_risk_score && input.browser_risk_score >= 65) {
    score += 35;
    reasons.push('browser_automation_risk');
  }

  // Cookie/fingerprint blocked
  if (input.cookie_id) {
    const cookieBlock = await prisma.blocked_signals.findFirst({
      where: {
        signal_type: 'cookie',
        signal_value_hash: input.cookie_id,
        expires_at: { gt: new Date() },
      },
    });
    if (cookieBlock) {
      score += 50;
      reasons.push('cookie_blocked');
    }
  }

  // Email temp detection (simple heuristic)
  if (input.email) {
    const tempDomains = ['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'yopmail.com', 'throwaway.email', 'trashmail.com', 'sharklasers.com'];
    const domain = input.email.split('@')[1]?.toLowerCase();
    if (domain && tempDomains.includes(domain)) {
      score += 40;
      reasons.push('temp_email');
    }
  }

  // IP hash blocked (7 days)
  if (input.ip_hash) {
    const ipBlock = await prisma.blocked_signals.findFirst({
      where: {
        signal_type: 'ip',
        signal_value_hash: input.ip_hash,
        expires_at: { gt: new Date() },
      },
      orderBy: { score: 'desc' },
    });
    if (ipBlock) {
      score += 15;
      reasons.push('ip_hash_blocked');
    }
  }

  // Submit too fast
  if (input.submit_speed_ms && input.submit_speed_ms < 2000) {
    score += 20;
    reasons.push('submit_too_fast');
  }

  return { score, reasons };
}

export async function blockSignal(params: {
  signal_type: string;
  signal_value_hash: string;
  reason: string;
  score: number;
  lead_id?: string;
}) {
  const expiresAt = new Date(
    Date.now() + (BLOCK_DURATIONS[params.signal_type as keyof typeof BLOCK_DURATIONS] || BLOCK_DURATIONS.ip)
  );

  await prisma.blocked_signals.create({
    data: {
      signal_type: params.signal_type,
      signal_value_hash: params.signal_value_hash,
      reason: params.reason,
      score: params.score,
      lead_id: params.lead_id,
      expires_at: expiresAt,
    },
  });
}

export function shouldBlock(fake_score: number): 'accept' | 'suspicious' | 'manual_review' | 'blocked' {
  if (fake_score < 40) return 'accept';
  if (fake_score < 70) return 'suspicious';
  if (fake_score < 100) return 'manual_review';
  return 'blocked';
}
