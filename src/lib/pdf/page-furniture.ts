import { ReportData } from '@/types/analysis';
import { PDF_CONFIG } from './config';

/**
 * الرأس والتذييل الجاريان اللذان يتكرران على كل صفحة من التقرير.
 *
 * يُمرَّران إلى `page.pdf()` كـ headerTemplate/footerTemplate بدلاً من الاعتماد
 * على `position: fixed` في CSS: التكرار عبر قوالب Playwright سلوك مضمون ومثبَت
 * بالفعل في هذا المشروع (ترقيم الصفحات يعمل به منذ فترة)، بينما تكرار العناصر
 * الثابتة في الطباعة يختلف بين إصدارات Chromium ولا يمكن التحقق منه إلا بتشغيل
 * فعلي.
 *
 * قيود قوالب Playwright التي تحكم الكود أدناه:
 *   - تُرسم داخل هامش الصفحة، فلا بد أن تحجز `PDF_CONFIG.margins` مساحة كافية.
 *   - حجم الخط الافتراضي فيها صفر عملياً — لا بد من تحديده صراحةً.
 *   - الصور يجب أن تكون data URI؛ الروابط الخارجية لا تُحمَّل بشكل موثوق.
 *   - لا ترث أنماط الصفحة، فكل تنسيق مكتوب inline هنا.
 */

/** يمنع كسر القالب لو احتوى العنوان على محارف HTML */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** الشعارات وحدها data URI؛ أي رابط خارجي يُسقَط لأنه لن يُحمَّل في القالب */
function logoImg(src: string | undefined, align: 'flex-start' | 'flex-end'): string {
  const cell = `display:flex;align-items:center;justify-content:${align};width:70px;height:100%;`;
  if (!src || !src.startsWith('data:')) {
    return `<div style="${cell}"></div>`;
  }
  return `<div style="${cell}"><img src="${src}" style="max-width:64px;max-height:34px;object-fit:contain;" /></div>`;
}

/**
 * الرأس: شعار الجودة يميناً، عنوان التقرير وسطاً، شعار الكلية يساراً.
 *
 * العنوان ثابت عبر كل الصفحات — قوالب Playwright لا تعرف أي قسم يجري رسمه،
 * وعنوان القسم يظهر داخل التدفق نفسه عبر `.print-section-title`.
 */
export function buildHeaderTemplate(data: ReportData): string {
  const title = escapeHtml(data.title || 'تقرير تحليل الاستبيان');

  return `
    <div style="
      width:100%;
      box-sizing:border-box;
      padding:0 15mm;
      margin-top:8mm;
      font-family:'Cairo','Segoe UI',Tahoma,sans-serif;
      direction:rtl;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    ">
      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        border-bottom:1.5px solid #1a237e;
        padding-bottom:2mm;
      ">
        ${logoImg(data.logos?.quality, 'flex-start')}
        <div style="flex:1;text-align:center;overflow:hidden;">
          <div style="
            font-size:9pt;
            font-weight:700;
            color:#1a237e;
            line-height:1.4;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          ">${title}</div>
        </div>
        ${logoImg(data.logos?.college, 'flex-end')}
      </div>
    </div>
  `;
}

/**
 * ارتفاع صندوق التذييل المرسوم فعلياً.
 *
 * Chromium يرسم قالب التذييل داخل هامش الصفحة السفلي ويقصّ ما يفيض — ولأن
 * القالب محاذٍ للأسفل (`align-items:flex-end` في صفحة قالب Chromium نفسها)
 * فإن المقصوص هو **أعلى** المحتوى، أي سطر اللقب فوق التوقيع بالضبط.
 * لذلك نثبّت ارتفاعاً أقل من الهامش السفلي بدل ترك المحتوى يحدّد ارتفاعه:
 * أي توقيع أطول من المتوقع يتقلّص داخل الصندوق بدل أن يبتلع اللقب.
 */
const FOOTER_BOX_MM = PDF_CONFIG.margins.bottom - 5;

/** أقصى ارتفاع لصورة التوقيع داخل صندوق التذييل */
const SIGNATURE_IMAGE_MM = 7;

