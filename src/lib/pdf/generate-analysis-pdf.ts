import { ReportData } from '@/types/analysis';
import { PDF_CONFIG } from './config';
import { createReportToken, deleteReportToken } from './token-store';

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

export async function generateAnalysisPdf(data: ReportData): Promise<Buffer> {
  const token = createReportToken(data);
  const baseUrl = getBaseUrl();
  const printUrl = `${baseUrl}/reports/print/analysis?token=${encodeURIComponent(token)}`;

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
        top: `35mm`,
        bottom: `${PDF_CONFIG.margins.bottom}mm`,
        left: `${PDF_CONFIG.margins.left}mm`,
        right: `${PDF_CONFIG.margins.right}mm`,
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:0 ${PDF_CONFIG.margins.right}mm 0 ${PDF_CONFIG.margins.left}mm; font-family:Cairo,sans-serif; direction:rtl; border-bottom: 2px solid #1a237e; margin-bottom: 5mm;">
          <div style="flex:1; text-align:right; font-size:12pt; color:#1a237e; font-weight:bold;">
            ${data.title}
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            ${data.logos?.quality ? `<img src="${data.logos.quality}" style="max-height:16mm; object-fit:contain;" />` : ''}
            ${data.logos?.university ? `<img src="${data.logos.university}" style="max-height:16mm; object-fit:contain;" />` : ''}
            ${data.logos?.college ? `<img src="${data.logos.college}" style="max-height:16mm; object-fit:contain;" />` : ''}
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#666;font-family:Cairo,sans-serif;padding:0 ${PDF_CONFIG.margins.right}mm 0 ${PDF_CONFIG.margins.left}mm;direction:rtl;">
          <span style="float:right;">${data.reportDate}</span>
          <span style="display:block;text-align:center;">
            صفحة <span class="pageNumber"></span> من <span class="totalPages"></span>
          </span>
        </div>
      `,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
    deleteReportToken(token);
  }
}
