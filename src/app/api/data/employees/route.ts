import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const employeeIdParam = searchParams.get('employeeId');

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (startDateParam && endDateParam) {
      periodStart = new Date(startDateParam);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(endDateParam);
      periodEnd.setHours(23, 59, 59, 999);
    } else {
      // Default to current month
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      periodStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      periodEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    }

    const attendanceWhere: any = {
      waktu: {
        gte: periodStart,
        lte: periodEnd,
      },
    };

    if (employeeIdParam && employeeIdParam !== 'ALL') {
      attendanceWhere.employee_id = employeeIdParam;
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [employees, attendances, todayAttendances] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { nama: 'asc' },
        include: {
          managed_outlets: {
            select: { id: true, nama: true, wilayah: true }
          }
        }
      }),
      prisma.attendance.findMany({
        where: attendanceWhere,
        orderBy: { waktu: 'desc' },
        include: { employee: true },
      }),
      prisma.attendance.findMany({
        where: {
          waktu: {
            gte: todayStart,
            lte: todayEnd,
          }
        },
        include: { employee: true },
      }),
    ]);

    return NextResponse.json(serializeDeep({ 
      employees, 
      attendances,
      todayAttendances,
      startDate: periodStart.toISOString(),
      endDate: periodEnd.toISOString(),
    }));
  } catch (error: any) {
    console.error('Error in /api/data/employees:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
