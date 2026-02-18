const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'K86246933488957';
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';

export interface OCRResult {
  success: boolean;
  text?: string;
  error?: string;
  parsedData?: {
    vendor?: string;
    amount?: number;
    date?: string;
    confidence: number;
  };
}

export async function parseInvoiceWithOCR(file: Buffer, filename: string): Promise<OCRResult> {
  try {
    console.log(`[OCR] Processing file: ${filename}, size: ${file.length} bytes`);

    const formData = new FormData();
    
    const uint8Array = new Uint8Array(file);
    const blob = new Blob([uint8Array]);
    
    const fileName = filename.toLowerCase();
    let mimeType = 'application/pdf';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (fileName.endsWith('.png')) mimeType = 'image/png';
    else if (fileName.endsWith('.gif')) mimeType = 'image/gif';

    formData.append('file', blob, filename);
    formData.append('language', 'fre');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');
    if (filename.toLowerCase().endsWith('.pdf')) {
      formData.append('filetype', 'PDF');
    }

    console.log(`[OCR] Sending request to ocr.space for: ${filename}`);

    const response = await fetch(OCR_SPACE_URL, {
      method: 'POST',
      headers: {
        'apikey': OCR_SPACE_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OCR] HTTP Error ${response.status}:`, errorText);
      return {
        success: false,
        error: `HTTP Error ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    console.log(`[OCR] Response:`, JSON.stringify(data).substring(0, 500));

    if (data.IsErroredOnProcessing) {
      const errorMsg = data.ErrorMessage?.[0] || 'OCR processing failed';
      console.error(`[OCR] Processing Error:`, errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }

    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      console.warn(`[OCR] No results found`);
      return {
        success: true,
        text: '',
        parsedData: {
          vendor: 'Inconnu',
          confidence: 0,
        },
      };
    }

    const text = data.ParsedResults[0].ParsedText || '';
    console.log(`[OCR] Extracted text length: ${text.length} chars`);
    
    const parsedData = extractInvoiceData(text);
    console.log(`[OCR] Parsed data:`, parsedData);
    
    return {
      success: true,
      text,
      parsedData,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[OCR] Exception:`, error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

function extractInvoiceData(text: string): { vendor?: string; amount?: number; date?: string; confidence: number } {
  const result: { vendor?: string; amount?: number; date?: string; confidence: number } = {
    confidence: 0,
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const vendorPatterns = [
    /^(amazon|google|apple|microsoft|orange|free|bnp|paypal|carrefour|auchan|casino|leclerc|ovh|sfr|bouygues|edf|engie|total|Shell)/i,
  ];
  
  for (const line of lines.slice(0, 5)) {
    for (const pattern of vendorPatterns) {
      const match = line.match(pattern);
      if (match) {
        result.vendor = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        result.confidence += 20;
        break;
      }
    }
    if (result.vendor) break;
  }

  if (!result.vendor) {
    for (const line of lines.slice(0, 3)) {
      const companyMatch = line.match(/^([A-Z][A-Za-z\s&]+(?:SARL|SAS|SASU|SA|EURL|SCI|LLC|Inc|Corp|Ltd)?)$/);
      if (companyMatch && companyMatch[1].length > 2 && companyMatch[1].length < 50) {
        result.vendor = companyMatch[1].trim();
        result.confidence += 15;
        break;
      }
    }
  }

  const amountPatterns = [
    { pattern: /TOTAL\s*TTC\s*[:\-]?\s*(\d+)\s*(\d{2})\s*€/i, priority: 1 },
    { pattern: /Total\s*HT\s*[:\-]?\s*(\d+)\s*(\d{2})\s*€/i, priority: 2 },
    { pattern: /(?:^|\s)(Total|Montant|Somme|Amount)[:\-]?\s*(\d+)[,.](\d{2})\s*€/im, priority: 3 },
    { pattern: /(\d+)[,.]\d{2}\s*€(?:\s|$)/, priority: 4 },
  ];
  
  let amounts: { amount: number; priority: number }[] = [];
  
  const fullText = text.replace(/\s+/g, ' ');
  
  const ttcMatch = fullText.match(/TOTAL\s*TTC\s*[:\-]?\s*([\d\s]+)[,.](\d{2})\s*€/i);
  if (ttcMatch) {
    const amount = parseFloat(ttcMatch[1].replace(/\s/g, '') + '.' + ttcMatch[2]);
    if (amount > 0 && amount < 1000000) {
      amounts.push({ amount, priority: 1 });
    }
  }
  
  const htMatch = fullText.match(/Total\s*HT\s*[:\-]?\s*([\d\s]+)[,.](\d{2})\s*€/i);
  if (htMatch) {
    const amount = parseFloat(htMatch[1].replace(/\s/g, '') + '.' + htMatch[2]);
    if (amount > 0 && amount < 1000000) {
      amounts.push({ amount, priority: 2 });
    }
  }
  
  const otherAmounts = fullText.match(/(\d+)\s*[,.](\d{2})\s*€/g);
  if (otherAmounts) {
    for (const amt of otherAmounts) {
      const match = amt.match(/(\d+)[,.](\d{2})/);
      if (match) {
        const amount = parseFloat(match[1]) + parseInt(match[2]) / 100;
        if (amount > 0 && amount < 1000000) {
          amounts.push({ amount, priority: 10 });
        }
      }
    }
  }
  
  if (amounts.length > 0) {
    amounts.sort((a, b) => a.priority - b.priority);
    result.amount = amounts[0].amount;
    result.confidence += 30;
  }

  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
  ];
  
  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        result.date = match[0];
        result.confidence += 20;
        break;
      }
    }
    if (result.date) break;
  }

  if (!result.vendor && text.length > 0) {
    result.vendor = 'Inconnu';
    result.confidence += 10;
  }

  result.confidence = Math.min(result.confidence, 100);

  return result;
}
