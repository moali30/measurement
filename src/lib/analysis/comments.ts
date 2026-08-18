/**
 * تنظيف وتجميع تعليقات المشاركين النصية.
 *
 * قبل هذا الملف كانت التعليقات تُطبع تفريغاً خاماً: إجابات مكررة حرفياً، و«لا
 * يوجد» و«-» تحتل صفحات، ولا يعرف القارئ كم شخصاً قال نفس الشيء. النتيجة كانت
 * قسماً طويلاً بلا معلومة.
 */

/** إجابات لا تحمل محتوى — تُستبعد من الطباعة */
const NULL_ANSWERS = new Set([
  'لا',
  'لا يوجد',
  'لايوجد',
  'لا شيء',
  'لاشيء',
  'ولا حاجة',
  'مفيش',
  'لا توجد',
  'لا يوجد شيء',
  'غير موجود',
  'بدون',
  'بدون تعليق',
  'لا تعليق',
  'لا أعرف',
  'لا اعرف',
  'no',
  'none',
  'nothing',
  'n/a',
  'na',
  '-',
  '--',
  '.',
  '0',
]);

/** أقصر من هذا لا يُعدّ تعليقاً ذا معنى */
const MIN_MEANINGFUL_LENGTH = 3;

export interface AggregatedAnswer {
  text: string;
  /** كم مشاركاً قدّم هذه الإجابة (بعد التطبيع) */
  occurrences: number;
}

export interface CommentGroup {
  question: string;
  /** الإجابات ذات المعنى، مرتبة بالتكرار ثم بالطول */
  answers: AggregatedAnswer[];
  /** إجمالي من أجاب على السؤال قبل التنظيف */
  totalResponses: number;
  /** كم إجابة استُبعدت لأنها فارغة المحتوى */
  skippedCount: number;
}

/**
 * يوحّد الشكل للمقارنة فقط: تُزال التشكيلات وعلامات الترقيم والمسافات الزائدة
 * وتُوحَّد الألف والياء والتاء المربوطة. النص المعروض يبقى كما كتبه المشارك.
 */
function normalizeForComparison(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, '') // التشكيل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    // نطاقات صريحة بدلاً من Unicode property escapes لأن هدف TypeScript في
    // المشروع هو ES5. نغطي العربية وامتداداتها والحروف/الأرقام اللاتينية.
    .replace(/[^A-Za-z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s]/g, '') // الترقيم
    .replace(/\s+/g, ' ')
    .trim();
}

function isMeaningful(text: string): boolean {
  const normalized = normalizeForComparison(text);
  if (normalized.length < MIN_MEANINGFUL_LENGTH) return false;
  if (NULL_ANSWERS.has(normalized)) return false;
  // تكرار حرف واحد ("ااااا") أو أرقام فقط
  if (/^(.)\1*$/.test(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  return true;
}

/**
 * يجمّع إجابات سؤال نصي واحد: يستبعد ما لا معنى له، ويدمج المتطابق مع عدّ
 * التكرار، ويرتّب الأكثر تكراراً أولاً.
 */
export function aggregateAnswers(question: string, rawAnswers: string[]): CommentGroup {
  const totalResponses = rawAnswers.length;
  const buckets = new Map<string, AggregatedAnswer>();
  let skippedCount = 0;

  rawAnswers.forEach((raw) => {
    const text = raw.trim();
    if (!isMeaningful(text)) {
      skippedCount += 1;
      return;
    }

    const key = normalizeForComparison(text);
    const existing = buckets.get(key);
    if (existing) {
      existing.occurrences += 1;
      // نحتفظ بأطول صياغة — عادةً الأكمل إملائياً
      if (text.length > existing.text.length) existing.text = text;
    } else {
      buckets.set(key, { text, occurrences: 1 });
    }
  });

  const answers = Array.from(buckets.values()).sort(
    (a, b) => b.occurrences - a.occurrences || b.text.length - a.text.length
  );

  return { question, answers, totalResponses, skippedCount };
}

/** يطبّق التجميع على كل أسئلة التعليقات ويحذف السؤال الذي لم يبق فيه شيء */
export function aggregateCommentGroups(
  groups: { question: string; answers: string[] }[]
): CommentGroup[] {
  return groups
    .map((group) => aggregateAnswers(group.question, group.answers))
    .filter((group) => group.answers.length > 0);
}
