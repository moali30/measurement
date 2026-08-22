export type PageSize = 'A4' | 'Letter';

/**
 * هوامش الصفحة بالمليمتر — المصدر الوحيد للحقيقة.
 *
 * تُستهلك من `page.pdf()` في `generate-analysis-pdf.ts` فقط. ملف `print.css`
 * لا يعلن `@page { margin }` عن قصد، حتى لا يوجد مصدران متعارضان يتغير أثرهما
 * حسب إصدار Chromium وقيمة `preferCSSPageSize`.
 *
 * المساحة العلوية والسفلية تحجز مكان الرأس والتذييل الجاريين.
 */
const MARGINS_MM = {
  /** 8mm إزاحة + شعار 34px (~9mm) + خط فاصل + فراغ تنفّس */
  top: 30,
  right: 15,
  /** 6mm إزاحة + خانة التوقيع (لقب + صورة ≈ 12mm) + فراغ تنفّس.
   *  ضيق هذا الهامش كان يجعل الرسوم الطويلة تُرسم فوق التذييل وتُقصّ. */
  bottom: 26,
  left: 15,
} as const;

export const PDF_CONFIG = {
  defaultPageSize: 'A4' as PageSize,

  margins: MARGINS_MM,

  minBodyFontPt: 9,

  /**
   * عدد صفحات التعريف في أول التقرير: الغلاف ثم فهرس المحتويات.
   *
   * هاتان الصفحتان تُطبعان بلا خانة توقيع — لا يوقّع أحد على غلاف ولا على فهرس.
   * الرقم يقابل بنية `AnalysisPrintDocument`: الغلاف ينتهي بـ `break-after: page`
   * والفهرس يحمل `.print-section--front-matter-end`، فكل منهما صفحة واحدة.
   * تغيير أي من الاثنين يوجب تحديث هذا الرقم.
   */
  frontMatterPages: 2,

  metadata: {
    author: 'لجنة القياس والتقويم',
    subject: 'تقرير تحليل استبيان',
  },

  /** يحوّل الهوامش إلى الصيغة التي يتوقعها Playwright */
  playwrightMargins() {
    return {
      top: `${MARGINS_MM.top}mm`,
      right: `${MARGINS_MM.right}mm`,
      bottom: `${MARGINS_MM.bottom}mm`,
      left: `${MARGINS_MM.left}mm`,
    };
  },

  buildFilename(title: string, reportDate: string) {
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'تحليل_الاستبيان';
    const safeDate = reportDate.replace(/[\\/:*?"<>|]/g, '-');
    return `تقرير_${safeTitle}_${safeDate}.pdf`;
  },
} as const;
