import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all settings
export async function GET() {
  try {
    await prisma.reportSettings.deleteMany({ where: { key: 'offline_target_bulanan' } });
  } catch {}

  const settings = await prisma.reportSettings.findMany();
  const map: Record<string, number> = {};
  for (const s of settings) {
    map[s.key] = Number(s.value);
  }
  return NextResponse.json(map);
}

// PUT: Update a setting value
export async function PUT(req: Request) {
  const body = await req.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }

  const updated = await prisma.reportSettings.upsert({
    where: { key },
    update: { value },
    create: { key, value, label: key },
  });

  return NextResponse.json(updated);
}
