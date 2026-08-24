import { NextResponse } from 'next/server';
import { generateAnalysisPdf } from '@/lib/pdf/generate-analysis-pdf';
import { PDF_CONFIG } from '@/lib/pdf/config';
import { getReportValidationErrors, validateReportData } from '@/lib/pdf/report-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * خطة Vercel المجانية تحدّ الدوال عند ٦٠ ثانية وتتجاهل أي رقم أعلى،
 * فإعلان ١٢٠ كان يعطي إحساساً زائفاً بالأمان أثناء الإقلاع البارد لـ Chromium.
 *
 * ملاحظة: Next.js يقرأ إعدادات مقطع المسار وقت البناء، فلا بد أن تكون قيمة
 * حرفية — لا متغير بيئة ولا تعبير محسوب. على خطة Pro غيّر الرقم إلى 300 يدوياً.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!validateReportData(body)) {
      const details = getReportValidationErrors(body);
      return NextResponse.json(
        { error: `بيانات التقرير غير صالحة: ${details.slice(0, 3).join(' ')}` },
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

    const raw = error instanceof Error ? error.message : '';

    // رسائل Playwright الخام غير مفهومة للمستخدم — نترجم أشهر حالتي فشل
    if (/timeout/i.test(raw)) {
      return NextResponse.json(
        {
          error:
            'انتهت مهلة إنشاء التقرير. جرّب تقليل عدد الأسئلة أو حجم الشعارات، أو أعد المحاولة بعد لحظات.',
        },
        { status: 504 }
      );
    }

    if (/executablePath|browserType\.launch|ENOENT/i.test(raw)) {
      return NextResponse.json(
        { error: 'تعذّر تشغيل محرك الطباعة على الخادم. راجع سجلات الخادم لتفاصيل Chromium.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: raw || 'فشل إنشاء ملف PDF' }, { status: 500 });
  }
}
