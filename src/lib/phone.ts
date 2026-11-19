/**
 * Utilitas normalisasi & pencarian nomor WhatsApp / HP Indonesia (08... <-> 628...).
 */
export function normalizeIndonesianPhone(raw: string | null | undefined): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return '62' + digits.slice(1);
  }
  if (digits.startsWith('8')) {
    return '62' + digits;
  }
  return digits;
}

export function toLocalZeroPhone(raw: string | null | undefined): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) {
    return '0' + digits.slice(2);
  }
  if (digits.startsWith('8')) {
    return '0' + digits;
  }
  return digits;
}

export function getPhoneLookupCandidates(raw: string | null | undefined): string[] {
  const clean = (raw || '').replace(/\D/g, '');
  const norm = normalizeIndonesianPhone(raw);
  const local = toLocalZeroPhone(raw);
  return Array.from(new Set([raw?.trim() || '', clean, norm, local].filter(Boolean)));
}

export function getPhoneTailKey(raw: string | null | undefined): string {
  const clean = (raw || '').replace(/\D/g, '');
  if (clean.length >= 9) return clean.slice(-9);
  if (clean.length >= 8) return clean.slice(-8);
  return clean;
}
