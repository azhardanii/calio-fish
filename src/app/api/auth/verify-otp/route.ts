import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import {
  getPhoneLookupCandidates,
  getPhoneTailKey,
  normalizeIndonesianPhone,
} from '@/lib/phone';

export async function POST(req: Request) {
  try {
    const { no_hp, otp } = await req.json();
    const formattedPhone = normalizeIndonesianPhone(no_hp);
    const candidates = getPhoneLookupCandidates(no_hp);
    const tailKey = getPhoneTailKey(no_hp);

    if (!formattedPhone || !otp) return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          ...candidates.map((c) => ({ no_hp: c })),
          ...(tailKey.length >= 8 ? [{ no_hp: { endsWith: tailKey } }] : []),
        ],
      },
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

    const roleRaw = (employee.role || '').toUpperCase();
    const posisiRaw = (employee.posisi || '').toUpperCase();
    let normalizedRole = 'STAFF';
    let redirectUrl = '/overview';

    if (roleRaw === 'OWNER' || roleRaw.includes('OWNER') || posisiRaw.includes('OWNER')) {
      normalizedRole = 'OWNER';
      redirectUrl = '/overview';
    } else if (roleRaw === 'ADMIN' || roleRaw.includes('ADMIN') || posisiRaw.includes('ADMIN')) {
      normalizedRole = 'ADMIN';
      redirectUrl = '/overview';
    } else if (roleRaw.includes('DISTRIBUTOR') || posisiRaw.includes('DISTRIBUTOR')) {
      normalizedRole = 'DISTRIBUTOR';
      redirectUrl = '/warehouse';
    } else if (roleRaw === 'STAFF MARKETING' || roleRaw === 'STAFF_MARKETING' || roleRaw.includes('MARKETING') || posisiRaw.includes('MARKETING')) {
      normalizedRole = 'MARKETING';
      redirectUrl = '/marketing';
    } else if (roleRaw === 'STAFF PRODUKSI' || roleRaw === 'STAFF_PRODUKSI' || roleRaw.includes('PRODUKSI') || posisiRaw.includes('PRODUKSI')) {
      normalizedRole = 'PRODUKSI';
      redirectUrl = '/produksi';
    } else if (roleRaw.includes('MITRA') || posisiRaw.includes('MITRA')) {
      normalizedRole = 'MITRA';
      redirectUrl = '/outlet';
    }

    // Create session
    await createSession({
      id: employee.id,
      role: normalizedRole,
      nama: employee.nama,
      posisi: employee.posisi,
    });

    return NextResponse.json({ success: true, redirectUrl });
  } catch (error) {
    console.error('OTP verify error:', error);
    return NextResponse.json({ error: 'Gagal verifikasi OTP' }, { status: 500 });
  }
}
