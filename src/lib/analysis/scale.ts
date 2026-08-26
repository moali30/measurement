/**
 * ثوابت مقياس القياس وعتبات الحكم.
 *
 * مفصولة في ملف مستقل لأن صفحة المنهجية داخل التقرير تعرضها للقارئ حرفياً،
 * فلا يصح أن تكون أرقاماً سحرية مبعثرة في الكود.
 *
 * السُّلَّم ثابت: كل ما يدخل التحليل الكمي هو مقياس ليكرت الخماسي. الأسئلة ذات
 * الإجابتين أو الثلاث ليست ليكرت — هي متغيرات ديموغرافية تُوصف ولا تُقيَّم،
 * ولذلك لا يوجد اكتشاف للسُّلَّم ولا خيار لتغييره.
 */

/** السُّلَّم الوحيد المعتمد في التحليل الكمي */
export const ANALYSIS_SCALE = {
  min: 1,
  max: 5,
  /** عدد البدائل التي يجب أن يحملها سؤال ليكرت ليدخل التحليل */
  points: 5,
  label: 'مقياس ليكرت الخماسي',
} as const;

/** أرضية الوزن النسبي: أسوأ إجابة ممكنة لا تعطي صفراً بل هذه النسبة */
export const RELATIVE_WEIGHT_FLOOR =
  Math.round((ANALYSIS_SCALE.min / ANALYSIS_SCALE.max) * 1000) / 10;

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

/**
 * معيار اعتبار السؤال منقسماً.
 *
 * المتوسط وحده يخفي الانقسام تماماً: عيّنة نصفها رافض ونصفها موافق تعطي نفس
 * المتوسط ونفس الوزن النسبي لعيّنة كلها محايدة. لذلك نرصد طرفي التوزيع مباشرة
 * بدل الاعتماد على الانحراف المعياري، لأن نسبة مئوية يفهمها القارئ غير المتخصص
 * بينما رقم مثل 1.83 لا يقول له شيئاً.
 */
export const POLARIZATION = {
  /** يجب أن يبلغ كل طرف هذه النسبة من الاستجابات الصالحة */
  endShare: 20,
} as const;

/** عتبات الملاحظات النوعية — ليست أخطاء بل حدود قراءة */
export const QUALITY_THRESHOLDS = {
  /** أقل من هذا العدد لا يحتمل تعميماً */
  minimumRespondents: 30,
  /** معدل استجابة أدنى من هذا يعني سؤالاً غامضاً أو حساساً */
  minimumResponseRate: 70,
  /** ألفا أدنى من هذا يجعل متوسط المحور مشكوكاً فيه */
  minimumAlpha: 0.7,
  /** ألفا أعلى من هذا يشير إلى بنود مكررة لا إلى ثبات أفضل */
  redundantAlpha: 0.95,
  /** محور بأقل من هذا العدد لا يُحسب له ثبات معتبر */
  minimumAxisItems: 3,
} as const;

export type ShareTone = 'negative' | 'neutral' | 'positive';

export interface CellStyle {
  color: string;
  background: string;
}

/**
 * لون واحد لكل اتجاه رأي، بلا تدرّج حسب حجم النسبة.
 *
 * التدرّج الثلاثي كان يحمّل الجدول معنيين في وقت واحد — العائلة اللونية تقول
 * الاتجاه والدرجة تقول الحجم — فاحتاج وسيلة إيضاح بأربعة عناصر وسطر شرح.
 * والرقم نفسه مكتوب في الخلية، فالتدرّج يكرر ما تقرؤه العين أصلاً.
 */
const SHARE_STYLES: Record<ShareTone, CellStyle> = {
  negative: { color: '#b71c1c', background: '#fdecea' },
  neutral: { color: '#8a5300', background: '#fff8e1' },
  positive: { color: '#1b5e20', background: '#e8f5e9' },
};

export function shareStyle(tone: ShareTone): CellStyle {
  return SHARE_STYLES[tone];
}
