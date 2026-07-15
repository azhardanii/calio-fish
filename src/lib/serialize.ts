import { Decimal } from '@prisma/client/runtime/library';

/**
 * Deep-serialize a Prisma result object for safe JSON transfer to Client Components.
 * - Decimal → number
 * - Date → ISO string
 * - Recursively handles arrays and nested objects
 */
export function serializeDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  // Safe check for Prisma Decimal (decimal.js)
  if (typeof obj === 'object' && obj !== null) {
    if (obj.constructor.name === 'Decimal' || ('d' in obj && 'e' in obj && 's' in obj && typeof (obj as any).toNumber === 'function')) {
      return Number(obj) as unknown as T;
    }
  }

  if (obj instanceof Date) {
    return obj.toISOString() as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => serializeDeep(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDeep(value);
    }
    return result as T;
  }

  return obj;
}
