/**
 * Alokasi varian rasa (PURE, tanpa akses database).
 *
 * Konteks: sales melapor per KATEGORI (mis. 20g terjual 10, 60g terjual 20).
 * Rincian varian rasa bersifat OPSIONAL. Jika tidak diisi, sistem menaksir
 * varian mana yang terjual berdasarkan komposisi barang yang pernah dikirim
 * ke outlet tersebut (varian yang lebih banyak dikirim dianggap lebih banyak
 * keluar), dibatasi oleh estimasi sisa stok tiap varian.
 */

export interface VariantStockInfo {
  productId: string;
  /** Estimasi sisa stok varian di outlet (OutletStock.quantity) */
  remaining: number;
  /** Total yang pernah dikirim ke outlet (bobot komposisi) */
  shipped: number;
}

export interface ManualVariantInput {
  productId: string;
  qty: number;
}

export interface VariantAllocation {
  productId: string;
  qty: number;
  source: 'MANUAL' | 'AUTO';
}

export interface AllocateVariantsResult {
  allocations: VariantAllocation[];
  /** Qty yang tidak bisa dibagi ke varian (data stok varian kurang). Stok kategori tetap berkurang. */
  unallocated: number;
}

/** Gabungkan entri varian dengan productId sama & buang qty <= 0 */
export function mergeManualVariants(list?: ManualVariantInput[]): ManualVariantInput[] {
  const map = new Map<string, number>();
  for (const v of list || []) {
    const q = Math.floor(Number(v.qty) || 0);
    if (!v.productId || q <= 0) continue;
    map.set(v.productId, (map.get(v.productId) || 0) + q);
  }
  return Array.from(map.entries()).map(([productId, qty]) => ({ productId, qty }));
}

interface DistItem {
  id: string;
  weight: number;
  cap: number;
}

/**
 * Bagi `rest` unit ke item secara proporsional terhadap bobot, dibatasi kapasitas.
 * Metode largest-remainder agar total tepat & deterministik.
 */
function distribute(rest: number, items: DistItem[]): Map<string, number> {
  const result = new Map<string, number>();
  let left = rest;
  let pool = items.filter((i) => i.cap > 0 && i.weight > 0).map((i) => ({ ...i }));
  let guard = items.length + 10;

  while (left > 0 && pool.length > 0 && guard-- > 0) {
    const totalW = pool.reduce((s, p) => s + p.weight, 0);
    const shares = pool.map((p) => {
      const exact = (left * p.weight) / totalW;
      const floor = Math.floor(exact);
      return { p, base: Math.min(p.cap, floor), frac: exact - floor };
    });

    let assigned = 0;
    for (const s of shares) {
      if (s.base > 0) {
        result.set(s.p.id, (result.get(s.p.id) || 0) + s.base);
        s.p.cap -= s.base;
        assigned += s.base;
      }
    }

    let remainder = left - assigned;
    const byFrac = [...shares].sort((a, b) => b.frac - a.frac);
    for (const s of byFrac) {
      if (remainder <= 0) break;
      if (s.p.cap > 0) {
        result.set(s.p.id, (result.get(s.p.id) || 0) + 1);
        s.p.cap -= 1;
        remainder -= 1;
      }
    }

    left = remainder;
    pool = pool.filter((p) => p.cap > 0);
  }

  return result;
}

/**
 * Alokasikan `qty` terjual satu kategori ke varian-variannya.
 * 1. Rincian manual dipakai apa adanya (otoritatif).
 * 2. Sisanya ditaksir otomatis berdasarkan komposisi kiriman, dibatasi sisa stok varian.
 */
export function allocateVariants(params: {
  qty: number;
  variants: VariantStockInfo[];
  manual?: ManualVariantInput[];
}): AllocateVariantsResult {
  const qty = Math.max(0, Math.floor(params.qty));
  const manual = mergeManualVariants(params.manual);
  const manualTotal = manual.reduce((s, m) => s + m.qty, 0);

  if (manualTotal > qty) {
    throw new Error(
      `Rincian varian (${manualTotal} pcs) melebihi total terjual kategori tersebut (${qty} pcs).`
    );
  }

  const allocations: VariantAllocation[] = manual.map((m) => ({
    productId: m.productId,
    qty: m.qty,
    source: 'MANUAL' as const,
  }));
  const manualMap = new Map(manual.map((m) => [m.productId, m.qty]));

  const rest = qty - manualTotal;
  if (rest === 0) return { allocations, unallocated: 0 };

  const items: DistItem[] = params.variants.map((v) => ({
    id: v.productId,
    weight: v.shipped > 0 ? v.shipped : 1,
    cap: Math.max(0, v.remaining - (manualMap.get(v.productId) || 0)),
  }));

  const auto = distribute(rest, items);
  let autoTotal = 0;
  for (const v of params.variants) {
    const a = auto.get(v.productId) || 0;
    if (a > 0) {
      allocations.push({ productId: v.productId, qty: a, source: 'AUTO' });
      autoTotal += a;
    }
  }

  return { allocations, unallocated: rest - autoTotal };
}

export interface VariantQty {
  productId: string;
  qty: number;
}

/**
 * Selaraskan total estimasi stok varian dengan stok kategori (mis. setelah stok opname).
 * - target < total: kurangi proporsional terhadap stok varian saat ini
 * - target > total: tambahkan proporsional terhadap komposisi kiriman (weights)
 * Return: qty baru per varian.
 */
export function reconcileVariantQuantities(params: {
  current: VariantQty[];
  target: number;
  weights?: Record<string, number>;
}): VariantQty[] {
  const target = Math.max(0, Math.floor(params.target));
  const current = params.current.map((c) => ({ productId: c.productId, qty: Math.max(0, c.qty) }));
  const total = current.reduce((s, c) => s + c.qty, 0);

  if (current.length === 0 || total === target) return current;

  if (target < total) {
    const toRemove = total - target;
    const removal = distribute(
      toRemove,
      current.map((c) => ({ id: c.productId, weight: c.qty, cap: c.qty }))
    );
    return current.map((c) => ({ productId: c.productId, qty: c.qty - (removal.get(c.productId) || 0) }));
  }

  const toAdd = target - total;
  const w = params.weights || {};
  const additions = distribute(
    toAdd,
    current.map((c) => ({
      id: c.productId,
      weight: (w[c.productId] || 0) > 0 ? w[c.productId] : 1,
      cap: Number.MAX_SAFE_INTEGER,
    }))
  );
  return current.map((c) => ({ productId: c.productId, qty: c.qty + (additions.get(c.productId) || 0) }));
}
