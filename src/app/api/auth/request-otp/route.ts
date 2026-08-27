import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMessage } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { no_hp } = await req.json();
    if (!no_hp) return NextResponse.json({ error: 'Nomor HP wajib diisi' }, { status: 400 });

    let formattedPhone = no_hp.replace(/\D/g, ''); // remove non-digits
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }

    const employee = await prisma.employee.findUnique({
      where: { no_hp: formattedPhone },
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


    const message = `*Calio Fish - Kode OTP*\n\nKode rahasia Anda adalah: *${otp}*\n\nBerlaku selama 5 menit. JANGAN BERIKAN KODE INI KEPADA SIAPAPUN.`;
    
    await sendMessage(formattedPhone, message);

    return NextResponse.json({ success: true, message: 'OTP terkirim' });
  } catch (error) {
    console.error('OTP request error:', error);
    return NextResponse.json({ error: 'Gagal mengirim OTP' }, { status: 500 });
  }
}
