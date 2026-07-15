import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';
import { getOfflineTarget, getOnlineTarget } from '@/lib/settings';

export async function GET() {
  const [offlineReports, onlineReports, globalOfflineTarget, globalShopeeTarget, globalTiktokTarget, totalOutlets] = await Promise.all([
    prisma.marketingOffline.findMany({ orderBy: { date: 'desc' }, include: { employee: true } }),
    prisma.marketingOnline.findMany({ orderBy: { date: 'desc' }, include: { employee: true } }),
    getOfflineTarget(),
    getOnlineTarget('shopee'),
    getOnlineTarget('tiktok'),
    prisma.outlet.count(),
  ]);

  return NextResponse.json(serializeDeep({
    offlineReports,
    onlineReports,
    globalOfflineTarget,
    globalShopeeTarget,
    globalTiktokTarget,
    totalOutlets,
  }));
}
