/**
 * محرك التوصيات: يحوّل النتائج المصنَّفة إلى إجراءات قابلة للتنفيذ والقياس.
 *
 * ثلاثة قيود حكمت التصميم:
 *
 * ١) **حتمي بالكامل.** نفس البيانات تنتج نفس التوصيات بالحرف. لا نموذج لغوياً
 *    في المسار، فتقرير رسمي لا يحتمل أن تتغير توصياته بين تشغيلين.
 *
 * ٢) **لا رقم بلا أصل.** كل رقم في نص التوصية مأخوذ من `evidence` الخاص
 *    بنتيجتها، ويتحقق منه المدقّق. هذا ما يمنع «أرقاماً» مخترعة في تقرير معتمد.
 *
 * ٣) **توصية لكل مجال لا لكل سؤال.** خمسة بنود ضعيفة في التقويم تنتج توصية
 *    واحدة تذكرها جميعاً، لا خمس فقرات متطابقة تختلف في رقم السؤال وحده.
 */

import type { CommentGroup } from './comments';
import type { ReportData } from '@/types/analysis';
import { DISTRIBUTION_BANDS, NARRATIVE_THRESHOLDS } from './scale';
import {
  Finding,
  FINDING_THRESHOLDS,
  FindingEvidence,
  FindingKind,
  collectFindings,
} from './findings';
import { ThemeKey, classifyTheme, themeOf } from './themes';

export type Priority = 'عاجلة' | 'عالية' | 'متوسطة' | 'داعمة';

export interface Recommendation {
  id: string;
  /** النتائج التي وُلدت منها — يربط كل توصية بأدلتها الرقمية */
  findingIds: string[];
  kind: FindingKind;
  theme: ThemeKey;
  priority: Priority;
  severity: number;
  /** ماذا يُفعل */
  action: string;
  /** لماذا: الأرقام التي استدعت الإجراء */
  rationale: string;
  /** بماذا يُقاس النجاح — الوزن النسبي في كل التوصيات */
  indicator: string;
  /** الهدف الرقمي المعبَّر عنه بالوزن النسبي */
  target: string;
  /** أرقام الأسئلة المشمولة */
  questionNumbers: number[];
  /** اقتباسات داعمة من تعليقات المشاركين */
  quotes: string[];
}

/** ألوان شارة الأولوية، مضبوطة لتُقرأ على ورق أبيض */
export const PRIORITY_STYLES: Record<Priority, { color: string; background: string }> = {
  عاجلة: { color: '#b71c1c', background: '#fdecea' },
  عالية: { color: '#e65100', background: '#fff3e0' },
  متوسطة: { color: '#8a5300', background: '#fff8e1' },
  داعمة: { color: '#1b5e20', background: '#e8f5e9' },
};

/** أقصى عدد توصيات — قائمة أطول من هذا لا تُقرأ ولا تُنفَّذ */
export const MAX_RECOMMENDATIONS = 10;

/** أقصى عدد نقاط قوة تُذكر؛ ما بعدها تعداد لا توصية */
export const MAX_STRENGTH_RECOMMENDATIONS = 2;

const PRIORITY_BANDS: ReadonlyArray<{ min: number; label: Priority }> = [
  { min: 80, label: 'عاجلة' },
  { min: 60, label: 'عالية' },
  { min: 40, label: 'متوسطة' },
  { min: -Infinity, label: 'داعمة' },
];

/** المؤشر موحَّد: مقياس واحد يتابَع به كل التوصيات مهما اختلف نوع المشكلة */
const INDICATOR = 'الوزن النسبي';

function priorityFor(severity: number) {
  return PRIORITY_BANDS.find((band) => severity >= band.min) ?? PRIORITY_BANDS[3];
}

/**
 * الإجراء المقترح لكل (نوع مشكلة × مجال).
 * الصياغة تصف عملاً محدداً يمكن لجهة أن تبدأه غداً، لا نية عامة بالتحسين.
 */
