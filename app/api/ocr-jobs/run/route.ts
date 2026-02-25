import { NextRequest, NextResponse } from 'next/server';

import { processOcrJobs } from '@/lib/invoice-ocr';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const maxJobs = typeof body.maxJobs === 'number' ? Math.max(1, Math.min(50, body.maxJobs)) : 10;

    await processOcrJobs('api-runner', maxJobs);

    return NextResponse.json({ success: true, processed: true });
  } catch (error) {
    console.error('Error running OCR jobs:', error);
    return NextResponse.json({ error: 'Failed to run OCR jobs' }, { status: 500 });
  }
}
