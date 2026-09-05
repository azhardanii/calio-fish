import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    let startDateParam: string | null = null;
    let endDateParam: string | null = null;
    let employeeIdParam: string | null = null;

    try {
      const url = new URL(req.url, 'http://localhost:3000');
      startDateParam = url.searchParams.get('startDate');
      endDateParam = url.searchParams.get('endDate');
      employeeIdParam = url.searchParams.get('employeeId');
    } catch (e) {
      console.warn('Failed to parse employee query params:', e);
    }

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

    // Run queries defensively
    let employees: any[] = [];
    let attendances: any[] = [];
    let todayAttendances: any[] = [];

    try {
      employees = await prisma.employee.findMany({
        orderBy: { nama: 'asc' },
        include: {
          managed_outlets: {
            select: { id: true, nama: true, wilayah: true }
          }
        }
      });
    } catch (empErr) {
      console.error('Error fetching employees with managed_outlets:', empErr);
      // Fallback without managed_outlets relation if that was the issue
      try {
        employees = await prisma.employee.findMany({
          orderBy: { nama: 'asc' }
        });
      } catch (fallbackErr) {
        console.error('Fallback employee fetch failed:', fallbackErr);
        employees = [];
      }
    }

    try {
      attendances = await prisma.attendance.findMany({
        where: attendanceWhere,
        orderBy: { waktu: 'desc' },
        include: { employee: true },
      });
    } catch (attErr) {
      console.error('Error fetching attendances:', attErr);
      attendances = [];
    }

    try {
      todayAttendances = await prisma.attendance.findMany({
        where: {
          waktu: {
            gte: todayStart,
            lte: todayEnd,
          }
        },
        include: { employee: true },
      });
    } catch (todayErr) {
      console.error('Error fetching today attendances:', todayErr);
      todayAttendances = [];
    }

    return NextResponse.json(serializeDeep({ 
      employees: employees || [], 
      attendances: attendances || [],
      todayAttendances: todayAttendances || [],
      startDate: periodStart.toISOString(),
      endDate: periodEnd.toISOString(),
    }));
  } catch (error: any) {
    console.error('Critical error in /api/data/employees:', error);
    // Return empty dataset instead of 500 so UI doesn't crash
    return NextResponse.json({ 
      employees: [], 
      attendances: [],
      todayAttendances: [],
      error: error.message || 'Internal Server Error' 
    });
  }
}