const ACTIONS: Partial<Record<FindingKind, Partial<Record<ThemeKey, string>>>> = {
  'critical-weakness': {
    'course-content':
      'مراجعة توصيف المقررات المعنية ومواءمة مفرداتها مع مخرجات التعلم ومتطلبات سوق العمل، وحذف الموضوعات المكررة.',
    teaching:
      'عقد ورشة إلزامية في أساليب التدريس التفاعلي لأعضاء هيئة التدريس المعنيين، مع زيارات صفية تبادلية وتغذية راجعة مكتوبة.',
    assessment:
      'إعلان توصيف التقويم ومعايير التصحيح في أول محاضرة ونشره على المنصة، ومراجعة عيّنة من أوراق الإجابة بلجنة ثنائية.',
    resources:
      'حصر المراجع الناقصة لكل مقرر وتوفيرها ورقياً ورقمياً قبل بدء الفصل، وإتاحة نسخ إلكترونية على المنصة.',
    facilities:
      'حصر أعطال المعامل والقاعات وإصلاح الأعطال المتكررة، وإحلال الأجهزة التي تجاوزت عمرها التشغيلي.',
    support:
      'تفعيل ساعات الإرشاد الأكاديمي بمواعيد معلنة، وتخصيص مرشد لكل مجموعة طلابية مع سجل متابعة موثّق.',
    administration:
      'إعادة هندسة الإجراء الأبطأ في شؤون الطلاب وتحديد زمن إنجاز معياري لكل معاملة وإعلانه.',
    communication:
      'نشر المعلومات المطلوبة في دليل الطالب وعلى الموقع والمنصة، وتحديثها كلما تغيّرت.',
    training:
      'مراجعة اتفاقيات جهات التدريب، وزيارة كل جهة ميدانياً، وتوثيق تقرير لكل متدرب.',
    general:
      'تحليل أسباب التدني في هذا المجال بمراجعة إجراءاته الحالية ومقارنتها بما تطبقه الأقسام الأعلى تقييماً.',
  },
  polarization: {
    'course-content':
      'استطلاع الفئة الرافضة لتحديد الموضوعات التي تراها زائدة أو ناقصة تحديداً، ثم تعديل مفردات المقرر بناءً على ما تذكره لا على المتوسط.',
    teaching:
      'استطلاع الفئة الرافضة لمعرفة ما إذا كان التباين راجعاً لاختلاف الشُّعب أو المحاضرين، ثم توحيد الحد الأدنى لأسلوب العرض بينها.',
    assessment:
      'استطلاع الفئة الرافضة لتحديد أي مرحلة من التقويم أثارت الاعتراض (وضوح المعايير، أو التصحيح، أو توزيع الدرجات)، ثم معالجة تلك المرحلة تحديداً.',
    resources:
      'استطلاع الفئة الرافضة لتحديد المراجع الناقصة بعينها ولمن، فقد تكون النواقص في تخصص واحد لا في المكتبة كلها.',
    facilities:
      'استطلاع الفئة الرافضة لتحديد المعمل أو القاعة محل الشكوى، فالانقسام غالباً يعني أن المشكلة في موقع بعينه لا في المرافق كلها.',
    support:
      'استطلاع الفئة الرافضة لمعرفة من لم يصله الإرشاد ولماذا، فالانقسام هنا يعني خدمة تصل لبعض الطلاب دون بعض.',
    administration:
      'استطلاع الفئة الرافضة لتحديد المعاملة الأبطأ ومَن يتعثر فيها، ثم إعادة هندسة تلك المعاملة وحدها.',
    communication:
      'استطلاع الفئة الرافضة لمعرفة القناة التي لم تصلها المعلومة، فالانقسام يعني إعلاناً وصل لفئة دون أخرى.',
    training:
      'استطلاع الفئة الرافضة لتحديد جهات التدريب محل الاعتراض، فالانقسام غالباً يعكس تفاوتاً بين الجهات لا ضعفاً في البرنامج.',
    general:
      'استطلاع الفئة الرافضة بمجموعة نقاش مركّزة لتحديد سبب الانقسام قبل أي إجراء، ثم معالجة السبب لا المتوسط.',
  },
  weakness: {
    'course-content':
      'تحديث الموضوعات الأقل تقييماً في المقررات المعنية وإضافة تطبيقات عملية مرتبطة بمشكلات حقيقية.',
    teaching:
      'تنويع أساليب العرض بإضافة أنشطة صفية قصيرة ودراسات حالة، وقياس أثرها بتقييم منتصف الفصل.',
    assessment:
      'نشر نماذج امتحانات سابقة مع نموذج إجابة استرشادي، وتوزيع الدرجات على تقويم مستمر بدل امتحان واحد.',
    resources:
      'تحديث قائمة المراجع الأساسية سنوياً وربطها بقواعد البيانات الرقمية المتاحة للكلية.',
    facilities:
      'جدولة استخدام المعامل والقاعات بما يمنع التزاحم، ومعالجة ملاحظات التهوية والإضاءة والمقاعد.',
    support:
      'إطلاق برنامج دعم للطلاب المتعثرين بساعات مكتبية إضافية ومجموعات مذاكرة موجَّهة.',
    administration:
      'اختصار خطوات المعاملات الأكثر تكراراً وإتاحة تقديمها إلكترونياً، مع لوحة متابعة لزمن الإنجاز.',
    communication:
      'توحيد قنوات الإعلان في قناة رسمية واحدة، وإرسال ملخص أسبوعي بالمواعيد والقرارات.',
    training:
      'زيادة عدد جهات التدريب المتاحة وتنويعها، وربط مهام المتدرب بمخرجات تعلم معلنة مسبقاً.',
    general:
      'مراجعة إجراءات هذا المجال وتحديد أضعف حلقة فيها ومعالجتها أولاً.',
  },
};

