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
  const tokenConfirm = signLeadAction({ leadId: lead.leadId, action: 'confirm', expiresAt: now + 7 * 24 * 60 * 60 * 1000 });
  const tokenFake = signLeadAction({ leadId: lead.leadId, action: 'fake', expiresAt: now + 7 * 24 * 60 * 60 * 1000 });
  const tokenNoAnswer = signLeadAction({ leadId: lead.leadId, action: 'no_answer', expiresAt: now + 7 * 24 * 60 * 60 * 1000 });
  const tokenBook = signLeadAction({ leadId: lead.leadId, action: 'book', expiresAt: now + 7 * 24 * 60 * 60 * 1000 });

  const subject = `[EAS] Lead nou: ${lead.name || 'Necunoscut'} — ${lead.serviceType} (${lead.source})`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px">
<h2>🚗 Lead nou primit</h2>
<table style="border-collapse:collapse;width:100%">
<tr><td style="padding:6px 12px;font-weight:bold">Nume</td><td style="padding:6px 12px">${lead.name || '—'}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">Telefon</td><td style="padding:6px 12px">${lead.phone || '—'}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">Serviciu</td><td style="padding:6px 12px">${lead.serviceType}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">Sursă</td><td style="padding:6px 12px">${lead.source}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">Mesaj</td><td style="padding:6px 12px">${lead.message || '—'}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">Fake score</td><td style="padding:6px 12px">${lead.fakeScore}/100</td></tr>
</table>

<h3>Acțiuni rapide</h3>
<table style="border-collapse:collapse">
<tr>
<td style="padding:4px"><a href="${appUrl}/api/public/lead-action?token=${tokenConfirm}" style="display:inline-block;padding:10px 20px;background:#22c55e;color:white;text-decoration:none;border-radius:6px">✅ Confirmă</a></td>
<td style="padding:4px"><a href="${appUrl}/api/public/lead-action?token=${tokenBook}" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:6px">📅 Programează</a></td>
</tr>
<tr>
<td style="padding:4px"><a href="${appUrl}/api/public/lead-action?token=${tokenNoAnswer}" style="display:inline-block;padding:10px 20px;background:#f59e0b;color:white;text-decoration:none;border-radius:6px">📞 Fără răspuns</a></td>
<td style="padding:4px"><a href="${appUrl}/api/public/lead-action?token=${tokenFake}" style="display:inline-block;padding:10px 20px;background:#ef4444;color:white;text-decoration:none;border-radius:6px">🚫 Fake</a></td>
</tr>
</table>

<p style="margin-top:20px;font-size:12px;color:#666">
  <a href="${appUrl}/leads/${lead.leadId}">Deschide în dashboard →</a>
</p>
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
