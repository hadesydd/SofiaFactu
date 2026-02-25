import { NextResponse } from 'next/server';
import { type InvoiceCompany } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const BATCH_SIZE = 100;
const CONCURRENCY = 5;

export async function POST() {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        company: {
          not: 'UNKNOWN',
        },
        ocrText: {
          not: null,
        },
      },
      select: {
        id: true,
        ocrText: true,
        vendor: true,
        company: true,
      },
    });

    let changes = 0;

    for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
      const batch = invoices.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < batch.length; j += CONCURRENCY) {
        const chunk = batch.slice(j, j + CONCURRENCY);

        const results = await Promise.all(
          chunk.map(async (invoice) => {
            if (!invoice.ocrText) return false;

            const ocrText = invoice.ocrText.toLowerCase();
            const vendorLower = (invoice.vendor || '').toLowerCase();
            const cleanVendorLower = vendorLower.replace(/[^a-z0-9]/g, '');
            const cleanTextLower = ocrText.replace(/[^a-z0-9]/g, '');

            let detectedCompany: InvoiceCompany | null = null;

            if (
              cleanVendorLower.includes('sofian') ||
              cleanVendorLower.includes('sofiane') ||
              /\bsofiane\b/i.test(vendorLower) ||
              /\bsofiane\s*transport/i.test(vendorLower)
            ) {
              detectedCompany = 'SOFIANE_TRANSPORT';
            } else if (
              (cleanVendorLower === 'sofia' || cleanVendorLower.includes('sofia')) &&
              !cleanVendorLower.includes('sofian')
            ) {
              detectedCompany = 'SOFIA_TRANSPORT';
            } else if (
              cleanVendorLower.includes('garage') ||
              cleanVendorLower.includes('expertise') ||
              cleanVendorLower.includes('mecanique') ||
              cleanVendorLower.includes('mécanique') ||
              cleanVendorLower.includes('automobile')
            ) {
              detectedCompany = 'GARAGE_EXPERTISE';
            }

            if (!detectedCompany) {
              if (/\bsofiane\b/i.test(cleanTextLower) || /\bsofiane\s*transport\b/i.test(cleanTextLower)) {
                detectedCompany = 'SOFIANE_TRANSPORT';
              } else if (
                /\bsofia\b/i.test(cleanTextLower) &&
                !/\bsofiane\b/i.test(cleanTextLower) &&
                !cleanTextLower.includes('sofiane')
              ) {
                detectedCompany = 'SOFIA_TRANSPORT';
              } else if (/\bgarage\b/i.test(cleanTextLower) || /\bgarage\s*expertise\b/i.test(cleanTextLower)) {
                detectedCompany = 'GARAGE_EXPERTISE';
              }
            }

            if (detectedCompany && detectedCompany !== invoice.company) {
              await prisma.invoice.update({
                where: { id: invoice.id },
                data: { company: detectedCompany },
              });
              return true;
            }

            return false;
          }),
        );

        changes += results.filter(Boolean).length;
      }
    }

    return NextResponse.json({
      success: true,
      changes,
      message:
        changes > 0
          ? `${changes} facture(s) déplacée(s)`
          : 'Aucune modification nécessaire - tout était déjà synchronisé',
    });
  } catch (error) {
    console.error('Error syncing invoices:', error);
    return NextResponse.json({ error: 'Failed to sync invoices' }, { status: 500 });
  }
}
