import { readFile } from 'fs/promises';
import { join } from 'path';
import { type InvoiceCompany } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { parseInvoiceWithMistral } from '@/lib/mistral-ocr';

const OCR_REVIEW_CONFIDENCE_THRESHOLD = 80;
const OCR_CRITICAL_FIELD_THRESHOLD = 70;
const INVOICE_COMPANIES: InvoiceCompany[] = ['SOFIA_TRANSPORT', 'SOFIANE_TRANSPORT', 'GARAGE_EXPERTISE', 'UNKNOWN'];

function normalizeOcrText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u00A0\t]/g, ' ')
    .replace(/[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[Il]/g, '1')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidIban(iban: string): boolean {
  const compact = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^FR\d{25}$/.test(compact)) {
    return false;
  }

  const rearranged = `${compact.slice(4)}${compact.slice(0, 4)}`;
  const numeric = rearranged
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String(code - 55);
      }
      return char;
    })
    .join('');

  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }

  return remainder === 1;
}

function isValidSiret(siret: string): boolean {
  const digits = siret.replace(/\s+/g, '');
  if (!/^\d{14}$/.test(digits)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let value = Number(digits[i]);
    if (i % 2 === 0) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
  }

  return sum % 10 === 0;
}

function parseExtractedDate(dateValue?: string): Date | null {
  if (!dateValue) return null;

  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const [year, month, day] = dateValue.split('-').map(Number);
      if (year >= 2000 && year < 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(Date.UTC(year, month - 1, day));
        return Number.isNaN(date.getTime()) ? null : date;
      }
    }

    const dmY = dateValue.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (dmY) {
      const day = Number(dmY[1]);
      const month = Number(dmY[2]);
      let year = Number(dmY[3]);
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year < 2100) {
        const date = new Date(Date.UTC(year, month - 1, day));
        return Number.isNaN(date.getTime()) ? null : date;
      }
    }

    const yMd = dateValue.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (yMd) {
      const year = Number(yMd[1]);
      const month = Number(yMd[2]);
      const day = Number(yMd[3]);
      if (year >= 2000 && year < 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(Date.UTC(year, month - 1, day));
        return Number.isNaN(date.getTime()) ? null : date;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function getOrCreateDefaultCabinetId(): Promise<string> {
  const cabinet = await prisma.user.findFirst({
    where: { role: 'CABINET' },
    select: { id: true },
  });

  if (cabinet) {
    return cabinet.id;
  }

  const created = await prisma.user.create({
    data: {
      email: `default-cabinet-${Date.now()}@cabinet.local`,
      name: 'Default Cabinet',
      role: 'CABINET',
    },
    select: { id: true },
  });

  return created.id;
}

function buildFieldConfidence(
  parsedData: NonNullable<Awaited<ReturnType<typeof parseInvoiceWithMistral>>['parsedData']>,
  normalizedText: string,
  parsedDate: Date | null,
) {
  const hasCriticalFields = Boolean(parsedData.vendor && parsedData.amount && parsedDate && parsedData.invoiceNumber);

  const ibanValid = parsedData.iban ? isValidIban(parsedData.iban) : true;
  const siretValid = parsedData.siret ? isValidSiret(parsedData.siret) : true;
  const amountValid = typeof parsedData.amount === 'number' && parsedData.amount > 0;
  const vatValid =
    parsedData.vatAmount === undefined ||
    parsedData.vatAmount === null ||
    (amountValid && parsedData.vatAmount >= 0 && parsedData.vatAmount <= (parsedData.amount as number));

  const fieldConfidence = {
    vendor: parsedData.vendor ? 85 : 0,
    amount: amountValid ? 85 : 0,
    date: parsedDate ? 85 : 0,
    invoiceNumber: parsedData.invoiceNumber ? 80 : 0,
    company: parsedData.company ? 80 : 0,
    iban: parsedData.iban ? (ibanValid ? 95 : 20) : null,
    siret: parsedData.siret ? (siretValid ? 95 : 20) : null,
    vatAmount: parsedData.vatAmount != null ? (vatValid ? 80 : 20) : null,
    textLength: normalizedText.length,
  };

  const reviewRequired =
    (parsedData.confidence ?? 0) < OCR_REVIEW_CONFIDENCE_THRESHOLD ||
    !hasCriticalFields ||
    fieldConfidence.vendor < OCR_CRITICAL_FIELD_THRESHOLD ||
    fieldConfidence.amount < OCR_CRITICAL_FIELD_THRESHOLD ||
    fieldConfidence.date < OCR_CRITICAL_FIELD_THRESHOLD ||
    fieldConfidence.invoiceNumber < OCR_CRITICAL_FIELD_THRESHOLD ||
    !ibanValid ||
    !siretValid ||
    !vatValid;

  return { fieldConfidence, reviewRequired };
}

export async function processInvoiceOcr(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      filename: true,
      originalName: true,
    },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const filePath = join(process.cwd(), 'uploads', 'invoices', invoice.filename);
  const buffer = await readFile(filePath);
  const ocrResult = await parseInvoiceWithMistral(buffer, invoice.originalName);

  if (!ocrResult.success || !ocrResult.parsedData) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'ERROR',
        ocrText: ocrResult.text || '',
      },
    });
    throw new Error(ocrResult.error || 'OCR parsing failed');
  }

  const normalizedText = normalizeOcrText(ocrResult.text || '');
  const parsedDate = parseExtractedDate(ocrResult.parsedData.date);

  const { fieldConfidence, reviewRequired } = buildFieldConfidence(
    ocrResult.parsedData,
    normalizedText,
    parsedDate,
  );

  const iban = ocrResult.parsedData.iban && isValidIban(ocrResult.parsedData.iban)
    ? ocrResult.parsedData.iban
    : null;
  const siret = ocrResult.parsedData.siret && isValidSiret(ocrResult.parsedData.siret)
    ? ocrResult.parsedData.siret
    : null;
  const parsedCompany = ocrResult.parsedData.company;
  const company: InvoiceCompany = parsedCompany && INVOICE_COMPANIES.includes(parsedCompany as InvoiceCompany)
    ? (parsedCompany as InvoiceCompany)
    : 'UNKNOWN';

  if (ocrResult.parsedData.vendor) {
    const cabinetId = await getOrCreateDefaultCabinetId();
    await prisma.client.upsert({
      where: {
        name_cabinetId: {
          name: ocrResult.parsedData.vendor,
          cabinetId,
        },
      },
      create: {
        name: ocrResult.parsedData.vendor,
        email: ocrResult.parsedData.email || null,
        telephone: ocrResult.parsedData.phone || null,
        siret,
        adresse: ocrResult.parsedData.address || null,
        cabinetId,
      },
      update: {
        email: ocrResult.parsedData.email || null,
        telephone: ocrResult.parsedData.phone || null,
        siret,
        adresse: ocrResult.parsedData.address || null,
      },
    });
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      ocrText: normalizedText,
      vendor: ocrResult.parsedData.vendor,
      clientName: ocrResult.parsedData.clientName,
      invoiceNumber: ocrResult.parsedData.invoiceNumber,
      amount: ocrResult.parsedData.amount,
      vatAmount: ocrResult.parsedData.vatAmount,
      date: parsedDate,
      confidence: ocrResult.parsedData.confidence,
      company,
      status: reviewRequired ? 'TO_PROCESS' : 'PROCESSED',
      iban,
      email: ocrResult.parsedData.email,
      phone: ocrResult.parsedData.phone,
      siret,
      address: ocrResult.parsedData.address,
      ocrData: {
        reviewRequired,
        fieldConfidence,
      },
    },
  });
}

