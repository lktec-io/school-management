/**
 * Normalise a Tanzanian mobile number to the international format Beem expects (255XXXXXXXXX).
 * Accepts 0777123456, 777123456, +255777123456, 255 777 123 456, etc.
 * Returns null when the input is not a valid Tanzanian mobile number.
 */
export function normalizeTzPhone(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let digits = String(input).replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith('255')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  // Tanzanian mobile numbers: 9 digits starting with 6 or 7.
  if (!/^[67]\d{8}$/.test(digits)) return null;
  return `255${digits}`;
}