const FALLBACK_ACTION =
  'مراجعة إجراءات هذا المجال وتحديد أضعف حلقة فيها ومعالجتها أولاً.';

/** ضعف المحور هو مشكلة الضعف نفسها على نطاق أوسع، فيرث إجراءها في المجال */
const KIND_ALIASES: Partial<Record<FindingKind, FindingKind>> = {
  'axis-weakness': 'weakness',
};

/**
 * الأولوية للقالب الخاص بالمجال، ثم للصيغة العامة لنوع المشكلة.
 * العكس كان يجعل كل البنود المنقسمة تحمل الجملة نفسها مهما اختلف مجالها.
 */
function actionFor(kind: FindingKind, theme: ThemeKey): string {
  const specific = ACTIONS[kind]?.[theme];
  if (specific) return specific;
  const override = KIND_ACTION_OVERRIDE[kind];
  if (override) return override;
  const source = KIND_ALIASES[kind] ?? kind;
  return ACTIONS[source]?.[theme] ?? ACTIONS[source]?.general ?? FALLBACK_ACTION;
}

/** أقرب عتبة تقييم أعلى من الوضع الحالي — هدف قابل للتحقق لا رقم اعتباطي */
function nextBand(current: number): number {
  const bands = [DISTRIBUTION_BANDS.medium, NARRATIVE_THRESHOLDS.weakness, DISTRIBUTION_BANDS.high, 90];
  return bands.find((band) => band > current) ?? 95;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** صيغة العدد العربية للبنود — «بند واحد» لا «1 بنداً» */
function itemsLabel(count: number): string {
  if (count === 1) return 'بند واحد';
  if (count === 2) return 'بندين';
  if (count <= 10) return `${count} بنود`;
  return `${count} بنداً`;
}

function listQuestions(numbers: number[]): string {
  if (numbers.length === 1) return `السؤال ${numbers[0]}`;
  if (numbers.length === 2) return `السؤالان ${numbers[0]} و${numbers[1]}`;
  return `الأسئلة ${numbers.slice(0, 6).join('، ')}${numbers.length > 6 ? ' وغيرها' : ''}`;
}

/** يلتقط اقتباسين داعمين من تعليقات المشاركين في المجال نفسه */
function quotesForTheme(theme: ThemeKey, comments: CommentGroup[] | undefined): string[] {
  if (!comments || theme === 'general') return [];
  const matches: { text: string; occurrences: number }[] = [];

  comments.forEach((group) => {
    group.answers.forEach((answer) => {
      if (classifyTheme(answer.text, group.question) === theme) {
        matches.push({ text: answer.text, occurrences: answer.occurrences });
      }
    });
  });

  return matches
    .sort((a, b) => b.occurrences - a.occurrences || a.text.localeCompare(b.text, 'ar'))
    .slice(0, 2)
    .map((match) =>
      match.occurrences > 1 ? `${match.text} (تكرر ${match.occurrences} مرات)` : match.text
    );
}

interface Bucket {
  theme: ThemeKey;
  /** أشدّ نتيجة في المجال — تحدد الإجراء والمؤشر والهدف */
  primary: Finding;
  /** نتائج من نوع الأشدّ نفسه، وهي مصدر أرقام المبرر الأساسي */
  primaryGroup: Finding[];
  /** إشارات أخرى في المجال تُذكر داخل المبرر ولا تستقل بتوصية */
  secondary: Finding[];
  findings: Finding[];
}

/**
 * توصية واحدة لكل مجال.
 *
 * التجميع بـ(نوع المشكلة × المجال) كان ينتج ثلاث توصيات للمكتبة: واحدة لضعف
 * بنودها، وثانية لانقسام الرأي حولها، وثالثة لضعف محورها — وكلها تصف الحالة
 * نفسها وتُوجَّه للجهة نفسها في المدة نفسها. لجنة الجودة تحتاج صفاً واحداً لكل
 * مجال يجمع الصورة كاملة، لا ثلاثة صفوف تتنافس على نفس الاجتماع.
 */
function bucketize(findings: Finding[]): Bucket[] {
  const byTheme = new Map<ThemeKey, Finding[]>();
  findings.forEach((finding) => {
    const list = byTheme.get(finding.theme) ?? [];
    list.push(finding);
    byTheme.set(finding.theme, list);
  });

  return Array.from(byTheme.entries()).map(([theme, all]) => {
    const sorted = [...all].sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id));
    const primary = sorted[0];
    return {
      theme,
      primary,
      primaryGroup: sorted.filter((finding) => finding.kind === primary.kind),
      secondary: sorted.filter((finding) => finding.kind !== primary.kind),
      findings: sorted,
    };
  });
}

