import crypto from 'crypto';

export function signLeadAction(input: {
  leadId: string;
  action: string;
  expiresAt: number;
}): string {
  const payload = `${input.leadId}.${input.action}.${input.expiresAt}`;

  const signature = crypto
    .createHmac('sha256', process.env.LEAD_ACTION_SECRET!)
    .update(payload)
    .digest('hex');

  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

export function verifyLeadAction(token: string): {
  leadId: string;
  action: string;
} {
  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  const [leadId, action, expiresAtRaw, signature] = decoded.split('.');

  const expiresAt = Number(expiresAtRaw);

  if (!leadId || !action || !expiresAt || !signature) {
    throw new Error('Invalid token');
  }

  if (Date.now() > expiresAt) {
    throw new Error('Expired token');
  }

  const payload = `${leadId}.${action}.${expiresAt}`;

  const expected = crypto
    .createHmac('sha256', process.env.LEAD_ACTION_SECRET!)
    .update(payload)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid signature');
  }

  return { leadId, action };
}

export function verifyIngestHMAC(
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const now = Date.now();
  const ts = Number(timestamp);

  if (Math.abs(now - ts) > 5 * 60 * 1000) {
    return false; // timestamp too old
  }

  const payload = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac('sha256', process.env.INGEST_HMAC_SECRET!)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
