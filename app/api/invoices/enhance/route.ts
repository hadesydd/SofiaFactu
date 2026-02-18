import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractMissingFields } from '@/lib/mistral-ocr';

export async function POST(request: NextRequest) {
  try {
    // Récupérer toutes les factures qui ont du texte OCR
    const invoices = await prisma.invoice.findMany({
      where: {
        ocrText: {
          not: null,
        },
      },
      select: {
        id: true,
        ocrText: true,
        vendor: true,
        amount: true,
        vatAmount: true,
        date: true,
        invoiceNumber: true,
        iban: true,
        email: true,
        phone: true,
        siret: true,
        address: true,
      },
    });

    let updatedCount = 0;

    for (const invoice of invoices) {
      if (!invoice.ocrText) continue;

      // Vérifier quels champs sont vides
      const existingData = {
        vendor: invoice.vendor,
        amount: invoice.amount,
        vatAmount: invoice.vatAmount,
        date: invoice.date,
        invoiceNumber: invoice.invoiceNumber,
        iban: invoice.iban,
        email: invoice.email,
        phone: invoice.phone,
        siret: invoice.siret,
        address: invoice.address,
      };

      // Extraire uniquement les champs manquants
      const missingData = extractMissingFields(invoice.ocrText, existingData);

      // Si on a trouvé des données manquantes, mettre à jour
      if (Object.keys(missingData).length > 0) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: missingData,
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      message: updatedCount > 0 
        ? `${updatedCount} facture(s) mise(s) à jour avec succès`
        : 'Toutes les données sont complètes',
    });
  } catch (error) {
    console.error('Error enhancing invoices:', error);
    return NextResponse.json(
      { error: 'Failed to enhance invoices' },
      { status: 500 }
    );
  }
}
