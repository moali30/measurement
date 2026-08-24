/**
 * الصياغات التفسيرية المشتقة من الأرقام.
 * مفصولة عن الحساب حتى يمكن تعديل لغة التقرير بلا مساس بالإحصاء.
 */

export { NARRATIVE_THRESHOLDS } from './scale';

/** تعليق وصفي على أداء محور بناءً على متوسطه */
export function generateAxisComment(average: number): string {
  if (average >= 90) return 'يظهر أداء استثنائي ومتفوق يتجاوز التوقعات';
  if (average >= 80) return 'يظهر أداء متميز وجيد جداً';
  if (average >= 70) return 'يظهر أداء جيد ولكن هناك مجال للتحسين';
  if (average >= 60) return 'يظهر أداء مقبول ولكن يحتاج إلى تحسين';
  return 'يظهر أداء أقل من المطلوب ويحتاج إلى تحسين عاجل';
}

/**
 * وصف تشتت الآراء حول سؤال. الانحراف المعياري وحده لا يقول شيئاً للقارئ غير
 * المتخصص، فنترجمه إلى حكم لفظي على مقياس من خمس درجات.
 */
export function describeDispersion(stdDev: number, scaleMax: number): string {
  const scaleRange = Math.max(1, scaleMax - 1);
  const ratio = stdDev / scaleRange;
  if (ratio < 0.12) return 'إجماع واضح بين المشاركين';
  if (ratio < 0.2) return 'اتفاق جيد مع تباين محدود';
  if (ratio < 0.28) return 'تباين ملحوظ في الآراء';
  return 'انقسام واضح في آراء المشاركين';
}
