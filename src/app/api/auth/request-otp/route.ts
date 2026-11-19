import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMessage } from '@/lib/whatsapp';
import {
  getPhoneLookupCandidates,
  getPhoneTailKey,
  normalizeIndonesianPhone,
} from '@/lib/phone';

export async function POST(req: Request) {
  try {
    const { no_hp } = await req.json();
    if (!no_hp) return NextResponse.json({ error: 'Nomor HP wajib diisi' }, { status: 400 });

    const formattedPhone = normalizeIndonesianPhone(no_hp);
    const candidates = getPhoneLookupCandidates(no_hp);
    const tailKey = getPhoneTailKey(no_hp);

    let employee = await prisma.employee.findFirst({
      where: {
        OR: [
          ...candidates.map((c) => ({ no_hp: c })),
          ...(tailKey.length >= 8 ? [{ no_hp: { endsWith: tailKey } }] : []),
        ],
      },
    });

    if (!employee || !employee.status_aktif) {
      return NextResponse.json({ error: 'Nomor HP tidak terdaftar atau akun tidak aktif' }, { status: 404 });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        otp_code: otp,
        otp_expires: expires,
      },
    });

    const waRecipient = normalizeIndonesianPhone(employee.no_hp) || formattedPhone;
    const message = `*Calio Fish - Kode OTP*\n\nKode rahasia Anda adalah: *${otp}*\n\nBerlaku selama 5 menit. JANGAN BERIKAN KODE INI KEPADA SIAPAPUN.`;

    const sendRes: any = await sendMessage(waRecipient, message);
    if (sendRes?.status === 'error') {
      console.error('OTP WhatsApp send failed:', sendRes);
      return NextResponse.json(
        {
          error: `OTP dibuat tapi gagal terkirim via WhatsApp (${sendRes?.message || 'periksa koneksi GOWA'}).`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: 'OTP terkirim' });
  } catch (error) {
    console.error('OTP request error:', error);
    return NextResponse.json({ error: 'Gagal mengirim OTP' }, { status: 500 });
  }
}