export async function enqueueOcrJob(invoiceId: string, priority = 0): Promise<void> {
  const existing = await prisma.ocrJob.findFirst({
    where: {
      invoiceId,
      status: {
        in: ['PENDING', 'RUNNING'],
      },
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  await prisma.ocrJob.create({
    data: {
      invoiceId,
      priority,
      status: 'PENDING',
    },
  });
}

async function claimNextJob(workerId: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM ocr_jobs
      WHERE status = 'PENDING'
        AND available_at <= NOW()
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const row = rows[0];
    if (!row) return null;

    return tx.ocrJob.update({
      where: { id: row.id },
      data: {
        status: 'RUNNING',
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });
  });
}

function nextBackoffDate(attempts: number): Date {
  const seconds = Math.min(300, 2 ** attempts);
  return new Date(Date.now() + seconds * 1000);
}

export async function processSingleOcrJob(workerId: string): Promise<boolean> {
  const job = await claimNextJob(workerId);
  if (!job) return false;

  try {
    await processInvoiceOcr(job.invoiceId);

    await prisma.ocrJob.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OCR error';
    const shouldRetry = job.attempts < job.maxAttempts;

    await prisma.ocrJob.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? 'PENDING' : 'FAILED',
        availableAt: shouldRetry ? nextBackoffDate(job.attempts) : new Date(),
        lastError: message,
        lockedAt: null,
        lockedBy: null,
      },
    });

    if (!shouldRetry) {
      await prisma.invoice.update({
        where: { id: job.invoiceId },
        data: { status: 'ERROR' },
      });
    }
  }

  return true;
}

let inProcessLoop = false;

export async function processOcrJobs(workerId: string, maxJobs = 5): Promise<void> {
  if (inProcessLoop) return;
  inProcessLoop = true;

  try {
    for (let i = 0; i < maxJobs; i += 1) {
      const processed = await processSingleOcrJob(workerId);
      if (!processed) break;
    }
  } finally {
    inProcessLoop = false;
  }
}

export function triggerOcrProcessing(workerId = 'web', maxJobs = 3): void {
  setImmediate(() => {
    void processOcrJobs(workerId, maxJobs);
  });
}
