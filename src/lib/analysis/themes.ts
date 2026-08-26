/**
 * تصنيف البند إلى مجال عمل قابل للتنفيذ.
 *
 * بدون هذه الطبقة تبقى كل توصية عامة مهما تحسّنت صياغتها: المحرك يعرف أن
 * السؤال ٧ حصل على 62% لكنه لا يعرف أن السؤال يتكلم عن الامتحانات، فيكتب
 * «راجع أسباب التدني» — وهي إعادة صياغة للرقم لا توصية.
 *
 * المصدر الأول اسم المحور لأن المصمم اختاره ليصف مجالاً، والثاني معجم كلمات
 * في نص السؤال. لا نستخدم نموذجاً لغوياً هنا: التصنيف يجب أن يكون حتمياً حتى
 * ينتج التقرير نفسه في كل تشغيل.
 */

export type ThemeKey =
  | 'course-content'
  | 'teaching'
  | 'assessment'
  | 'resources'
  | 'facilities'
  | 'support'
  | 'administration'
  | 'communication'
  | 'training'
  | 'general';

export interface Theme {
  key: ThemeKey;
  label: string;
}

export const THEMES: Record<ThemeKey, Theme> = {
  'course-content': {
    key: 'course-content',
    label: 'محتوى المقررات',
  },
  teaching: {
    key: 'teaching',
    label: 'طرق التدريس',
  },
  assessment: {
    key: 'assessment',
    label: 'التقويم والامتحانات',
  },
  resources: {
    key: 'resources',
    label: 'الموارد والمراجع',
  },
  facilities: {
    key: 'facilities',
    label: 'المعامل والقاعات',
  },
  support: {
    key: 'support',
    label: 'الدعم والإرشاد الطلابي',
  },
  administration: {
    key: 'administration',
    label: 'الإجراءات الإدارية',
  },
  communication: {
    key: 'communication',
    label: 'الإعلان والتواصل',
  },
  training: {
    key: 'training',
    label: 'التدريب الميداني',
  },
  general: {
    key: 'general',
    label: 'مجالات عامة',
  },
};

/**
 * يوحّد الشكل للمقارنة فقط: تُزال التشكيلات والتطويل وتُوحَّد الألف والياء
 * والتاء المربوطة، فيلتقي «الأهداف» و«الاهداف» و«أهدافُ» على مفتاح واحد.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ؐ-ًؚ-ٰٟ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * كلمات مفتاحية لكل مجال، مكتوبة بصيغتها بعد التطبيع.
 * الترتيب لا يهم؛ المجال صاحب أكثر إصابات يفوز.
 */
const LEXICON: Record<Exclude<ThemeKey, 'general'>, string[]> = {
  'course-content': [
    'المقرر', 'المقررات', 'المحتوي', 'محتوي', 'المنهج', 'مفردات', 'التوصيف',
    'الاهداف', 'اهداف', 'المخرجات', 'سوق العمل', 'حداثه', 'يواكب', 'الساعات',
    'الخطه الدراسيه', 'المراجع العلميه',
  ],
  teaching: [
    'التدريس', 'المحاضر', 'المحاضرات', 'الشرح', 'يشرح', 'عضو هييه', 'هييه التدريس',
    'اسلوب', 'اساليب', 'الوسايل التعليميه', 'التفاعل', 'المناقشه', 'الحضور',
    'استاذ', 'الاساتذه', 'يوصل المعلومه',
  ],
  assessment: [
    'التقييم', 'تقييم', 'التقويم', 'الامتحان', 'الامتحانات', 'الاختبار', 'الاختبارات',
    'الدرجات', 'الدرجه', 'النتايج', 'التصحيح', 'الاسيله', 'معايير', 'عدل', 'عداله',
    'الواجبات', 'المشروعات',
  ],
  resources: [
    'المكتبه', 'المراجع', 'الكتب', 'المصادر', 'قواعد البيانات', 'الدوريات',
    'المذكرات', 'المواد التعليميه', 'الموارد', 'مصادر التعلم',
  ],
  facilities: [
    'المعامل', 'المعمل', 'القاعات', 'القاعه', 'المدرجات', 'المبني', 'التكييف',
    'الاضاءه', 'المقاعد', 'النظافه', 'البنيه', 'الملاعب', 'الكافتيريا', 'الانترنت',
    'الشبكه', 'المنصه', 'المرافق', 'التجهيزات', 'الاجهزه', 'مجهزه',
  ],
  support: [
    'الارشاد', 'المرشد', 'الدعم', 'المساعده', 'الانشطه', 'الرعايه', 'التوجيه',
    'الشكاوي', 'المشكلات', 'الطلاب المتعثرين', 'الخدمات الطلابيه', 'التدريب علي المهارات',
  ],
  administration: [
    'الاجراءات', 'شيون الطلاب', 'التسجيل', 'الادار', 'الاداره', 'المواعيد',
    'الجدول', 'الجداول', 'الروتين', 'المعاملات', 'سرعه الانجاز', 'الموظف',
  ],
  communication: [
    'الاعلان', 'معلنه', 'الاعلام', 'التواصل', 'المعلومات', 'واضحه', 'وضوح',
    'دليل الطالب', 'النشر', 'الموقع', 'اخطار', 'الافصاح', 'متاحه', 'رساله الكليه',
  ],
  training: [
    'التدريب الميداني', 'التدريب', 'الميداني', 'التطبيق العملي', 'الاشراف',
    'المجتمعيه', 'اطراف المجتمع', 'جهات التدريب', 'الزيارات',
  ],
};

const NORMALIZED_LEXICON = Object.entries(LEXICON).map(([key, words]) => ({
  key: key as Exclude<ThemeKey, 'general'>,
  words: words.map(normalizeArabic),
}));

/** يزيل بادئة رقم السؤال حتى لا تدخل الأرقام في المطابقة */
export function stripQuestionNumber(question: string): string {
  return question.replace(/^\s*\d+\s*[.)\-]?\s*/, '').trim();
}

/**
 * يصنّف نصاً واحداً. اسم المحور يُرجَّح على نص السؤال لأن المصمم اختاره عمداً
 * ليصف مجالاً، بينما نص السؤال قد يذكر كلمة عابرة من مجال آخر.
 */
export function classifyTheme(question: string, axisName?: string): ThemeKey {
  const scores = new Map<ThemeKey, number>();

  const scoreText = (text: string, weight: number) => {
    const normalized = normalizeArabic(text);
    if (!normalized) return;
    NORMALIZED_LEXICON.forEach(({ key, words }) => {
      const hits = words.filter((word) => normalized.includes(word)).length;
      if (hits > 0) scores.set(key, (scores.get(key) ?? 0) + hits * weight);
    });
  };

  if (axisName) scoreText(axisName, 3);
  scoreText(stripQuestionNumber(question), 1);

  // عند تعادل الإصابات يفوز الأسبق في `LEXICON`. الترتيب هناك مقصود: يبدأ
  // بمجالات المحتوى والتدريس والتقويم وهي جوهر العملية التعليمية، فإذا حمل
  // النص كلمتين من مجالين رُجّح الأقرب إلى صلب العملية. القاعدة حتمية،
  // فالتصنيف نفسه في كل تشغيل.
  let winner: ThemeKey = 'general';
  let best = 0;
  NORMALIZED_LEXICON.forEach(({ key }) => {
    const score = scores.get(key) ?? 0;
    if (score > best) {
      best = score;
      winner = key;
    }
  });
  return winner;
}

export function themeOf(key: ThemeKey): Theme {
  return THEMES[key];
}
