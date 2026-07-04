import { prisma } from './db';
import { signLeadAction } from './hmac';

interface NotificationInput {
  leadId: string;
  name: string | null;
  phone: string | null;
  serviceType: string;
  source: string;
  message: string | null;
  fakeScore: number;
}

export async function sendReceptionEmail(lead: NotificationInput) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'noreply@euroautoservice.ro';
  const receptionEmail = process.env.RECEPTION_EMAIL || 'receptie@euroautoservice.ro';
  const appUrl = process.env.APP_URL || 'http://leads.local';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('SMTP not configured, skipping reception email');
    return;
  }

  const now = Date.now();
  const tokenFake = signLeadAction({ leadId: lead.leadId, action: 'fake', expiresAt: now + 7 * 24 * 60 * 60 * 1000 });
  const tokenAccept = signLeadAction({ leadId: lead.leadId, action: 'accept', expiresAt: now + 7 * 24 * 60 * 60 * 1000 });
  const tokenComplete = signLeadAction({ leadId: lead.leadId, action: 'complete', expiresAt: now + 7 * 24 * 60 * 60 * 1000 });

  const subject = `[EAS] Lead nou: ${lead.name || 'Necunoscut'} — ${lead.serviceType} (${lead.source})`;

  const html = `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:480px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">

  <!-- Header -->
  <div style="background:#1a1a2e;color:#fff;padding:20px 24px">
    <div style="font-size:13px;opacity:.7;margin-bottom:4px">🚗 Euro Auto Service</div>
    <div style="font-size:18px;font-weight:600">Lead nou: ${lead.name || 'Necunoscut'}</div>
  </div>

  <!-- Info -->
  <div style="padding:20px 24px">
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr><td style="padding:6px 0;color:#666;width:100px">Telefon</td><td style="padding:6px 0;font-weight:500">${lead.phone || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Serviciu</td><td style="padding:6px 0;font-weight:500">${lead.serviceType}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Sursă</td><td style="padding:6px 0;font-weight:500">${lead.source}</td></tr>
      ${lead.message ? `<tr><td style="padding:6px 0;color:#666">Mesaj</td><td style="padding:6px 0">${lead.message}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#666">Scor fake</td><td style="padding:6px 0;font-weight:500;${lead.fakeScore >= 60 ? 'color:#ef4444' : ''}">${lead.fakeScore}/100</td></tr>
    </table>
  </div>

  <!-- Actions -->
  <div style="padding:0 24px 24px">
    <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Acțiuni rapide</div>
    <table style="border-collapse:collapse;width:100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:0 6px 8px 0;width:33.33%">
          <a href="${appUrl}/api/public/lead-action?token=${tokenFake}" style="display:block;padding:14px 8px;background:#fee2e2;color:#dc2626;text-decoration:none;border-radius:8px;text-align:center;font-weight:600;font-size:13px">🚫 Spam</a>
        </td>
        <td style="padding:0 0 8px 6px;width:33.33%">
          <a href="${appUrl}/api/public/lead-action?token=${tokenAccept}" style="display:block;padding:14px 8px;background:#dcfce7;color:#16a34a;text-decoration:none;border-radius:8px;text-align:center;font-weight:600;font-size:13px">✅ Acceptă</a>
        </td>
        <td style="padding:0 0 8px 0;width:33.33%">
          <a href="${appUrl}/api/public/lead-action?token=${tokenComplete}" style="display:block;padding:14px 8px;background:#dbeafe;color:#2563eb;text-decoration:none;border-radius:8px;text-align:center;font-weight:600;font-size:13px">🏁 Finalizează</a>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="padding:12px 24px;border-top:1px solid #f0f0f0">
    <a href="${appUrl}/leads/${lead.leadId}" style="font-size:12px;color:#999;text-decoration:none">Deschide în dashboard →</a>
  </div>

</div>
</body>
</html>`;

  // Dynamic import for nodemailer (not in deps yet, use native fetch + SMTP)
  // For MVP: use a simple SMTP library or nodemailer
  // Lazy import to avoid build issues if nodemailer not installed
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: receptionEmail,
      subject,
      html,
    });

    console.log(`Reception email sent for lead ${lead.leadId}`);
  } catch (err: any) {
    console.error('Failed to send reception email:', err.message);
    // Don't throw — email failure shouldn't block lead creation
  }
}
