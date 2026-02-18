import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const unclassifiedInvoices = await prisma.invoice.findMany({
      where: { company: 'UNKNOWN' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      invoices: unclassifiedInvoices.map(inv => ({
        ...inv,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        date: inv.date?.toISOString() || null,
      })),
      count: unclassifiedInvoices.length,
    });
  } catch (error) {
    console.error('Error fetching unclassified invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unclassified invoices' },
      { status: 500 }
    );
  }
}
