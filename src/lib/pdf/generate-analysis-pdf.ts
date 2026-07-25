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

  const { chromium } = await import('playwright');

  const browser = await chromium.launch({
    headless: true,
    args: ['--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(printUrl, {
      waitUntil: 'networkidle',
      timeout: 120000,
    });

    await page.waitForSelector('[data-print-ready="true"]', { timeout: 60000 });

    const pdfBuffer = await page.pdf({
      format: PDF_CONFIG.defaultPageSize,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: `${PDF_CONFIG.margins.top}mm`,
        bottom: `${PDF_CONFIG.margins.bottom}mm`,
        left: `${PDF_CONFIG.margins.left}mm`,
        right: `${PDF_CONFIG.margins.right}mm`,
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
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
