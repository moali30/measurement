/**
 * ثوابت مقياس القياس وعتبات الحكم.
 *
 * مفصولة في ملف مستقل لأن صفحة المنهجية داخل التقرير تعرضها للقارئ حرفياً،
 * فلا يصح أن تكون أرقاماً سحرية مبعثرة في الكود. المرحلة القادمة ستضيف اكتشاف
 * السُّلَّم تلقائياً لكل سؤال بدل الافتراض الثابت هنا.
 */

/** السُّلَّم المفترض حالياً في كل الحسابات */
export const ANALYSIS_SCALE = {
  min: 1,
  max: 5,
  label: 'مقياس ليكرت الخماسي',
} as const;

/**
 * أرضية المقياس: أسوأ إجابة ممكنة لا تعطي صفراً بل هذه النسبة.
 * تُعرض صراحةً في صفحة المنهجية حتى لا يُقرأ الرقم على أنه من صفر إلى مئة.
 */
export const SCALE_FLOOR_PERCENT = Math.round(
  (ANALYSIS_SCALE.min / ANALYSIS_SCALE.max) * 100
);

export interface Grade {
  label: string;
  /** لون النص — مضبوط ليقرأ على خلفية بيضاء في الطباعة */
  color: string;
  /** خلفية خفيفة لخلية الجدول */
  background: string;
}

/** العتبات مرتبة تنازلياً — أول تطابق يفوز */
const GRADE_BANDS: ReadonlyArray<{ min: number } & Grade> = [
  { min: 90, label: 'ممتاز',    color: '#1b5e20', background: '#e8f5e9' },
  { min: 80, label: 'جيد جداً', color: '#2e7d32', background: '#f1f8e9' },
  { min: 70, label: 'جيد',      color: '#8a5300', background: '#fff8e1' },
  { min: 60, label: 'مقبول',    color: '#e65100', background: '#fff3e0' },
  { min: -Infinity, label: 'ضعيف', color: '#b71c1c', background: '#ffebee' },
];

/** يترجم الوزن النسبي إلى درجة تقييم نصية */
export function gradeFor(relativeWeight: number): Grade {
  const band = GRADE_BANDS.find((b) => relativeWeight >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
  return { label: band.label, color: band.color, background: band.background };
}

/** العتبات المستخدمة في الصياغة التفسيرية (نقاط قوة / ضعف) */
export const NARRATIVE_THRESHOLDS = {
  strength: 85,
  weakness: 70,
} as const;

/** حدود تصنيف الأداء في الرسم الدائري */
export const DISTRIBUTION_BANDS = {
  high: 80,
  medium: 60,
} as const;
