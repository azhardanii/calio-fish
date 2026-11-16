/**
 * Pencocokan teks bebas (mis. dari WhatsApp: "60gr", "90 g", "abon") ke Kategori (ProductType).
 * Dinamis: mengikuti kategori yang ada di database (CRUD), tidak ada nilai yang di-hardcode.
 */

export interface MatchableType {
  id: string;
  code: string;
  name: string;
}

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/(\d)\s*(gram|gr|g)\b/g, '$1 ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function numbersIn(s: string): string[] {
  return (s.match(/\d+/g) || []).map((n) => String(Number(n)));
}

function words(s: string): string[] {
  return norm(s)
    .split(' ')
    .filter((w) => w && !/^\d+$/.test(w));
}

/** Kembalikan kategori yang paling cocok, atau null jika tidak ada / ambigu. */
export function matchProductType<T extends MatchableType>(raw: string, types: T[]): T | null {
  const text = (raw || '').trim();
  if (!text || types.length === 0) return null;

  const rawLower = text.toLowerCase();
  const rawNorm = norm(text);
  const rawCompact = rawNorm.replace(/\s+/g, '');

  // 1. Kode / nama persis
  const exact = types.filter(
    (t) => t.code.toLowerCase() === rawLower || t.name.toLowerCase() === rawLower
  );
  if (exact.length === 1) return exact[0];

  // 2. Normalisasi (abaikan spasi / satuan gram)
  const normalized = types.filter((t) => {
    const c = norm(t.code).replace(/\s+/g, '');
    const n = norm(t.name).replace(/\s+/g, '');
    return rawCompact && (c === rawCompact || n === rawCompact);
  });
  if (normalized.length === 1) return normalized[0];

  // 3. Angka gramasi + (opsional) kata kunci
  const rawNums = numbersIn(rawNorm);
  const rawWords = words(text);
  if (rawNums.length > 0) {
    const byNum = types.filter((t) => {
      const nums = [...numbersIn(norm(t.code)), ...numbersIn(norm(t.name))];
      return rawNums.some((n) => nums.includes(n));
    });
    if (byNum.length === 1) return byNum[0];
    if (byNum.length > 1 && rawWords.length > 0) {
      const narrowed = byNum.filter((t) => {
        const tw = [...words(t.code), ...words(t.name)];
        return rawWords.some((w) => tw.includes(w));
      });
      if (narrowed.length === 1) return narrowed[0];
    }
    return null;
  }

  // 4. Kata kunci (mis. "abon")
  if (rawWords.length > 0) {
    const byWord = types.filter((t) => {
      const tw = [...words(t.code), ...words(t.name)];
      return rawWords.some((w) => tw.includes(w) || (w.length >= 3 && tw.some((x) => x.startsWith(w))));
    });
    if (byWord.length === 1) return byWord[0];
  }

  return null;
}
