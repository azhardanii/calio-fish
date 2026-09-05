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
    let periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    let periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (startDateParam) {
      const parsedStart = new Date(startDateParam);
      if (!isNaN(parsedStart.getTime())) {
        periodStart = parsedStart;
        periodStart.setHours(0, 0, 0, 0);
      }
    }

    if (endDateParam) {
      const parsedEnd = new Date(endDateParam);
      if (!isNaN(parsedEnd.getTime())) {
        periodEnd = parsedEnd;
        periodEnd.setHours(23, 59, 59, 999);
      }
    } else if (startDateParam) {
      periodEnd = new Date(periodStart);
      periodEnd.setHours(23, 59, 59, 999);
    }

    if (periodStart > periodEnd) {
      const temp = periodStart;
      periodStart = periodEnd;
      periodEnd = temp;
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
