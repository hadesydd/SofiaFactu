import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { type InvoiceCompany, type InvoiceStatus, type Prisma } from '@prisma/client';

import { enqueueOcrJob, triggerOcrProcessing } from '@/lib/invoice-ocr';
import { prisma } from '@/lib/prisma';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'invoices');
const INVOICE_STATUSES: InvoiceStatus[] = ['TO_PROCESS', 'PROCESSING', 'PROCESSED', 'ERROR', 'VALIDATED'];

function mapCompanySlugToEnum(company: string | null): 'SOFIA_TRANSPORT' | 'SOFIANE_TRANSPORT' | 'GARAGE_EXPERTISE' | 'UNKNOWN' {
  if (!company) return 'UNKNOWN';

  const mapped: Record<string, 'SOFIA_TRANSPORT' | 'SOFIANE_TRANSPORT' | 'GARAGE_EXPERTISE' | 'UNKNOWN'> = {
    'sofia-transport': 'SOFIA_TRANSPORT',
    'sofiane-transport': 'SOFIANE_TRANSPORT',
    'garage-expertise': 'GARAGE_EXPERTISE',
    'unknown': 'UNKNOWN',
  };

  if (mapped[company]) {
    return mapped[company];
  }

  const upper = company.toUpperCase();
  if (upper === 'SOFIA_TRANSPORT' || upper === 'SOFIANE_TRANSPORT' || upper === 'GARAGE_EXPERTISE' || upper === 'UNKNOWN') {
    return upper;
  }

  return 'UNKNOWN';
}

export async function POST(request: NextRequest) {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const companyParam = formData.get('company') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop() || 'pdf';
    const filename = `${uuidv4()}.${ext}`;
    const filePath = join(UPLOAD_DIR, filename);

    await writeFile(filePath, buffer);

    const invoice = await prisma.invoice.create({
      data: {
        filename,
        originalName: file.name,
        filePath: `/uploads/invoices/${filename}`,
        mimeType: file.type,
        size: buffer.length,
        status: 'PROCESSING',
        company: mapCompanySlugToEnum(companyParam),
      },
    });

    await enqueueOcrJob(invoice.id);
    triggerOcrProcessing('api-upload', 2);

    return NextResponse.json(
      {
        ...invoice,
        queued: true,
        message: 'Invoice uploaded and queued for OCR processing',
      },
      { status: 202 },
    );
  } catch (error) {
    console.error('Error queuing invoice:', error);
    return NextResponse.json({ error: 'Failed to queue invoice' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const vendor = searchParams.get('vendor');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const search = searchParams.get('search');
    const period = searchParams.get('period');
    const company = searchParams.get('company');
    const cursor = searchParams.get('cursor');
    const limitRaw = searchParams.get('limit');

    const where: Prisma.InvoiceWhereInput = {};

    if (company && company !== 'all') {
      const companyMap: Record<string, InvoiceCompany> = {
        'sofia-transport': 'SOFIA_TRANSPORT',
        'sofiane-transport': 'SOFIANE_TRANSPORT',
        'garage-expertise': 'GARAGE_EXPERTISE',
      };
      where.company = companyMap[company] || mapCompanySlugToEnum(company);
    }

    if (status && status !== 'all') {
      const normalizedStatus = status.toUpperCase() as InvoiceStatus;
      if (INVOICE_STATUSES.includes(normalizedStatus)) {
        where.status = normalizedStatus;
      }
    }

    if (vendor && vendor !== 'all') {
      where.vendor = { contains: vendor, mode: 'insensitive' };
    }

    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseFloat(minAmount);
      if (maxAmount) where.amount.lte = parseFloat(maxAmount);
    }

    if (search) {
      where.OR = [
        { vendor: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
        { ocrText: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (period) {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          break;
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          break;
        case 'thisYear':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }

      where.createdAt = { gte: startDate };
    }

    const parsedLimit = limitRaw ? Math.max(1, Math.min(200, Number(limitRaw))) : null;

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(parsedLimit ? { take: parsedLimit } : {}),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const totalCount = await prisma.invoice.count({ where });
    const companyFilter = where.company ? { company: where.company } : undefined;

    const counts = await prisma.invoice.groupBy({
      by: ['status'],
      _count: true,
      where: companyFilter,
    });

    const unclassifiedCount = await prisma.invoice.count({
      where: { company: 'UNKNOWN' },
    });

    const nextCursor = parsedLimit && invoices.length === parsedLimit ? invoices[invoices.length - 1]?.id : null;

    return NextResponse.json({
      invoices,
      nextCursor,
      counts: {
        total: totalCount,
        toProcess: counts.find((c) => c.status === 'TO_PROCESS')?._count || 0,
        processing: counts.find((c) => c.status === 'PROCESSING')?._count || 0,
        processed: counts.find((c) => c.status === 'PROCESSED')?._count || 0,
        error: counts.find((c) => c.status === 'ERROR')?._count || 0,
        validated: counts.find((c) => c.status === 'VALIDATED')?._count || 0,
        unclassified: unclassifiedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
