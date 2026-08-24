import { ReportData } from '@/types/analysis';

export type ReportDensity = 'spacious' | 'balanced' | 'compact';

export interface ReportLayoutProfile {
  density: ReportDensity;
  className: string;
  chartWidth: number;
  chartHeight: number;
  commentColumns: 1 | 2 | 3;
  contentScore: number;
}

/** مساحة جسم صفحة A4 بعد هوامش الرأس والتذييل المعرفة في PDF_CONFIG. */
export const PRINT_BODY_HEIGHT_MM = 241;

function textLoad(value: string | undefined, divisor: number): number {
  return value ? value.trim().length / divisor : 0;
}

/**
 * يختار كثافة التقرير من حجم المحتوى الفعلي، لا من عدد أقسام ثابت.
 *
 * الهدف ليس تصغير الخط بلا حدود؛ بل تخفيف الهوامش والمسافات والرسوم تدريجياً
 * مع التقارير الثقيلة، مع بقاء الحد الأدنى للخط محكوماً في print.css.
 */
export function getReportLayoutProfile(data: ReportData): ReportLayoutProfile {
  const questionCharacters = data.results.reduce((sum, item) => sum + item.question.length, 0);
  const commentAnswers = data.comments?.flatMap((group) => group.answers) ?? [];
  const commentCharacters = commentAnswers.reduce((sum, answer) => sum + answer.text.length, 0);
  const longestComment = commentAnswers.reduce(
    (maximum, answer) => Math.max(maximum, answer.text.length),
    0
  );

  const contentScore =
    data.results.length * 1.7 +
    data.axes.length * 1.25 +
    (data.binaryResults?.length ?? 0) * 0.8 +
    textLoad(data.autoComment, 180) +
    textLoad(data.manualComment, 180) +
    questionCharacters / 170 +
    commentCharacters / 240 +
    (data.comparison?.rows.length ?? 0) * 1.2 +
    (data.analysisWarnings?.length ?? 0) * 1.5;

  const density: ReportDensity =
    contentScore >= 78 ? 'compact' : contentScore >= 42 ? 'balanced' : 'spacious';

  return {
    density,
    className: `print-layout--${density}`,
    chartWidth: density === 'compact' ? 302 : density === 'balanced' ? 314 : 326,
    chartHeight: density === 'compact' ? 120 : density === 'balanced' ? 170 : 190,
    commentColumns:
      longestComment > 420 ? 1 : density === 'compact' && longestComment <= 180 ? 3 : 2,
    contentScore: Math.round(contentScore * 10) / 10,
  };
}

function millimetresToPixels(mm: number): number {
  return (mm * 96) / 25.4;
}

function outerHeight(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  return (
    element.getBoundingClientRect().height +
    Number.parseFloat(style.marginTop || '0') +
    Number.parseFloat(style.marginBottom || '0')
  );
}

/**
 * يضيف فواصل صفحة انتقائية بعد قياس المحتوى بالخطوط النهائية.
 *
 * لا يبدأ كل قسم في صفحة جديدة. يبدأه في المساحة المتبقية ما دامت تكفي
 * عنوانه ووحدته الأولى؛ وإلا ينقله كاملاً حتى لا يبقى عنوان منفرد أو صف واحد.
 * الأقسام الطويلة والجداول تظل قابلة للتدفق، فيكرر Chromium رأس الجدول ويمنع
 * كسر الصفوف. تحفظ القرارات في data attributes لتسهيل اختبارها وتشخيصها.
 */
export function balanceReportPageStarts(root: HTMLElement): void {
  const pageHeight = millimetresToPixels(PRINT_BODY_HEIGHT_MM);
  const breathingRoom = millimetresToPixels(7);
  const sections = Array.from(
    root.querySelectorAll<HTMLElement>('[data-layout-section="true"]')
  );

  sections.forEach((section) => {
    section.classList.remove('print-section--smart-break');
    delete section.dataset.layoutDecision;
  });

  let consumed = 0;
  sections.forEach((section, index) => {
    const title = section.querySelector<HTMLElement>('.print-section-title');
    const lead =
      section.querySelector<HTMLElement>('[data-layout-lead="true"]') ??
      Array.from(section.children).find(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && !child.classList.contains('print-section-title')
      );
    const starterHeight = Math.min(
      pageHeight * 0.4,
      (title ? outerHeight(title) : 0) + (lead ? outerHeight(lead) : 0) + breathingRoom
    );
    const usedOnPage = consumed % pageHeight;
    const remaining = usedOnPage === 0 ? pageHeight : pageHeight - usedOnPage;

    if (index > 0 && usedOnPage > 0 && remaining < starterHeight) {
      section.classList.add('print-section--smart-break');
      section.dataset.layoutDecision = 'new-page-insufficient-starter-space';
      consumed += remaining;
    } else {
      section.dataset.layoutDecision = 'use-remaining-space';
    }

    consumed += outerHeight(section);
  });

  root.dataset.layoutEstimatedPages = String(Math.max(1, Math.ceil(consumed / pageHeight)));
}