interface RationaleParts {
  text: string;
}

/**
 * هدف واحد لكل توصية، معبَّر عنه بالوزن النسبي.
 *
 * كان لكل نوع مشكلة مقياسه: نسبة الرافضين للانقسام، وألفا للثبات، وفارق النقاط
 * للفجوة بين الفئات. متابعة خطة بستة مقاييس مختلفة لا تُنفَّذ عملياً، فوُحِّدت
 * على المقياس الذي يراه القارئ أمام كل بند في جدول النتائج.
 */
function buildTarget(evidence: FindingEvidence, kind: FindingKind): string {
  if (kind === 'strength') {
    return `الحفاظ عليه عند ${NARRATIVE_THRESHOLDS.strength}% فأعلى`;
  }
  const weight = round2(evidence.relativeWeight ?? evidence.axisAverage ?? 0);
  return `رفعه من ${weight}% إلى ${nextBand(weight)}% فأعلى`;
}

/**
 * يبني المبرر من الأدلة الرقمية وحدها.
 * كل رقم هنا مأخوذ حرفياً من `evidence`، فلا يمكن أن يظهر رقم بلا أصل.
 */
function buildRationale(bucket: Bucket, questionNumbers: number[]): RationaleParts {
  const worst = bucket.primary;
  const evidence = worst.evidence;

  switch (worst.kind) {
    case 'critical-weakness':
    case 'weakness': {
      const weight = evidence.relativeWeight ?? 0;
      const scope =
        questionNumbers.length > 1
          ? `${listQuestions(questionNumbers)} دون عتبة ${NARRATIVE_THRESHOLDS.weakness}%، وأدناها ${weight}%`
          : `${listQuestions(questionNumbers)} بوزن نسبي ${weight}%`;
      const tail =
        evidence.negativeShare && evidence.negativeShare > 0
          ? `، ولم يوافق عليها ${evidence.negativeShare}% من المشاركين`
          : '';
      return { text: `${scope}${tail}.` };
    }

    case 'polarization': {
      return {
        text:
          `${listQuestions(questionNumbers)} انقسم الرأي حولها: ` +
          `${evidence.negativeShare}% غير موافقين مقابل ${evidence.positiveShare}% موافقين، ` +
          `والوزن النسبي ${evidence.relativeWeight}% لا يكشف هذا الانقسام.`,
      };
    }

    case 'negative-tail': {
      return {
        text:
          `${listQuestions(questionNumbers)} يرفضها ${evidence.negativeShare}% من المشاركين ` +
          `رغم أن وزنها النسبي ${evidence.relativeWeight}% يبدو مقبولاً.`,
      };
    }

    case 'axis-weakness': {
      const names = bucket.primaryGroup.map((finding) => `«${finding.axisName}»`).join('، ');
      return {
        text: `متوسط ${names} ${evidence.axisAverage}% وهو دون عتبة ${FINDING_THRESHOLDS.axisWeakness}%، محسوباً على ${itemsLabel(evidence.items ?? 0)}.`,
      };
    }

    case 'group-gap': {
      const [lower, higher] = evidence.categories ?? ['', ''];
      return {
        text:
          `فجوة ${evidence.gap} نقطة بين فئتي «${higher}» و«${lower}» في محور «${worst.axisName}»، ` +
          `وأدنى الفئتين عند ${evidence.axisAverage}%.`,
      };
    }

    case 'low-reliability': {
      return {
        text:
          `ألفا كرونباخ لمحور «${worst.axisName}» ${evidence.alpha}، أي أن بنوده لا تقيس بعداً ` +
          `واحداً متماسكاً، فمتوسطه ${evidence.axisAverage}% أضعف دلالة مما يبدو.`,
      };
    }

    case 'low-response': {
      return {
        text: `${listQuestions(questionNumbers)} أجاب عنها ${evidence.responseRate}% فقط من المشاركين، ما يشير إلى غموض الصياغة أو حساسية الموضوع.`,
      };
    }

    case 'strength': {
      return {
        text: `${listQuestions(questionNumbers)} حصلت على ${evidence.relativeWeight}% ووافق عليها ${evidence.positiveShare}% من المشاركين.`,
      };
    }

    default:
      return { text: '' };
  }
}

