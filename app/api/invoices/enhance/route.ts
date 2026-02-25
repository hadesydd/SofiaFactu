import { NextResponse } from 'next/server';

import { extractMissingFields } from '@/lib/mistral-ocr';
import { prisma } from '@/lib/prisma';

const BATCH_SIZE = 100;
const CONCURRENCY = 5;

export async function POST() {
  try {
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

    for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
      const batch = invoices.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < batch.length; j += CONCURRENCY) {
        const chunk = batch.slice(j, j + CONCURRENCY);

        const results = await Promise.all(
          chunk.map(async (invoice) => {
            if (!invoice.ocrText) return false;

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

            const missingData = extractMissingFields(invoice.ocrText, existingData);
            if (Object.keys(missingData).length === 0) return false;

            await prisma.invoice.update({
              where: { id: invoice.id },
              data: missingData,
            });

            return true;
          }),
        );

        updatedCount += results.filter(Boolean).length;
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      message:
        updatedCount > 0
          ? `${updatedCount} facture(s) mise(s) à jour avec succès`
          : 'Toutes les données sont complètes',
    });
  } catch (error) {
    console.error('Error enhancing invoices:', error);
    return NextResponse.json({ error: 'Failed to enhance invoices' }, { status: 500 });
  }
}
