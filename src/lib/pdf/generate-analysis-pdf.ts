import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PDFDocument } from 'pdf-lib';

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

/** الملفات التي يقرأها fontconfig */
const FONT_FILE = /\.(ttf|otf|ttc)$/i;

/**
 * يثبّت خطوط المشروع كخطوط نظام قبل إقلاع Chromium على الخادم.
 *
 * قوالب الرأس والتذييل تُرسم في مستند منفصل لا يرث خطوط الصفحة، ولا ينتظر
 * تحميل أي خط ويب — جُرّب حقن `@font-face` بـ data URI داخل القالب فأُهمل تماماً
 * وسقط النص إلى خط النظام. فلم يبق إلا خطوط النظام نفسها.
 *
 * وحزمة @sparticuz/chromium لا تحمل سوى Open Sans (راجع `bin/fonts.tar.br`)، وهو
 * بلا حرف عربي واحد، فيخرج الرأس والتذييل فارغين على Vercel بينما يظهران محلياً
 * لأن ويندوز يوفّر Segoe UI. نسخ الخط إلى مجلد fontconfig يحلّ ذلك من أصله.
 *
 * `FONTCONFIG_PATH` تضبطها الحزمة نفسها على /tmp/fonts، وهو مجلد معلن داخل fonts.conf.
 */
function installReportFonts(): void {
  // جذر الدالة على Vercel هو مجلد العمل، وملفات `outputFileTracingIncludes` تُوضع
  // بمساراتها نسبةً إليه. نجرّب بدائل ونسجّل المستخدم ليظهر في سجلّ الخادم.
  const candidates = [join(process.cwd(), 'fonts'), join(process.cwd(), '.next', 'fonts')];
  const source = candidates.find((candidate) => existsSync(candidate));

  if (!source) {
    console.warn(
      `[PDF] fonts directory not found (tried ${candidates.join(', ')}) — Arabic page furniture will render blank`
    );
    return;
  }

  const target = process.env.FONTCONFIG_PATH || join(tmpdir(), 'fonts');
  mkdirSync(target, { recursive: true });

  const installed = readdirSync(source).filter((entry) => FONT_FILE.test(entry));
  for (const entry of installed) {
    copyFileSync(join(source, entry), join(target, entry));
  }

  console.log(`[PDF] installed ${installed.length} font(s) from ${source} into ${target}`);
}

/** المدى يتجاوز عدد صفحات المستند — خطأ متوقّع لا عطل في الطباعة */
function isPageRangeOutOfBounds(error: unknown): boolean {
  return error instanceof Error && /page range exceeds page count/i.test(error.message);
}

/**
 * يرصّ مخرجات `page.pdf()` في ملف واحد محافظاً على ترتيب الصفحات.
 *
 * `copyPages` ينقل موارد كل صفحة (الخطوط العربية المجزّأة والصور) معها،
 * فلا يضيع نص ولا ينكسر شكل حرف.
 */
async function mergePdfs(parts: Uint8Array[], title: string): Promise<Buffer> {
  const merged = await PDFDocument.create();

  for (const part of parts) {
    const source = await PDFDocument.load(part);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((copied) => merged.addPage(copied));
  }

  merged.setTitle(title || PDF_CONFIG.metadata.subject);
  merged.setAuthor(PDF_CONFIG.metadata.author);
  merged.setSubject(PDF_CONFIG.metadata.subject);

  return Buffer.from(await merged.save());
}

export async function generateAnalysisPdf(data: ReportData): Promise<Buffer> {
  let browser;
  let userDataDir: string | undefined;

  try {
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

      // Playwright لا يحذف ملف مستخدم Chromium في Lambda الدافئة. تراكم هذه
      // المجلدات يملأ /tmp، وعندها يفشل page.goto بـ ERR_INSUFFICIENT_RESOURCES.
      // مسار مستقل لكل طلب يسمح لنا بحذفه حتماً في finally دون لمس ملفات Chromium
      // المستخرجة التي تعيد الحزمة استخدامها بين التشغيلات.
      userDataDir = join(tmpdir(), `playwright-${randomUUID()}`);

      // بعد استخراج fonts.tar.br وقبل الإقلاع: Chromium يقرأ الخطوط مرة واحدة عند بدء التشغيل
      installReportFonts();

      browser = await playwright.chromium.launch({
        args: [
          ...chromium.args,
          '--font-render-hinting=none',
          `--user-data-dir=${userDataDir}`,
        ],
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

    // قالب التذييل واحد لكل صفحات الملف، وChromium لا يعرّف القالب برقم
    // الصفحة إلا كنص جاهز، فلا سبيل لإخفاء التوقيع على صفحتين بعينهما داخل
    // تمرير واحد. (جُرّب `@page :first` والصفحات المسمّاة: هوامش CSS لا تؤثر
    // في قوالب التذييل إطلاقاً.) لذلك نطبع مرتين بقالبين وندمج الناتج.
    //
    // `pageRanges` يحفظ ترقيم المستند الأصلي: المدى `3-` يطبع «صفحة 3 / 10»
    // لا «1 / 8»، فيبقى الترقيم متصلاً بعد الدمج.
    const printOptions = {
      format: PDF_CONFIG.defaultPageSize,
      printBackground: true,
      preferCSSPageSize: true,
      margin: PDF_CONFIG.playwrightMargins(),
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(data),
    } as const;

    const frontMatterPages = PDF_CONFIG.frontMatterPages;

    const frontMatterPdf = await page.pdf({
      ...printOptions,
      pageRanges: `1-${frontMatterPages}`,
      footerTemplate: buildFooterTemplate(data, { withSignatures: false }),
    });

    // تقرير لا يتجاوز صفحات التعريف ليس فيه محتوى يُوقّع. Chromium يرمي
    // «Page range exceeds page count» لا ملفاً فارغاً، فنلتقطها ونكتفي بما طُبع.
    let signedPagesPdf: Uint8Array | undefined;
    try {
      signedPagesPdf = await page.pdf({
        ...printOptions,
        pageRanges: `${frontMatterPages + 1}-`,
        footerTemplate: buildFooterTemplate(data, { withSignatures: true }),
      });
    } catch (error) {
      if (!isPageRangeOutOfBounds(error)) throw error;
    }

    if (!signedPagesPdf) {
      return Buffer.from(frontMatterPdf);
    }

    return await mergePdfs([frontMatterPdf, signedPagesPdf], data.title);
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      if (userDataDir) {
        try {
          await rm(userDataDir, { recursive: true, force: true });
        } catch (error) {
          // فشل التنظيف لا يجب أن يحوّل ملف PDF ناجحاً إلى استجابة 500، لكن يجب
          // أن يظهر في سجل الخادم لأن تكراره يعيد سبب العطل نفسه.
          console.warn(`[PDF] failed to remove Chromium profile ${userDataDir}`, error);
        }
      }
    }
  }
}