/** جملة قصيرة تصف إشارة ثانوية في المجال، بأرقامها من أدلتها هي */
function secondaryClause(finding: Finding): string {
  const evidence = finding.evidence;
  switch (finding.kind) {
    case 'polarization':
      return (
        `كما انقسم الرأي حول السؤال ${finding.questionNumber}: ${evidence.negativeShare}% غير ` +
        `موافقين مقابل ${evidence.positiveShare}% موافقين، وهو انقسام لا يظهر في المتوسط.`
      );
    case 'negative-tail':
      return `ويرفض السؤال ${finding.questionNumber} ${evidence.negativeShare}% من المشاركين رغم وزنه ${evidence.relativeWeight}%.`;
    case 'axis-weakness':
      return `ومتوسط محور «${finding.axisName}» ككل ${evidence.axisAverage}% على ${itemsLabel(evidence.items ?? 0)}.`;
    case 'group-gap':
      return `وتوجد فجوة ${evidence.gap} نقطة بين فئتي «${(evidence.categories ?? [])[1]}» و«${(evidence.categories ?? [])[0]}».`;
    case 'low-reliability':
      return `وألفا محور «${finding.axisName}» ${evidence.alpha}، فمتوسطه أضعف دلالة مما يبدو.`;
    case 'low-response':
      return `وأجاب عن السؤال ${finding.questionNumber} ${evidence.responseRate}% فقط من المشاركين.`;
    case 'critical-weakness':
    case 'weakness':
      return `والسؤال ${finding.questionNumber} عند ${evidence.relativeWeight}%.`;
    case 'strength':
      return `ويقابل ذلك تميّز في السؤال ${finding.questionNumber} بوزن ${evidence.relativeWeight}%.`;
    default:
      return '';
  }
}

