import { Mistral } from '@mistralai/mistralai';

const apiKey = process.env.MISTRAL_API_KEY;
const client = new Mistral({ apiKey: apiKey });

export interface MistralOCRResult {
  success: boolean;
  text?: string;
  error?: string;
  parsedData?: {
    vendor?: string;
    amount?: number;
    date?: string;
    invoiceNumber?: string;
    iban?: string;
    email?: string;
    phone?: string;
    siret?: string;
    address?: string;
    confidence: number;
  };
}

export async function parseInvoiceWithMistral(buffer: Buffer, filename: string): Promise<MistralOCRResult> {
  try {
    console.log(`[MistralOCR] Processing file: ${filename}, size: ${buffer.length} bytes`);

    const base64Pdf = buffer.toString('base64');
    const mimeType = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

    const ocrResponse = await client.ocr.process({
      document: {
        type: 'document_url',
        documentUrl: `data:${mimeType};base64,${base64Pdf}`
      },
      model: 'mistral-ocr-latest',
      includeImageBase64: false
    });

    console.log(`[MistralOCR] OCR Response received`);

    if (!ocrResponse.pages || ocrResponse.pages.length === 0) {
      return {
        success: false,
        error: 'No pages found in document',
      };
    }

    let fullText = '';
    for (const page of ocrResponse.pages) {
      if (page.markdown) {
        fullText += page.markdown + '\n';
      }
    }

    console.log(`[MistralOCR] Extracted text length: ${fullText.length} chars`);

    const parsedData = extractInvoiceData(fullText);
    console.log(`[MistralOCR] Parsed data:`, parsedData);

    return {
      success: true,
      text: fullText,
      parsedData,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MistralOCR] Exception:`, error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

function extractInvoiceData(text: string): { 
  vendor?: string; 
  amount?: number; 
  date?: string; 
  invoiceNumber?: string;
  iban?: string;
  email?: string;
  phone?: string;
  siret?: string;
  address?: string;
  confidence: number 
} {
  const result: { 
    vendor?: string; 
    amount?: number; 
    date?: string; 
    invoiceNumber?: string;
    iban?: string;
    email?: string;
    phone?: string;
    siret?: string;
    address?: string;
    confidence: number 
  } = {
    confidence: 0,
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const cleanText = text.replace(/\s+/g, ' ');

  // Extract IBAN
  const ibanMatch = cleanText.match(/FR\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}/i);
  if (!ibanMatch) {
    const ibanMatch2 = cleanText.match(/FR[A-Z0-9]{23}/i);
    if (ibanMatch2) result.iban = ibanMatch2[0].toUpperCase();
  } else {
    result.iban = ibanMatch[0].toUpperCase().replace(/\s/g, ' ');
  }
  if (result.iban) result.confidence += 10;

  // Extract Email
  const emailMatch = cleanText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    result.email = emailMatch[0];
    result.confidence += 10;
  }

  // Extract Phone
  const phoneMatch = cleanText.match(/(?:tel|téléphone|phone)[\s:.]*\s*(\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/i);
  if (!phoneMatch) {
    const phoneMatch2 = cleanText.match(/0\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/);
    if (phoneMatch2) result.phone = phoneMatch2[0];
  } else {
    result.phone = phoneMatch[1];
  }
  if (result.phone) result.confidence += 10;

  // Extract SIRET
  const siretMatch = cleanText.match(/\b\d{14}\b/);
  if (siretMatch) {
    result.siret = siretMatch[0];
    result.confidence += 10;
  }

  // Extract Address (simple pattern)
  const addressMatch = cleanText.match(/(\d+[\s,]+[A-Z][a-zéèêëàâäùûüôöîï]+[\s,]+[A-Z]{2,5})/);
  if (addressMatch) {
    result.address = addressMatch[0];
    result.confidence += 5;
  }

  // Invoice Number
  const invoiceNumberPatterns = [
    /N°\s*(?:de\s*)?(?:facture|invoice)?\s*[:.\-]?\s*([A-Z0-9]{4,})/i,
    /Facture\s*(?:n°|no|numéro|#)?\s*[:.\-]?\s*([A-Z0-9]{4,})/i,
    /N°\s*([A-Z0-9\-]{4,})/i,
    /Invoice\s*(?:n°|no|#)?\s*[:.\-]?\s*([A-Z0-9\-]{4,})/i,
    /(?:Reference|Réf|Ref)\s*[:.\-]?\s*([A-Z0-9\-]{4,})/i,
    /\b(FA\d{6,})\b/i,
    /\b(INV\d{6,})\b/i,
    /\b(20\d{2}[A-Z0-9]{4,})\b/i,
  ];

  for (const line of lines.slice(0, 20)) {
    for (const pattern of invoiceNumberPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        result.invoiceNumber = match[1].trim();
        result.confidence += 20;
        break;
      }
    }
    if (result.invoiceNumber) break;
  }

  const knownVendors = ['amazon', 'google', 'apple', 'microsoft', 'orange', 'free', 'bnp', 'paypal', 'carrefour', 'auchan', 'casino', 'leclerc', 'ovh', 'sfr', 'bouygues', 'edf', 'engie', 'total', 'shell'];
  
  for (const line of lines.slice(0, 15)) {
    const lowerLine = line.toLowerCase();
    
    for (const vendor of knownVendors) {
      if (lowerLine.includes(vendor)) {
        result.vendor = vendor.charAt(0).toUpperCase() + vendor.slice(1);
        result.confidence += 30;
        break;
      }
    }
    if (result.vendor) break;
  }

  if (!result.vendor) {
    for (const line of lines.slice(0, 20)) {
      const sarlMatch = line.match(/(?:^|[^A-Za-z])([A-Z][A-Za-z0-9\-]+(?:PRO|COM|France|Group|Services|Consulting|Solutions|Expertise))/);
      if (sarlMatch && sarlMatch[1].length > 2) {
        result.vendor = sarlMatch[1];
        result.confidence += 25;
        break;
      }
    }
  }

  if (!result.vendor) {
    const firstLine = lines[0] || '';
    if (firstLine.length > 1 && firstLine.length < 50 && !firstLine.includes('FACTURE')) {
      result.vendor = firstLine;
      result.confidence += 20;
    }
  }

  if (!result.vendor) {
    result.vendor = 'Inconnu';
    result.confidence += 5;
  }

  let amounts: number[] = [];

  const netPatterns = [
    /NET\s*À\s*PAYER\s*(?:TTC)?\s*[:\-]?\s*\|?\s*([\d\s.,€]+)/i,
    /SOLDE\s*À\s*PAYER\s*[:\-]?\s*\|?\s*([\d\s.,€]+)/i,
  ];

  for (const pattern of netPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/[^\d.,]/g, '').replace(',', '.');
      const amount = parseFloat(amountStr);
      if (amount > 0) {
        amounts.push(amount);
      }
    }
  }

  const totalPatterns = [
    /TOTAL\s*TTC\s*[:\-]?\s*\|?\s*([\d\s.,€]+)/i,
    /Total\s*HT\s*[:\-]?\s*\|?\s*([\d\s.,€]+)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/[^\d.,]/g, '').replace(',', '.');
      const amount = parseFloat(amountStr);
      if (amount > 0) {
        amounts.push(amount);
      }
    }
  }

  if (amounts.length > 0) {
    result.amount = Math.max(...amounts);
    result.confidence += 30;
  }

  const dateLine = lines.find(l => /^Date:/i.test(l.trim()));
  
  console.log('[OCR] Date line found:', dateLine);
  
  if (dateLine) {
    const frenchMonths: Record<string, string> = {
      'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06',
      'juillet': '07', 'août': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
    };
    
    const monthMatch = dateLine.toLowerCase().match(/(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/);
    console.log('[OCR] Month match:', monthMatch);
    if (monthMatch) {
      const monthNum = frenchMonths[monthMatch[1]];
      const yearMatch = dateLine.match(/(\d{4})/);
      console.log('[OCR] Year match:', yearMatch);
      if (yearMatch && parseInt(yearMatch[1]) > 2000 && parseInt(yearMatch[1]) < 2100) {
        const dayMatch = dateLine.match(/(\d{1,2})/);
        const day = dayMatch ? parseInt(dayMatch[1]) : 1;
        result.date = `${yearMatch[1]}-${monthNum}-${String(day).padStart(2, '0')}`;
        result.confidence += 20;
      }
    }
  }

  result.confidence = Math.min(result.confidence, 100);

  return result;
}
