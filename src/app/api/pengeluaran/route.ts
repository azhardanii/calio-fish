import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';
import { serializeDeep } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    
    let dateFilter = {};
    if (fromParam && toParam) {
      dateFilter = {
        gte: new Date(`${fromParam}T00:00:00.000`),
        lte: new Date(`${toParam}T23:59:59.999`)
      };
    } else {
      const now = new Date();
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      };
    }

    const expenses = await prisma.expense.findMany({
      where: { date: dateFilter },
      include: { employee: { select: { nama: true } } },
      orderBy: { date: 'desc' }
    });

    const total = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { date: dateFilter }
    });

    return NextResponse.json(serializeDeep({
      data: expenses,
      total: Number(total._sum.amount || 0)
    }));
  } catch (error: any) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, amount, date, category, description, employee_id } = body;

    const expense = await prisma.expense.create({
      data: {
        title,
        amount,
        date: new Date(date),
        category: category || 'OPERASIONAL',
        description,
        employee_id: employee_id || session.id
      }
    });

    return NextResponse.json(serializeDeep(expense));
  } catch (error: any) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, amount, date, category, description } = body;

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        title,
        amount,
        date: new Date(date),
        category,
        description
      }
    });

    return NextResponse.json(serializeDeep(expense));
  } catch (error: any) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.expense.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
