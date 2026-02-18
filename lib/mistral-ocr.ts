import { Mistral } from '@mistralai/mistralai';

const apiKey = process.env.MISTRAL_API_KEY;
const client = new Mistral({ apiKey: apiKey });

export interface MistralOCRResult {
  success: boolean;
  text?: string;
  error?: string;
  parsedData?: {
    vendor?: string;
    clientName?: string;
    amount?: number;
    vatAmount?: number;
    date?: string;
    invoiceNumber?: string;
    iban?: string;
    email?: string;
    phone?: string;
    siret?: string;
    address?: string;
    company?: string;
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
  clientName?: string;
  amount?: number;
  vatAmount?: number;
  date?: string;
  invoiceNumber?: string;
  iban?: string;
  email?: string;
  phone?: string;
  siret?: string;
  address?: string;
  company?: string;
  confidence: number 
} {
  const result: { 
    vendor?: string;
    clientName?: string;
    amount?: number;
    vatAmount?: number;
    date?: string;
    invoiceNumber?: string;
    iban?: string;
    email?: string;
    phone?: string;
    siret?: string;
    address?: string;
    company?: string;
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

  // Patterns pour extraire le nom du fournisseur
  const vendorPatterns = [
    // Patterns pour les entreprises françaises
    /([A-Z][A-Za-z0-9\s\-\']+(?:SARL|SAS|SA|EURL|EI|SNC|SCS|SCA|SCOP|SASU)\b)/i,
    // Nom suivi de SARL/SAS/SA
    /([A-Z][A-Z\s]+)\s+(?:SARL|SAS|SA|EURL|EI)\b/,
    // Première ligne qui ressemble à un nom d'entreprise (exclure FACTURE, DATE, etc.)
    /^(?!FACTURE|DATE|N°|NUMERO|DEVIS|BON|COMMANDE)([A-Z][A-Za-z\s\-\']{3,50})$/m,
  ];

  // Chercher dans les 20 premières lignes
  for (const line of lines.slice(0, 20)) {
    const trimmedLine = line.trim();
    
    // Ignorer les lignes qui sont clairement pas des noms d'entreprise
    if (
      trimmedLine.length < 3 ||
      trimmedLine.length > 60 ||
      /^(FACTURE|DATE|N°|NUMERO|DEVIS|BON|COMMANDE|TOTAL|HT|TTC|PRIX|QUANTITE|QTE)/i.test(trimmedLine) ||
      /^\d+$/.test(trimmedLine) ||
      /^[\d\s\-\.\/]+$/.test(trimmedLine)
    ) {
      continue;
    }
    
    for (const pattern of vendorPatterns) {
      const match = trimmedLine.match(pattern);
      if (match && match[1]) {
        const vendorName = match[1].trim();
        if (vendorName.length >= 3) {
          result.vendor = vendorName;
          result.confidence += 30;
          break;
        }
      }
    }
    if (result.vendor) break;
  }

  // Si toujours pas trouvé, essayer de prendre la première ligne significative
  if (!result.vendor) {
    for (const line of lines.slice(0, 5)) {
      const trimmedLine = line.trim();
      if (
        trimmedLine.length >= 3 &&
        trimmedLine.length <= 50 &&
        !/^(FACTURE|DATE|N°|NUMERO)/i.test(trimmedLine) &&
        /^[A-Z]/.test(trimmedLine)
      ) {
        result.vendor = trimmedLine;
        result.confidence += 20;
        break;
      }
    }
  }

  if (!result.vendor) {
    result.vendor = 'Inconnu';
    result.confidence += 5;
  }

  // Extract Client Name (who the invoice is billed to)
  // Look for patterns like "Adressé à", "Facturé à", "Client", etc.
  const clientPatterns = [
    /(?:Adressé\s*à|Facturé\s*à|Client|Destinataire|Pour\s*compte\s*de)\s*[:\-]?\s*([A-Z][A-Za-z0-9\s\-\']{2,60})/i,
    /(?:Société\s*cliente|Client\s*final)\s*[:\-]?\s*([A-Z][A-Za-z0-9\s\-\']{2,60})/i,
  ];

  for (const pattern of clientPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const clientName = match[1].trim();
      if (clientName.length >= 3 && clientName !== result.vendor) {
        result.clientName = clientName;
        result.confidence += 15;
        break;
      }
    }
  }

  let amounts: number[] = [];
  let vatAmounts: number[] = [];

  // Pattern pour les montants avec € ou sans
  const amountPatterns = [
    // NET À PAYER (priorité haute)
    /NET\s*[ÀA]\s*PAYER\s*(?:TTC)?\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    /NET\s*PAYER\s*(?:TTC)?\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    /SOLDE\s*[ÀA]\s*PAYER\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    /MONTANT\s*(?:NET)?\s*(?:TTC)?\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    
    // TOTAL TTC
    /TOTAL\s*TTC\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    /TOTAL\s*(?:TTC)?\s*(?:[ÀA]\s*PAYER)?\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    
    // Montant TTC
    /MONTANT\s*TTC\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    
    // Prix avec €
    /([\d\s.,]{3,})\s*[€\s]/,
  ];

  for (const pattern of amountPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      // Nettoyer la chaîne : garder uniquement les chiffres, points et virgules
      let amountStr = match[1].replace(/\s/g, '');
      
      // Gérer le format français (virgule comme séparateur décimal)
      // et le format anglais (point comme séparateur décimal)
      if (amountStr.includes(',') && amountStr.includes('.')) {
        // Si les deux sont présents, la virgule est probablement le séparateur des milliers
        amountStr = amountStr.replace(/,/g, '');
      } else if (amountStr.includes(',')) {
        // Vérifier si la virgule est suivie de 2 chiffres (séparateur décimal) ou plus (séparateur de milliers)
        const parts = amountStr.split(',');
        if (parts.length === 2 && parts[1].length === 2) {
          amountStr = amountStr.replace(',', '.');
        } else {
          amountStr = amountStr.replace(/,/g, '');
        }
      }
      
      const amount = parseFloat(amountStr);
      if (amount > 0 && amount < 1000000) { // Éviter les valeurs aberrantes
        amounts.push(amount);
      }
    }
  }

  if (amounts.length > 0) {
    // Prendre le plus grand montant (généralement le total TTC ou NET À PAYER)
    result.amount = Math.max(...amounts);
    result.confidence += 30;
  } else {
    // Essayer de trouver n'importe quel montant dans le texte
    const genericAmountMatch = cleanText.match(/(\d{1,3}(?:[\s.,]\d{3})*[\.,]\d{2})\s*[€]/);
    if (genericAmountMatch) {
      let amountStr = genericAmountMatch[1].replace(/\s/g, '');
      if (amountStr.includes(',') && !amountStr.includes('.')) {
        amountStr = amountStr.replace(',', '.');
      } else if (amountStr.includes(',') && amountStr.includes('.')) {
        amountStr = amountStr.replace(/,/g, '');
      }
      const amount = parseFloat(amountStr);
      if (amount > 0 && amount < 1000000) {
        result.amount = amount;
        result.confidence += 20;
      }
    }
  }

  // Extract VAT (TVA) amount
  const vatPatterns = [
    // TVA patterns
    /TVA\s*(?:[àa]\s*\d+%?)?\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    /Montant\s*TVA\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    /Total\s*TVA\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    /TVA\s*totale\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
  ];

  for (const pattern of vatPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      let vatStr = match[1].replace(/\s/g, '');
      
      // Handle French and English decimal separators
      if (vatStr.includes(',') && vatStr.includes('.')) {
        vatStr = vatStr.replace(/,/g, '');
      } else if (vatStr.includes(',')) {
        const parts = vatStr.split(',');
        if (parts.length === 2 && parts[1].length === 2) {
          vatStr = vatStr.replace(',', '.');
        } else {
          vatStr = vatStr.replace(/,/g, '');
        }
      }
      
      const vatAmount = parseFloat(vatStr);
      if (vatAmount > 0 && vatAmount < result.amount!) { // TVA must be less than total
        vatAmounts.push(vatAmount);
      }
    }
  }

  if (vatAmounts.length > 0) {
    // Take the most likely TVA amount
    result.vatAmount = vatAmounts[0];
    result.confidence += 15;
  }

  // Amélioration de l'extraction de la date
  const frenchMonths: Record<string, string> = {
    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06',
    'juillet': '07', 'août': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12',
    'janv': '01', 'févr': '02', 'avr': '04', 'juil': '07', 'sept': '09', 'oct': '10', 'nov': '11', 'déc': '12'
  };

  // Chercher la date de facture avec plusieurs patterns
  const datePatterns = [
    // Date de facture : DD/MM/YYYY ou DD-MM-YYYY
    /Date\s*(?:de\s*)?(?:facture|document)?\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    // Le DD mois YYYY
    /(?:Date|Le)\s*[:\-]?\s*(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv|févr|avr|juil|sept|oct|nov|déc)[\.\s]+(\d{4})/i,
    // DD/MM/YYYY ou DD-MM-YYYY (format général)
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    // YYYY-MM-DD (format ISO)
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
  ];

  for (const pattern of datePatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      try {
        if (match[2] && frenchMonths[match[2].toLowerCase()]) {
          // Format avec mois en toutes lettres
          const day = match[1].padStart(2, '0');
          const month = frenchMonths[match[2].toLowerCase()];
          const year = match[3];
          if (year && parseInt(year) > 2000 && parseInt(year) < 2100) {
            result.date = `${year}-${month}-${day}`;
            result.confidence += 20;
            break;
          }
        } else {
          // Format numérique
          const dateStr = match[1];
          const parts = dateStr.split(/[\/\-\.]/);
          
          if (parts.length === 3) {
            let day, month, year;
            
            if (parts[0].length === 4) {
              // Format YYYY-MM-DD
              year = parts[0];
              month = parts[1].padStart(2, '0');
              day = parts[2].padStart(2, '0');
            } else {
              // Format DD/MM/YYYY ou DD-MM-YYYY
              day = parts[0].padStart(2, '0');
              month = parts[1].padStart(2, '0');
              year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            }
            
            if (parseInt(year) > 2000 && parseInt(year) < 2100) {
              result.date = `${year}-${month}-${day}`;
              result.confidence += 20;
              break;
            }
          }
        }
      } catch (e) {
        console.log('[OCR] Error parsing date:', e);
      }
    }
  }

  result.confidence = Math.min(result.confidence, 100);

  // Detect company based on vendor name or OCR text - STRICT MODE
  // Only assign if there's a clear, unambiguous match
  
  const vendorLower = (result.vendor || '').toLowerCase();
  const cleanVendorLower = vendorLower.replace(/[^a-z0-9]/g, '');
  const cleanTextLower = cleanText.toLowerCase();

  // Priority 1: Check vendor name first (more reliable)
  // Check Sofiane BEFORE Sofia (since "sofiane" contains "sofia")
  let detectedCompany: string | null = null;
  
  // Sofiane Transport - check first to avoid false positive with Sofia
  if (
    cleanVendorLower.includes('sofian') || 
    cleanVendorLower.includes('sofiane') ||
    /\bsofiane\b/i.test(vendorLower) ||
    /\bsofiane\s*transport/i.test(vendorLower)
  ) {
    detectedCompany = 'SOFIANE_TRANSPORT';
  }
  // Sofia Transport - must be exact, not partial match
  else if (
    (cleanVendorLower === 'sofia' || cleanVendorLower.includes('sofia')) &&
    !cleanVendorLower.includes('sofian')
  ) {
    detectedCompany = 'SOFIA_TRANSPORT';
  }
  // Garage Expertise
  else if (
    cleanVendorLower.includes('garage') || 
    cleanVendorLower.includes('expertise') ||
    cleanVendorLower.includes('mecanique') ||
    cleanVendorLower.includes('mécanique') ||
    cleanVendorLower.includes('automobile') ||
    /\bgarage\b/i.test(vendorLower) ||
    /\bgarage\s*expertise/i.test(vendorLower)
  ) {
    detectedCompany = 'GARAGE_EXPERTISE';
  }
  
  // Priority 2: If no vendor match, check OCR text (with stricter rules)
  if (!detectedCompany) {
    // Sofiane - must be standalone word
    if (
      /\bsofiane\b/i.test(cleanTextLower) ||
      /\bsofiane\s*transport\b/i.test(cleanTextLower) ||
      cleanTextLower.includes('sofiane transport')
    ) {
      detectedCompany = 'SOFIANE_TRANSPORT';
    }
    // Sofia - must be standalone, not part of sofiane
    else if (
      /\bsofia\b/i.test(cleanTextLower) &&
      !/\bsofiane\b/i.test(cleanTextLower) &&
      !cleanTextLower.includes('sofiane')
    ) {
      detectedCompany = 'SOFIA_TRANSPORT';
    }
    // Garage
    else if (
      /\bgarage\b/i.test(cleanTextLower) ||
      /\bgarage\s*expertise\b/i.test(cleanTextLower)
    ) {
      detectedCompany = 'GARAGE_EXPERTISE';
    }
  }

  // Only set company if we have a clear match - otherwise leave as null (UNKNOWN)
  if (detectedCompany) {
    result.company = detectedCompany;
    result.confidence += 10;
  }
  // Don't default to any company - leave as null for manual selection

  return result;
}

// Interface pour les données existantes
interface ExistingInvoiceData {
  vendor?: string | null;
  clientName?: string | null;
  amount?: number | null;
  vatAmount?: number | null;
  date?: Date | string | null;
  invoiceNumber?: string | null;
  iban?: string | null;
  email?: string | null;
  phone?: string | null;
  siret?: string | null;
  address?: string | null;
}

// Fonction pour extraire uniquement les champs manquants
export function extractMissingFields(
  ocrText: string,
  existingData: ExistingInvoiceData
): Partial<ExistingInvoiceData> {
  const missingFields: Partial<ExistingInvoiceData> = {};
  const cleanText = ocrText.toLowerCase().replace(/\s+/g, ' ');
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 1. Montant total (priorité haute)
  if (existingData.amount === null || existingData.amount === undefined) {
    const amountPatterns = [
      /NET\s*[ÀA]\s*PAYER\s*(?:TTC)?\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
      /NET\s*PAYER\s*(?:TTC)?\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
      /SOLDE\s*[ÀA]\s*PAYER\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
      /TOTAL\s*TTC\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
      /MONTANT\s*TTC\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    ];

    for (const pattern of amountPatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        let amountStr = match[1].replace(/\s/g, '');
        
        if (amountStr.includes(',') && amountStr.includes('.')) {
          amountStr = amountStr.replace(/,/g, '');
        } else if (amountStr.includes(',')) {
          const parts = amountStr.split(',');
          if (parts.length === 2 && parts[1].length === 2) {
            amountStr = amountStr.replace(',', '.');
          } else {
            amountStr = amountStr.replace(/,/g, '');
          }
        }
        
        const amount = parseFloat(amountStr);
        if (amount > 0 && amount < 1000000) {
          missingFields.amount = amount;
          break;
        }
      }
    }
  }

  // 2. Date (priorité haute)
  if (!existingData.date) {
    const frenchMonths: Record<string, string> = {
      'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06',
      'juillet': '07', 'août': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12',
      'janv': '01', 'févr': '02', 'avr': '04', 'juil': '07', 'sept': '09', 'oct': '10', 'nov': '11', 'déc': '12'
    };

    const datePatterns = [
      /Date\s*(?:de\s*)?(?:facture|document)?\s*[:")](\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(?:Date|Le)\s*[:\-]?\s*(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv|févr|avr|juil|sept|oct|nov|déc)[\.\s]+(\d{4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    ];

    for (const pattern of datePatterns) {
      const match = ocrText.match(pattern);
      if (match) {
        try {
          if (match[2] && frenchMonths[match[2].toLowerCase()]) {
            const day = match[1].padStart(2, '0');
            const month = frenchMonths[match[2].toLowerCase()];
            const year = match[3];
            if (year && parseInt(year) > 2000 && parseInt(year) < 2100) {
              missingFields.date = new Date(`${year}-${month}-${day}`);
              break;
            }
          } else {
            const dateStr = match[1];
            const parts = dateStr.split(/[\/\-\.]/);
            
            if (parts.length === 3) {
              let day, month, year;
              
              if (parts[0].length === 4) {
                year = parts[0];
                month = parts[1].padStart(2, '0');
                day = parts[2].padStart(2, '0');
              } else {
                day = parts[0].padStart(2, '0');
                month = parts[1].padStart(2, '0');
                year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
              }
              
              if (parseInt(year) > 2000 && parseInt(year) < 2100) {
                missingFields.date = new Date(`${year}-${month}-${day}`);
                break;
              }
            }
          }
        } catch (e) {
          console.log('[OCR] Error parsing date:', e);
        }
      }
    }
  }

  // 3. Fournisseur (priorité haute)
  if (!existingData.vendor) {
    const vendorPatterns = [
      /([A-Z][A-Za-z0-9\s\-\']+(?:SARL|SAS|SA|EURL|EI|SNC|SCS|SCA|SCOP|SASU)\b)/i,
      /([A-Z][A-Z\s]+)\s+(?:SARL|SAS|SA|EURL|EI)\b/,
      /^(?!FACTURE|DATE|N°|NUMERO|DEVIS|BON|COMMANDE|TOTAL|HT|TTC|PRIX|QUANTITE|QTE)([A-Z][A-Za-z\s\-\']{3,50})$/m,
    ];

    for (const line of lines.slice(0, 20)) {
      const trimmedLine = line.trim();
      
      if (
        trimmedLine.length < 3 ||
        trimmedLine.length > 60 ||
        /^(FACTURE|DATE|N°|NUMERO|DEVIS|BON|COMMANDE|TOTAL|HT|TTC|PRIX|QUANTITE|QTE)/i.test(trimmedLine) ||
        /^\d+$/.test(trimmedLine) ||
        /^[\d\s\-\.\/]+$/.test(trimmedLine)
      ) {
        continue;
      }
      
      for (const pattern of vendorPatterns) {
        const match = trimmedLine.match(pattern);
        if (match && match[1]) {
          const vendorName = match[1].trim();
          if (vendorName.length >= 3) {
            missingFields.vendor = vendorName;
            break;
          }
        }
      }
      if (missingFields.vendor) break;
    }

    // Si toujours pas trouvé, essayer la première ligne significative
    if (!missingFields.vendor) {
      for (const line of lines.slice(0, 5)) {
        const trimmedLine = line.trim();
        if (
          trimmedLine.length >= 3 &&
          trimmedLine.length <= 50 &&
          !/^(FACTURE|DATE|N°|NUMERO)/i.test(trimmedLine) &&
          /^[A-Z]/.test(trimmedLine)
        ) {
          missingFields.vendor = trimmedLine;
          break;
        }
      }
    }
  }

  // 4. TVA (priorité haute)
  if (existingData.vatAmount === null || existingData.vatAmount === undefined) {
    const vatPatterns = [
      /TVA\s*(?:[àa]\s*\d+%?)?\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
      /Montant\s*TVA\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
      /Total\s*TVA\s*[:\-\s]*\|?\s*([\d\s.,]+)\s*[€\s]*/i,
    ];

    for (const pattern of vatPatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        let vatStr = match[1].replace(/\s/g, '');
        
        if (vatStr.includes(',') && vatStr.includes('.')) {
          vatStr = vatStr.replace(/,/g, '');
        } else if (vatStr.includes(',')) {
          const parts = vatStr.split(',');
          if (parts.length === 2 && parts[1].length === 2) {
            vatStr = vatStr.replace(',', '.');
          } else {
            vatStr = vatStr.replace(/,/g, '');
          }
        }
        
        const vatAmount = parseFloat(vatStr);
        if (vatAmount > 0) {
          missingFields.vatAmount = vatAmount;
          break;
        }
      }
    }
  }

  // 5. Numéro de facture
  if (!existingData.invoiceNumber) {
    const invoiceNumberPatterns = [
      /N°\s*(?:de\s*)?(?:facture|invoice)?\s*[:.\-]?\s*([A-Z0-9]{4,})/i,
      /Facture\s*(?:n°|no|numéro|#)?\s*[:.\-]?\s*([A-Z0-9]{4,})/i,
      /(?:Reference|Réf|Ref)\s*[:.\-]?\s*([A-Z0-9\-]{4,})/i,
      /\b(FA\d{6,})\b/i,
      /\b(INV\d{6,})\b/i,
    ];

    for (const line of lines.slice(0, 20)) {
      for (const pattern of invoiceNumberPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          missingFields.invoiceNumber = match[1].trim();
          break;
        }
      }
      if (missingFields.invoiceNumber) break;
    }
  }

  // 6. IBAN
  if (!existingData.iban) {
    const ibanMatch = ocrText.match(/FR\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}/i);
    if (!ibanMatch) {
      const ibanMatch2 = ocrText.match(/FR[A-Z0-9]{23}/i);
      if (ibanMatch2) missingFields.iban = ibanMatch2[0].toUpperCase();
    } else {
      missingFields.iban = ibanMatch[0].toUpperCase().replace(/\s/g, ' ');
    }
  }

  // 7. Email
  if (!existingData.email) {
    const emailMatch = ocrText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      missingFields.email = emailMatch[0];
    }
  }

  // 8. Téléphone
  if (!existingData.phone) {
    const phoneMatch = ocrText.match(/(?:tel|téléphone|phone)[\s:.]*\s*(\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/i);
    if (!phoneMatch) {
      const phoneMatch2 = ocrText.match(/0\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/);
      if (phoneMatch2) missingFields.phone = phoneMatch2[0];
    } else {
      missingFields.phone = phoneMatch[1];
    }
  }

  // 9. SIRET
  if (!existingData.siret) {
    const siretMatch = ocrText.match(/\b\d{14}\b/);
    if (siretMatch) {
      missingFields.siret = siretMatch[0];
    }
  }

  return missingFields;
}
