import { ReportData } from '@/types/analysis';
import { PDF_CONFIG } from './config';
import { buildFooterTemplate, buildHeaderTemplate } from './page-furniture';

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

export async function generateAnalysisPdf(data: ReportData): Promise<Buffer> {
  let browser;
  // @sparticuz/chromium مخصص لبيئة Vercel/Linux serverless. تشغيل `next start`
  // محلياً هو production أيضاً، لكنه يجب أن يستخدم Chromium الخاص بـ Playwright
  // (خصوصاً على Windows) وإلا نحاول تشغيل ملف Linux محلياً.
  if (process.env.VERCEL) {
    const sparticuz = await import('@sparticuz/chromium');
    const chromium = sparticuz.default || sparticuz;
    const playwright = await import('playwright-core');

    // الحزمة تضمّ الملف التنفيذي داخل bin/chromium.br، فاستدعاء executablePath()
    // بدون وسيط يستخرج النسخة المطابقة للإصدار المثبّت — لا يمكن أن يحدث انحراف
    // في الإصدار كما كان يحدث مع رابط tarball ثابت.
    // CHROMIUM_PACK_URL منفذ هروب لو ضاق حجم حزمة النشر وأردنا تنزيله عن بُعد.
    const packUrl = process.env.CHROMIUM_PACK_URL;
    const exePath = await chromium.executablePath(packUrl || undefined);

    browser = await playwright.chromium.launch({
      args: [...chromium.args, '--font-render-hinting=none'],
      executablePath: exePath,
      headless: true,
    });
  } else {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: true,
      args: ['--font-render-hinting=none'],
    });
  }

  try {
    const page = await browser.newPage();

    // Inject data into window object before the page loads
    await page.addInitScript((reportData) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__PRINT_DATA__ = reportData;
    }, data);

    const baseUrl = getBaseUrl();
    const printUrl = `${baseUrl}/reports/print/analysis`;

    console.log('[PDF] Navigating to', printUrl);
    await page.goto(printUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });

    await page.waitForSelector('[data-print-ready="true"]', { timeout: 60000 });
    await page.evaluate((title) => {
      document.title = title;
    }, data.title || PDF_CONFIG.metadata.subject);

    const pdfBuffer = await page.pdf({
      format: PDF_CONFIG.defaultPageSize,
      printBackground: true,
      preferCSSPageSize: true,
      margin: PDF_CONFIG.playwrightMargins(),
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(data),
      footerTemplate: buildFooterTemplate(data),
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
