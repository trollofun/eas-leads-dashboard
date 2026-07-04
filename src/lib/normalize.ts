export function normalizePhoneRO(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('40')) return `+${digits}`;
  if (digits.startsWith('0')) return `+4${digits.slice(1)}`;

  return `+4${digits}`;
}

export function normalizeEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  const [localRaw, domainRaw] = clean.split('@');

  if (!localRaw || !domainRaw) {
    throw new Error('Invalid email');
  }

  const domain = domainRaw.trim();

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const localWithoutPlus = localRaw.split('+')[0];
    const localWithoutDots = localWithoutPlus.replace(/\./g, '');
    return `${localWithoutDots}@${domain}`;
  }

  return `${localRaw}@${domain}`;
}