/**
 * خانة التوقيع: اللقب أولاً ثم صورة التوقيع تحته — الترتيب المعتاد في
 * المستندات الرسمية، فالقارئ يعرف صاحب التوقيع قبل أن يراه.
 *
 * اللقب على سطر واحد إجباراً (`nowrap` مع قصّ بالنقاط): اللقب الطويل الملتف
 * على سطرين يرفع الخانة فوق حدّ الهامش فيقصّها Chromium من أعلى ويختفي اللقب
 * كلياً — وهو أسوأ من لقب مختصر بنقاط.
 */
function signatureCells(data: ReportData): string {
  const signatures = (data.signatures ?? []).slice(0, 2);
  const titleStyle =
    'font-size:7pt;color:#1a237e;font-weight:700;line-height:1.25;margin-bottom:0.8mm;' +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:56mm;';

  if (signatures.length === 0) {
    return `
      <div style="text-align:center;min-width:34mm;">
        <div style="${titleStyle}">التوقيع المعتمد</div>
        <div style="border-bottom:1px solid #999;width:32mm;height:4mm;margin:0 auto;"></div>
      </div>`;
  }

  return signatures
    .map((signature) => {
      const name = escapeHtml((signature.name || '').trim() || 'التوقيع المعتمد');
      const image = signature.url?.startsWith('data:')
        ? `<img src="${signature.url}" style="display:block;max-width:28mm;max-height:${SIGNATURE_IMAGE_MM}mm;object-fit:contain;margin:0 auto;" />`
        : `<div style="border-bottom:1px solid #999;width:26mm;height:${SIGNATURE_IMAGE_MM}mm;margin:0 auto;"></div>`;

      return `
        <div style="text-align:center;min-width:28mm;max-width:56mm;">
          <div style="${titleStyle}">${name}</div>
          ${image}
        </div>`;
    })
    .join('');
}

export interface FooterOptions {
  /**
   * الغلاف وفهرس المحتويات صفحتا تعريف بالتقرير لا صفحتا محتوى معتمد، فلا
   * يوقّعهما أحد. تُمرَّر `false` للتمرير الذي يولّد هاتين الصفحتين.
   */
  withSignatures?: boolean;
}

/**
 * التذييل: جهة الإعداد يميناً، ورقم الصفحة من الإجمالي وسطاً، والتوقيع يساراً.
 * `pageNumber` و`totalPages` صنفان خاصان يملؤهما Chromium.
 */
export function buildFooterTemplate(data: ReportData, options: FooterOptions = {}): string {
  const { withSignatures = true } = options;

  return `
    <div style="
      width:100%;
      height:${FOOTER_BOX_MM}mm;
      box-sizing:border-box;
      display:flex;
      align-items:flex-end;
      padding:0 15mm;
      margin-bottom:4mm;
      overflow:hidden;
      font-family:'Cairo','Segoe UI',Tahoma,sans-serif;
      direction:rtl;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    ">
      <div style="
        width:100%;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:4mm;
        border-top:1px solid #c5cae9;
        padding-top:2mm;
      ">
        <!-- الطرفان يتمددان بالتساوي والوسط بقياس محتواه، فيبقى رقم الصفحة في منتصف
             الورقة سواء حمل الطرف المقابل توقيعاً أم كان خالياً في صفحات التعريف -->
        <div style="flex:1 1 0;font-size:8pt;font-weight:700;color:#1a237e;white-space:nowrap;">
          إعداد لجنة القياس والتقويم
        </div>
        <div style="
          flex:0 0 auto;
          background-color:#e8eaf6;
          color:#1a237e;
          font-size:8pt;
          font-weight:700;
          padding:1mm 4mm;
          border-radius:10px;
          border:1px solid #c5cae9;
          white-space:nowrap;
        ">
          <span>صفحة</span>
          <span style="direction:ltr;unicode-bidi:embed;display:inline-block;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </span>
        </div>
        <!-- التوقيع أقصى الشمال: آخر عنصر في تدفّق RTL -->
        <div style="flex:1 1 0;display:flex;align-items:flex-end;justify-content:flex-end;gap:4mm;">
          ${withSignatures ? signatureCells(data) : ''}
        </div>
      </div>
    </div>
  `;
}
