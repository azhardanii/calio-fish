import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(user);
}
