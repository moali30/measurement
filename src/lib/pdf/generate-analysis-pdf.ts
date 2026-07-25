import { ReportData } from '@/types/analysis';
import { PDF_CONFIG } from './config';

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
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const sparticuz = await import('@sparticuz/chromium');
    const chromium = sparticuz.default || sparticuz;
    const playwright = await import('playwright-core');

    // For Vercel Edge / Serverless functions
    const exePath = await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
    );
    
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

    const pdfBuffer = await page.pdf({
      format: PDF_CONFIG.defaultPageSize,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: `15mm`,
        bottom: `20mm`,
        left: `15mm`,
        right: `15mm`,
      },
      displayHeaderFooter: true,
      headerTemplate: `<span></span>`,
      footerTemplate: `
        <div style="width:100%; display:flex; justify-content:center; align-items:center; padding-bottom: 5mm; font-family:Cairo,sans-serif; direction:rtl;">
          <div style="background-color:#e8eaf6; color:#1a237e; font-size:10pt; font-weight:bold; padding:4px 16px; border-radius:12px; border:1px solid #c5cae9;">
            صفحة <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        </div>
      `,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
