import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { parseInvoiceWithMistral } from '@/lib/mistral-ocr';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'invoices');

export async function POST(request: NextRequest) {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
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
      },
    });

    const ocrResult = await parseInvoiceWithMistral(buffer, file.name);

    console.log('OCR Result:', ocrResult);

    if (ocrResult.success && ocrResult.parsedData) {
      let parsedDate: Date | null = null;
      if (ocrResult.parsedData.date) {
        try {
          if (ocrResult.parsedData.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = ocrResult.parsedData.date.split('-');
            if (parts.length === 3) {
              const year = parseInt(parts[0]);
              const month = parseInt(parts[1]);
              const day = parseInt(parts[2]);
              if (year > 2000 && year < 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                parsedDate = new Date(year, month - 1, day);
              }
            }
          } else {
            const dateParts = ocrResult.parsedData.date.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
            if (dateParts) {
              let day = parseInt(dateParts[1]);
              let month = parseInt(dateParts[2]);
              let year = parseInt(dateParts[3]);
              if (year < 100) year += 2000;
              if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                parsedDate = new Date(year, month - 1, day);
              }
            }
            if (!parsedDate || isNaN(parsedDate.getTime())) {
              const parts = ocrResult.parsedData.date.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
              if (parts) {
                parsedDate = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
              }
            }
          }
          if (isNaN(parsedDate?.getTime() || NaN)) {
            parsedDate = null;
          }
        } catch {
          parsedDate = null;
        }
      }

      // Extract additional data from OCR text
      const cleanText = ocrResult.text?.replace(/\s+/g, ' ') || '';
      
      const ibanMatch = cleanText.match(/FR\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}/i);
      const iban = ibanMatch ? ibanMatch[0].toUpperCase().replace(/\s/g, ' ') : null;
      
      const emailMatch = cleanText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch ? emailMatch[0] : null;
      
      const phoneMatch = cleanText.match(/(?:tel|téléphone|phone)[\s:.]*\s*(\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/i);
      const phone = phoneMatch ? phoneMatch[1] : null;
      
      const siretMatch = cleanText.match(/\b\d{14}\b/);
      const siret = siretMatch ? siretMatch[0] : null;
      
      const addressMatch = cleanText.match(/(\d+[\s,]+[A-Z][a-zéèêëàâäùûüôöîï]+[\s,]+[A-Z]{2,5})/);
      const address = addressMatch ? addressMatch[0] : null;

      // Create or update vendor client
      let vendorClient = null;
      if (ocrResult.parsedData.vendor) {
        // Find or create default cabinet
        let cabinet = await prisma.user.findFirst({
          where: { role: 'CABINET' }
        });
        
        if (!cabinet) {
          cabinet = await prisma.user.create({
            data: {
              email: 'default@cabinet.local',
              name: 'Default Cabinet',
              role: 'CABINET',
            }
          });
        }

        vendorClient = await prisma.client.upsert({
          where: { 
            name_cabinetId: {
              name: ocrResult.parsedData.vendor,
              cabinetId: cabinet.id
            }
          },
          create: {
            name: ocrResult.parsedData.vendor,
            email: email,
            telephone: phone,
            siret: siret,
            adresse: address,
            cabinetId: cabinet.id,
          },
          update: {
            email: email,
            telephone: phone,
            siret: siret,
            adresse: address,
          },
        });
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          ocrText: ocrResult.text,
          vendor: ocrResult.parsedData.vendor,
          clientName: ocrResult.parsedData.clientName,
          invoiceNumber: ocrResult.parsedData.invoiceNumber,
          amount: ocrResult.parsedData.amount,
          vatAmount: ocrResult.parsedData.vatAmount,
          date: parsedDate,
          confidence: ocrResult.parsedData.confidence,
          company: ocrResult.parsedData.company ? ocrResult.parsedData.company as any : 'UNKNOWN',
          status: ocrResult.parsedData.confidence >= 80 ? 'PROCESSED' : 'TO_PROCESS',
          iban: ocrResult.parsedData.iban,
          email: ocrResult.parsedData.email,
          phone: ocrResult.parsedData.phone,
          siret: ocrResult.parsedData.siret,
          address: ocrResult.parsedData.address,
        },
      });
    } else {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          ocrText: ocrResult.text || '',
          status: 'ERROR',
        },
      });
    }

    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Error processing invoice:', error);
    return NextResponse.json(
      { error: 'Failed to process invoice' },
      { status: 500 }
    );
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

    const where: Record<string, unknown> = {};

    if (company && company !== 'all') {
      const companyMap: Record<string, string> = {
        'sofia-transport': 'SOFIA_TRANSPORT',
        'sofiane-transport': 'SOFIANE_TRANSPORT',
        'garage-expertise': 'GARAGE_EXPERTISE',
      };
      where.company = companyMap[company] || company.toUpperCase();
    }

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    if (vendor && vendor !== 'all') {
      where.vendor = vendor;
    }

    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) (where.amount as Record<string, number>).gte = parseFloat(minAmount);
      if (maxAmount) (where.amount as Record<string, number>).lte = parseFloat(maxAmount);
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

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Get counts filtered by company if specified
    const countWhere = { ...where };
    delete (countWhere as any).skip;
    delete (countWhere as any).take;
    delete (countWhere as any).orderBy;

    const counts = await prisma.invoice.groupBy({
      by: ['status'],
      _count: true,
      where: company ? { company: where.company as any } : undefined,
    });

    // Get unclassified invoices count (company = UNKNOWN)
    const unclassifiedCount = await prisma.invoice.count({
      where: { company: 'UNKNOWN' },
    });

    return NextResponse.json({
      invoices,
      counts: {
        total: invoices.length,
        toProcess: counts.find(c => c.status === 'TO_PROCESS')?._count || 0,
        processing: counts.find(c => c.status === 'PROCESSING')?._count || 0,
        processed: counts.find(c => c.status === 'PROCESSED')?._count || 0,
        error: counts.find(c => c.status === 'ERROR')?._count || 0,
        validated: counts.find(c => c.status === 'VALIDATED')?._count || 0,
        unclassified: unclassifiedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}
