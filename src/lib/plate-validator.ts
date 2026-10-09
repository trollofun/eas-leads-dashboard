// Romanian license plate validation and normalization

const RO_COUNTIES = [
  'AB', 'AR', 'AG', 'B', 'BC', 'BH', 'BN', 'BR', 'BT', 'BV', 'BZ',
  'CJ', 'CL', 'CS', 'CT', 'CV', 'DB', 'DJ', 'GL', 'GR', 'GJ', 'HD',
  'HR', 'IL', 'IS', 'IF', 'MM', 'MH', 'MS', 'NT', 'OT', 'PH', 'SJ',
  'SM', 'SV', 'TR', 'TM', 'TL', 'VS', 'VL', 'VN'
];

/**
 * Normalize Romanian plate: uppercase, no spaces/dashes
 * CT-05-EAM → CT05EAM
 */
export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[\s\-]/g, '');
}

/**
 * Validate Romanian plate format
 * Valid: CT05EAM, B123ABC, BH12XYZ
 * Invalid: ZZ99XXX (bad county), CT1A (bad format)
 */
export function isValidRoPlate(input: string): boolean {
  const normalized = normalizePlate(input);

  // Pattern: 1-2 letters (county) + 2-3 digits + 3 letters (no I, O, Q)
  const match = normalized.match(/^([A-Z]{1,2})(\d{2,3})([A-Z]{3})$/);
  if (!match) return false;

  const [, county, , letters] = match;

  // Check county code
  if (!RO_COUNTIES.includes(county)) return false;

  // Check letters (no I, O, Q allowed in RO plates)
  if (/[IOQ]/.test(letters)) return false;

  return true;
}

/**
 * Validate and normalize, or throw error with user message
 */
export function validateAndNormalizePlate(input: string): string {
  const normalized = normalizePlate(input);

  if (!isValidRoPlate(normalized)) {
    throw new Error(
      `Număr de înmatriculare invalid: "${input}". ` +
      `Format așteptat: cod județ (2 litere) + cifre (2-3) + litere (3, fără I/O/Q). ` +
      `Exemplu: CT-05-EAM, B-123-ABC`
    );
  }

  return normalized;
}
