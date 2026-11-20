/**
 * Pencocokan kunci/nama produk bebas (mis. dari AI parser atau chat WhatsApp)
 * ke record Product di database berdasarkan SKU, short_name, name, alias rasa, dan kategori/gramasi.
 */

export interface MatchableProduct {
  id: string;
  sku: string;
  name: string;
  short_name: string;
  category?: string | null;
  product_type_id?: string | null;
  is_active?: boolean;
  product_type?: {
    id?: string;
    code?: string;
    name?: string;
  } | null;
}

const TOKEN_SYNONYMS: Record<string, string[]> = {
  fs: ['fish', 'skin'],
  ori: ['original'],
  sm: ['sambal', 'matah'],
  ab: ['abon'],
  tna: ['tuna'],
};

function normalizeText(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/(\d+)\s*(gram|gr|g)\b/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactText(raw: string): string {
  return normalizeText(raw).replace(/\s+/g, '');
}

function expandTokens(raw: string): Set<string> {
  const base = normalizeText(raw).split(' ').filter(Boolean);
  const tokens = new Set<string>(base);
  for (const t of base) {
    const syns = TOKEN_SYNONYMS[t];
    if (syns) {
      for (const s of syns) tokens.add(s);
    }
  }
  return tokens;
}

function extractNumbers(raw: string): string[] {
  return (normalizeText(raw).match(/\d+/g) || []).map((n) => String(Number(n)));
}

/**
 * Mencari produk yang paling cocok dari daftar `products`.
 * Mengembalikan `null` jika tidak ada kecocokan atau masih ambigu (seri antara beberapa varian berbeda gramasi).
 */
export function resolveProductMatch<T extends MatchableProduct>(
  rawKey: string | null | undefined,
  products: T[],
  options?: { preferActive?: boolean }
): T | null {
  const key = (rawKey || '').trim();
  if (!key || products.length === 0) return null;

  const preferActive = options?.preferActive !== false;
  const activePool = products.filter((p) => p.is_active !== false);
  const pool = preferActive && activePool.length > 0 ? activePool : products;

  const keyLower = key.toLowerCase();
  const keyCompact = compactText(key);
  const keyNorm = normalizeText(key);

  // 1. Persis SKU (case-insensitive)
  const exactSku = pool.find((p) => p.sku.toLowerCase() === keyLower);
  if (exactSku) return exactSku;
  if (pool !== products) {
    const inactiveSku = products.find((p) => p.sku.toLowerCase() === keyLower);
    if (inactiveSku) return inactiveSku;
  }

  // 2. Compact SKU (mis. "FS SM 60" / "fs_sm_60" -> "FS-SM-60")
  if (keyCompact) {
    const compactSku = pool.filter((p) => compactText(p.sku) === keyCompact);
    if (compactSku.length === 1) return compactSku[0];
  }

  // 3. Exact normalized name / short_name
  if (keyNorm) {
    const exactLabel = pool.filter(
      (p) => normalizeText(p.short_name) === keyNorm || normalizeText(p.name) === keyNorm
    );
    if (exactLabel.length === 1) return exactLabel[0];
  }

  // 4. Token + number scoring (memperhitungkan short_name, name, sku, dan product_type/category)
  const queryTokens = expandTokens(key);
  const queryNums = extractNumbers(key);
  if (queryTokens.size === 0) return null;

  let bestScore = 0;
  let bestMatches: T[] = [];

  for (const p of pool) {
    const typeLabel = p.product_type?.name || p.product_type?.code || p.category || '';
    const candidateStr = `${p.sku} ${p.short_name} ${p.name} ${typeLabel}`;
    const candidateTokens = expandTokens(candidateStr);
    const candidateNums = extractNumbers(`${p.sku} ${p.short_name} ${p.name} ${typeLabel}`);

    // Jika pesan menyebut angka gramasi (mis. 20 / 60 / 90), pastikan produk juga punya angka itu
    if (queryNums.length > 0) {
      const hasAllNums = queryNums.every((n) => candidateNums.includes(n));
      if (!hasAllNums) continue;
    }

    let matched = 0;
    let nonNumericMatched = 0;
    for (const qt of queryTokens) {
      const isNum = /^\d+$/.test(qt);
      if (candidateTokens.has(qt)) {
        matched += isNum ? 1.5 : 2;
        if (!isNum) nonNumericMatched++;
      } else if (!isNum && qt.length >= 3) {
        for (const ct of candidateTokens) {
          if (!/^\d+$/.test(ct) && (ct.startsWith(qt) || qt.startsWith(ct))) {
            matched += 1;
            nonNumericMatched++;
            break;
          }
        }
      }
    }

    // Harus minimal cocok 1 kata non-angka (rasa/jenis, bukan cuma angka "60" saja)
    if (nonNumericMatched === 0) continue;

    // Bonus jika hampir seluruh token query cocok
    const coverage = matched / (queryTokens.size * 2);
    const score = matched + coverage;

    if (score > bestScore + 0.001) {
      bestScore = score;
      bestMatches = [p];
    } else if (Math.abs(score - bestScore) <= 0.001) {
      bestMatches.push(p);
    }
  }

  if (bestMatches.length === 1) return bestMatches[0];
  return null;
}
