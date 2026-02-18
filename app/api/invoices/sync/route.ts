import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Get all invoices that are NOT UNKNOWN
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

    // For each invoice, re-run detection logic
    for (const invoice of invoices) {
      if (!invoice.ocrText) continue;

      const ocrText = invoice.ocrText.toLowerCase();
      const vendorLower = (invoice.vendor || '').toLowerCase();
      const cleanVendorLower = vendorLower.replace(/[^a-z0-9]/g, '');
      const cleanTextLower = ocrText.replace(/[^a-z0-9]/g, '');

      let detectedCompany: string | null = null;

      // Check vendor first
      if (
        cleanVendorLower.includes('sofian') || 
        cleanVendorLower.includes('sofiane') ||
        /\bsofiane\b/i.test(vendorLower) ||
        /\bsofiane\s*transport/i.test(vendorLower)
      ) {
        detectedCompany = 'SOFIANE_TRANSPORT';
      }
      else if (
        (cleanVendorLower === 'sofia' || cleanVendorLower.includes('sofia')) &&
        !cleanVendorLower.includes('sofian')
      ) {
        detectedCompany = 'SOFIA_TRANSPORT';
      }
      else if (
        cleanVendorLower.includes('garage') || 
        cleanVendorLower.includes('expertise') ||
        cleanVendorLower.includes('mecanique') ||
        cleanVendorLower.includes('mécanique') ||
        cleanVendorLower.includes('automobile')
      ) {
        detectedCompany = 'GARAGE_EXPERTISE';
      }

      // If no vendor match, check OCR text
      if (!detectedCompany) {
        if (
          /\bsofiane\b/i.test(cleanTextLower) ||
          /\bsofiane\s*transport\b/i.test(cleanTextLower)
        ) {
          detectedCompany = 'SOFIANE_TRANSPORT';
        }
        else if (
          /\bsofia\b/i.test(cleanTextLower) &&
          !/\bsofiane\b/i.test(cleanTextLower) &&
          !cleanTextLower.includes('sofiane')
        ) {
          detectedCompany = 'SOFIA_TRANSPORT';
        }
        else if (
          /\bgarage\b/i.test(cleanTextLower) ||
          /\bgarage\s*expertise\b/i.test(cleanTextLower)
        ) {
          detectedCompany = 'GARAGE_EXPERTISE';
        }
      }

      // If detected company is different from current company, update it
      if (detectedCompany && detectedCompany !== invoice.company) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { company: detectedCompany as any },
        });
        changes++;
      }
    }

    return NextResponse.json({
      success: true,
      changes,
      message: changes > 0 
        ? `${changes} facture(s) déplacée(s)` 
        : 'Aucune modification nécessaire - tout était déjà synchronisé',
    });
  } catch (error) {
    console.error('Error syncing invoices:', error);
    return NextResponse.json(
      { error: 'Failed to sync invoices' },
      { status: 500 }
    );
  }
}
