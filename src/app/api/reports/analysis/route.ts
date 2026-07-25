import { NextResponse } from 'next/server';
import { generateAnalysisPdf } from '@/lib/pdf/generate-analysis-pdf';
import { PDF_CONFIG } from '@/lib/pdf/config';
import { validateReportData } from '@/lib/pdf/report-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!validateReportData(body)) {
      return NextResponse.json(
        { error: 'بيانات التقرير غير صالحة أو فارغة' },
        { status: 400 }
      );
    }

    const pdfBuffer = await generateAnalysisPdf(body);
    const filename = PDF_CONFIG.buildFilename(body.title, body.reportDate);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[PDF generation error]', error);
    const message = error instanceof Error ? error.message : 'فشل إنشاء ملف PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
