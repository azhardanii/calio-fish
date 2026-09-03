import { prisma } from '@/lib/prisma';

/**
 * Fetch a setting value by key. Returns 0 if not found.
 */
export async function getSetting(key: string): Promise<number> {
  const setting = await prisma.reportSettings.findUnique({ where: { key } });
  return setting ? Number(setting.value) : 0;
}

/**
 * Get target for a specific marketing online platform
 */
export async function getOnlineTarget(platform: string): Promise<number> {
  return getSetting(`${platform.toLowerCase()}_target_mtd`);
}
