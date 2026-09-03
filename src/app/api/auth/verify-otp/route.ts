import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { no_hp, otp } = await req.json();
    let formattedPhone = no_hp.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }

    if (!formattedPhone || !otp) return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });

    const employee = await prisma.employee.findUnique({
      where: { no_hp: formattedPhone },
    });

    if (!employee || !employee.status_aktif) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    if (employee.otp_code !== otp || !employee.otp_expires || new Date() > employee.otp_expires) {
      return NextResponse.json({ error: 'OTP salah atau sudah kedaluwarsa' }, { status: 400 });
    }

    // Clear OTP
    await prisma.employee.update({
      where: { id: employee.id },
      data: { otp_code: null, otp_expires: null },
    });

    // Create session
    await createSession({
      id: employee.id,
      role: employee.role,
      nama: employee.nama,
    });

    const role = (employee.role || '').toUpperCase();
    const posisi = (employee.posisi || '').toUpperCase();
    let redirectUrl = '/overview';
    if (role === 'STAFF MARKETING' || role === 'STAFF_MARKETING' || role.includes('MARKETING') || posisi.includes('MARKETING')) {
      redirectUrl = '/marketing';
    } else if (role === 'STAFF PRODUKSI' || role === 'STAFF_PRODUKSI' || role.includes('PRODUKSI') || posisi.includes('PRODUKSI')) {
      redirectUrl = '/produksi';
    } else if (role.includes('MITRA') || posisi.includes('MITRA')) {
      redirectUrl = '/outlet';
    }

    return NextResponse.json({ success: true, redirectUrl });
  } catch (error) {
    console.error('OTP verify error:', error);
    return NextResponse.json({ error: 'Gagal verifikasi OTP' }, { status: 500 });
  }
}
