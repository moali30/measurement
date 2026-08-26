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

/** حدود شدة النسبة داخل جدول انقسام الآراء */
export const SHARE_BANDS = {
  high: 40,
  medium: 20,
} as const;

export type ShareTone = 'negative' | 'neutral' | 'positive';
export type ShareLevel = 'high' | 'medium' | 'low';

export interface CellStyle {
  color: string;
  background: string;
}

/**
 * لون خلية النسبة: الدرجة اللونية تتبع حجم النسبة، والعائلة اللونية تتبع اتجاه
 * الرأي. لون واحد لكل الأعمدة كان يجعل «رفض 45%» و«موافقة 45%» متطابقين بصرياً
 * رغم أنهما نقيضان.
 */
const SHARE_PALETTE: Record<ShareTone, Record<ShareLevel, CellStyle>> = {
  negative: {
    high:   { color: '#7f1010', background: '#f6c9c9' },
    medium: { color: '#b71c1c', background: '#fce4e4' },
    low:    { color: '#a86a6a', background: '#fdf6f6' },
  },
  neutral: {
    high:   { color: '#6d4a00', background: '#fbe6b4' },
    medium: { color: '#8a5300', background: '#fff6dd' },
    low:    { color: '#a89463', background: '#fffdf6' },
  },
  positive: {
    high:   { color: '#14481a', background: '#c7e6cc' },
    medium: { color: '#2e7d32', background: '#e6f4e8' },
    low:    { color: '#6f9c74', background: '#f7fbf7' },
  },
};

/** شدة النسبة: مرتفعة / متوسطة / منخفضة */
export function shareLevel(percentage: number): ShareLevel {
  if (percentage >= SHARE_BANDS.high) return 'high';
  if (percentage >= SHARE_BANDS.medium) return 'medium';
  return 'low';
}

export function shareStyle(tone: ShareTone, percentage: number): CellStyle {
  return SHARE_PALETTE[tone][shareLevel(percentage)];
}

export const SHARE_LEVEL_LABELS: Record<ShareLevel, string> = {
  high: `مرتفعة (${SHARE_BANDS.high}% فأعلى)`,
  medium: `متوسطة (${SHARE_BANDS.medium}% إلى أقل من ${SHARE_BANDS.high}%)`,
  low: `منخفضة (أقل من ${SHARE_BANDS.medium}%)`,
};
