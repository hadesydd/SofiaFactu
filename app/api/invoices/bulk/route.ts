import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, invoiceIds } = body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: 'No invoice IDs provided' },
        { status: 400 }
      );
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'validate':
        updateData = { status: 'VALIDATED' };
        break;
      case 'delete':
        await prisma.invoice.deleteMany({
          where: { id: { in: invoiceIds } },
        });
        return NextResponse.json({ success: true, deleted: invoiceIds.length });
      case 'categorize':
        updateData = { category: body.category };
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    const result = await prisma.invoice.updateMany({
      where: { id: { in: invoiceIds } },
      data: updateData,
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error('Error processing bulk action:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk action' },
      { status: 500 }
    );
  }
}