const KIND_ACTION_OVERRIDE: Partial<Record<FindingKind, string>> = {
  polarization:
    'استطلاع الفئة الرافضة بمجموعة نقاش مركّزة لتحديد سبب الانقسام قبل أي إجراء، ثم معالجة السبب لا المتوسط.',
  'negative-tail':
    'تحديد الفئة الرافضة من بيانات المقارنة ومعالجة سببها المحدد بدل إجراء عام يستهدف الجميع.',
  'low-reliability':
    'مراجعة صياغة بنود المحور وحذف المزدوج منها أو الغامض، وإعادة اختبار ثباته في الدورة القادمة.',
  'low-response':
    'إعادة صياغة البند بلغة أوضح، وجعل الإجابة عنه اختيارية معلنة إن كان موضوعه حساساً.',
  strength:
    'توثيق الممارسة التي أنتجت هذه النتيجة ونشرها على بقية الأقسام كممارسة مرجعية.',
  'group-gap':
    'تحليل أسباب الفجوة بين الفئتين وتوجيه المعالجة للفئة الأدنى تحديداً بدل إجراء موحّد للجميع.',
};

/** لواحق تُضاف للإجراء حين تصاحب المشكلةَ الأساسية إشارةٌ من نوع آخر */
const SECONDARY_ACTION_SUFFIX: Partial<Record<FindingKind, string>> = {
  polarization:
    ' وقبل التنفيذ، استطلع الفئة الرافضة لتحديد سبب الانقسام، فالمتوسط وحده لا يدل عليه.',
  'group-gap': ' ووجّه المعالجة للفئة الأدنى تحديداً بدل إجراء موحّد للجميع.',
  'low-reliability': ' وراجع صياغة بنود المحور قبل الاعتماد على متوسطه في القياس القادم.',
  'low-response': ' وأعد صياغة البند الأقل استجابةً بلغة أوضح.',
};

/**
 * ترتيب أنواع المشكلات عند تساوي الشدة.
 * ما يخفيه المتوسط يسبق ما يظهره، لأن الأول لا يراه أحد بغير هذا التقرير.
 */
const KIND_ORDER: FindingKind[] = [
  'critical-weakness',
  'polarization',
  'negative-tail',
  'axis-weakness',
  'weakness',
  'group-gap',
  'low-reliability',
  'low-response',
  'strength',
];

/** إشارة ثانوية واحدة تكفي: المبرر سطر يُقرأ في اجتماع، لا فقرة تُدرَس */
const MAX_SECONDARY_CLAUSES = 1;

