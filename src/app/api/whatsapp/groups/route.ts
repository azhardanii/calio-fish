import { NextResponse } from 'next/server';
import { getWhatsAppGroups } from '@/lib/whatsapp';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getWhatsAppGroups();
    console.log('GOWA Groups Response:', JSON.stringify(data).substring(0, 500));
    return NextResponse.json(data);
  } catch (error) {
    console.error('GOWA API Error:', error);
    return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 });
  }
}
