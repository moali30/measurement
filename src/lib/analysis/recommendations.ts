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
function buildTarget(evidence: FindingEvidence): string {
  const weight = round2(evidence.relativeWeight ?? evidence.axisAverage ?? 0);
  return `رفعه من ${weight}% إلى ${nextBand(weight)}% فأعلى`;
}

/**
 * يبني المبرر من الأدلة الرقمية وحدها.
 *
 * تقييم لا شرح: كل جملة تسمّي الموضع وتذكر أرقامه وتقف. الصيغ السابقة كانت
 * تضيف دلالة الرقم («لا يكشف هذا الانقسام»، «يبدو مقبولاً»، «أضعف دلالة مما
 * يبدو») — وهو تفسير يخص قارئ التقرير لا مُصدِره، ويطيل السطر بلا رقم جديد.
 *
 * وكل رقم هنا مأخوذ حرفياً من `evidence`، فلا يمكن أن يظهر رقم بلا أصل.
 */
function buildRationale(bucket: Bucket, questionNumbers: number[]): RationaleParts {
  const worst = bucket.primary;
  const evidence = worst.evidence;
  const scope = listQuestions(questionNumbers);

  switch (worst.kind) {
    case 'critical-weakness':
    case 'weakness': {
      const weight = evidence.relativeWeight ?? 0;
      const lead =
        questionNumbers.length > 1
          ? `${scope}: أدنى وزن نسبي ${weight}%`
          : `${scope}: الوزن النسبي ${weight}%`;
      const tail =
        evidence.negativeShare && evidence.negativeShare > 0
          ? `، وغير الموافقين ${evidence.negativeShare}%`
          : '';
      return { text: `${lead}${tail}.` };
    }

    case 'polarization':
      return {
        text:
          `${scope}: ${evidence.negativeShare}% غير موافقين مقابل ` +
          `${evidence.positiveShare}% موافقين، والوزن النسبي ${evidence.relativeWeight}%.`,
      };

    case 'negative-tail':
      return {
        text: `${scope}: غير الموافقين ${evidence.negativeShare}%، والوزن النسبي ${evidence.relativeWeight}%.`,
      };

    case 'axis-weakness': {
      const names = bucket.primaryGroup.map((finding) => `«${finding.axisName}»`).join('، ');
      const label = bucket.primaryGroup.length > 1 ? 'محاور' : 'محور';
      return {
        text: `${label} ${names}: المتوسط ${evidence.axisAverage}% على ${itemsLabel(evidence.items ?? 0)}.`,
      };
    }

    case 'group-gap': {
      const [lower, higher] = evidence.categories ?? ['', ''];
      return {
        text:
          `محور «${worst.axisName}»: «${higher}» ${evidence.comparisonHigh}% مقابل ` +
          `«${lower}» ${evidence.axisAverage}%، بفارق ${evidence.gap} نقطة.`,
      };
    }

    case 'low-reliability':
      return {
        text: `محور «${worst.axisName}»: ألفا ${evidence.alpha}، والمتوسط ${evidence.axisAverage}%.`,
      };

    case 'low-response':
      return { text: `${scope}: معدل الاستجابة ${evidence.responseRate}%.` };

    default:
      return { text: '' };
  }
}

/** إشارة ثانوية في المجال نفسه: موضع وأرقامه، بأدلتها هي */
function secondaryClause(finding: Finding): string {
  const evidence = finding.evidence;
  switch (finding.kind) {
    case 'polarization':
      return `السؤال ${finding.questionNumber}: ${evidence.negativeShare}% غير موافقين مقابل ${evidence.positiveShare}% موافقين.`;
    case 'negative-tail':
      return `السؤال ${finding.questionNumber}: غير الموافقين ${evidence.negativeShare}%، والوزن النسبي ${evidence.relativeWeight}%.`;
    case 'axis-weakness':
      return `محور «${finding.axisName}»: المتوسط ${evidence.axisAverage}% على ${itemsLabel(evidence.items ?? 0)}.`;
    case 'group-gap':
      return `محور «${finding.axisName}»: فارق ${evidence.gap} نقطة بين «${(evidence.categories ?? [])[1]}» و«${(evidence.categories ?? [])[0]}».`;
    case 'low-reliability':
      return `محور «${finding.axisName}»: ألفا ${evidence.alpha}.`;
    case 'low-response':
      return `السؤال ${finding.questionNumber}: معدل الاستجابة ${evidence.responseRate}%.`;
    case 'critical-weakness':
    case 'weakness':
      return `السؤال ${finding.questionNumber}: الوزن النسبي ${evidence.relativeWeight}%.`;
    default:
      return '';
  }
}

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
    return {
      id: `${bucket.theme}-${bucket.primary.kind}`,
      findingIds: bucket.findings.map((finding) => finding.id),
      kind: bucket.primary.kind,
      theme: bucket.theme,
      priority: band.label,
      severity: round2(severity),
      rationale,
      indicator: INDICATOR,
      target: buildTarget(bucket.primary.evidence),
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
  return ordered
    .slice(0, MAX_RECOMMENDATIONS);
}

/** نص مختصر يصف نطاق التوصية، للعرض في عمود الجدول */
export function recommendationScope(recommendation: Recommendation): string {
  if (recommendation.questionNumbers.length > 0) {
    return `${themeOf(recommendation.theme).label} — ${listQuestions(recommendation.questionNumbers)}`;
  }
  return themeOf(recommendation.theme).label;
}