export function buildRecommendations(data: ReportData): Recommendation[] {
  const findings = collectFindings(data);
  if (findings.length === 0) return [];

  const recommendations = bucketize(findings).map((bucket) => {
    const severity = bucket.primary.severity;
    const band = priorityFor(severity);

    // أرقام الأسئلة في المبرر الأساسي تخص نوع المشكلة الأشدّ وحده، وإلا وصف
    // النص بنداً بأنه «دون العتبة» وهو ليس كذلك
    const primaryQuestions = Array.from(
      new Set(
        bucket.primaryGroup
          .map((finding) => finding.questionNumber)
          .filter((value): value is number => value !== undefined)
      )
    ).sort((a, b) => a - b);
    const allQuestions = Array.from(
      new Set(
        bucket.findings
          .map((finding) => finding.questionNumber)
          .filter((value): value is number => value !== undefined)
      )
    ).sort((a, b) => a - b);

    const parts = buildRationale(bucket, primaryQuestions);

    // نأخذ إشارة واحدة عن كل نوع ثانوي: تكرار النوع نفسه لا يضيف معلومة
    const WEIGHT_KINDS: FindingKind[] = ['critical-weakness', 'weakness', 'axis-weakness'];
    const distinctSecondary: Finding[] = [];
    bucket.secondary.forEach((finding) => {
      // إشارة عن سؤال ذكره المبرر الأساسي بالمقياس نفسه لا تضيف شيئاً
      // الشرط الدقيق: الرقم نفسه مذكور فعلاً في المبرر الأساسي عن السؤال نفسه.
      // الاكتفاء بتطابق السؤال كان يسقط إشارات تضيف مقياساً آخر عنه.
      const repeatsPrimary =
        WEIGHT_KINDS.includes(finding.kind) &&
        finding.questionNumber !== undefined &&
        primaryQuestions.includes(finding.questionNumber) &&
        parts.text.includes(`${finding.evidence.relativeWeight}%`);
      if (repeatsPrimary) return;

      if (
        distinctSecondary.length < MAX_SECONDARY_CLAUSES &&
        !distinctSecondary.some((chosen) => chosen.kind === finding.kind)
      ) {
        distinctSecondary.push(finding);
      }
    });

    const rationale = [parts.text, ...distinctSecondary.map(secondaryClause)]
      .filter(Boolean)
      .join(' ');
    const action =
      actionFor(bucket.primary.kind, bucket.theme) +
      distinctSecondary
        .map((finding) => SECONDARY_ACTION_SUFFIX[finding.kind] ?? '')
        .join('');

    return {
      id: `${bucket.theme}-${bucket.primary.kind}`,
      findingIds: bucket.findings.map((finding) => finding.id),
      kind: bucket.primary.kind,
      theme: bucket.theme,
      priority: band.label,
      severity: round2(severity),
      action,
      rationale,
      indicator: INDICATOR,
      target: buildTarget(bucket.primary.evidence, bucket.primary.kind),
      questionNumbers: allQuestions,
      quotes: quotesForTheme(bucket.theme, data.comments),
    } satisfies Recommendation;
  });

  const ordered = recommendations.sort(
    (a, b) =>
      b.severity - a.severity ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      a.id.localeCompare(b.id)
  );

  // استبيان ممتاز في كل مجالاته كان ينتج تسع توصيات كلها «حافظ على هذا».
  // نقطة القوة تُذكر للتثبيت والنشر، وذكر اثنتين يكفي؛ ما بعدهما تعداد لا توصية.
  let strengths = 0;
  return ordered
    .filter((recommendation) => {
      if (recommendation.kind !== 'strength') return true;
      strengths += 1;
      return strengths <= MAX_STRENGTH_RECOMMENDATIONS;
    })
    .slice(0, MAX_RECOMMENDATIONS);
}

/** نص مختصر يصف نطاق التوصية، للعرض في عمود الجدول */
export function recommendationScope(recommendation: Recommendation): string {
  if (recommendation.questionNumbers.length > 0) {
    return `${themeOf(recommendation.theme).label} — ${listQuestions(recommendation.questionNumbers)}`;
  }
  return themeOf(recommendation.theme).label;
}
