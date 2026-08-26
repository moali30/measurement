/**
 * طبقة الأدلة: تحويل أرقام التقرير إلى «نتائج» مصنَّفة قابلة للتوصية.
 *
 * الفصل عن كتابة التوصيات مقصود. الرقم وحده لا يقول ما نوع المشكلة: بند
 * متوسطه 60% قد يكون بنداً أجاب عنه الجميع بالحياد، وقد يكون بنداً انقسم عليه
 * نصفان متعارضان — وهما حالتان تستدعيان تدخلين مختلفين تماماً. هنا نحدد
 * **نوع** المشكلة وشدتها ودليلها الرقمي، وفي `recommendations.ts` تُصاغ.
 *
 * كل رقم تذكره أي توصية لاحقاً يجب أن يكون موجوداً في `evidence` هنا؛ هذا هو
 * ما يمنع التقرير من ذكر رقم لا أصل له.
 */

import type { Axis, CategoryComparison, QuestionResult, ReportData } from '@/types/analysis';
import { DISTRIBUTION_BANDS, NARRATIVE_THRESHOLDS, POLARIZATION, QUALITY_THRESHOLDS } from './scale';
import { ThemeKey, classifyTheme } from './themes';

export type FindingKind =
  | 'critical-weakness'
  | 'weakness'
  | 'polarization'
  | 'negative-tail'
  | 'axis-weakness'
  | 'group-gap'
  | 'low-response'
  | 'low-reliability'
  | 'strength';

/** الأرقام التي بُني عليها الاستنتاج — مصدر كل رقم يظهر في التوصية */
export interface FindingEvidence {
  relativeWeight?: number;
  normalizedScore?: number;
  negativeShare?: number;
  positiveShare?: number;
  responseRate?: number;
  axisAverage?: number;
  alpha?: number;
  gap?: number;
  respondents?: number;
  /** عدد بنود المحور — منفصل عن عدد المستجيبين حتى لا يختلطا في نص التوصية */
  items?: number;
  /** أسماء الفئات في نتائج المقارنة */
  categories?: string[];
}

export interface Finding {
  id: string;
  kind: FindingKind;
  /** 0-100؛ تُشتق منها الأولوية ويُرتَّب بها كل شيء */
  severity: number;
  theme: ThemeKey;
  questionNumber?: number;
  question?: string;
  axisName?: string;
  evidence: FindingEvidence;
}

/** عتبات إضافية خاصة بطبقة الأدلة */
export const FINDING_THRESHOLDS = {
  /** نسبة رافضين تستوجب التدخل حتى لو كان المتوسط مقبولاً */
  negativeTail: 30,
  /** فرق بين أعلى فئة وأدناها يُعد فجوة تستحق الذكر */
  groupGap: 8,
  /** حد اعتبار المحور ضعيفاً */
  axisWeakness: NARRATIVE_THRESHOLDS.weakness,
} as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function themeFor(item: QuestionResult, axes: Axis[]): ThemeKey {
  const axis = axes.find((candidate) =>
    candidate.questionNumbers?.length
      ? candidate.questionNumbers.includes(item.questionNumber)
      : item.questionNumber >= candidate.start && item.questionNumber <= candidate.end
  );
  return classifyTheme(item.question, axis?.name);
}

function questionFindings(item: QuestionResult, theme: ThemeKey): Finding[] {
  const found: Finding[] = [];
  const base = {
    theme,
    questionNumber: item.questionNumber,
    question: item.question,
  };

  if (item.relativeWeight < DISTRIBUTION_BANDS.medium) {
    found.push({
      ...base,
      id: `q${item.questionNumber}-critical`,
      kind: 'critical-weakness',
      // ٦٠٪ هو الحياد التام؛ النزول تحته يعني رفضاً صريحاً لا مجرد فتور
      severity: clamp(70 + (DISTRIBUTION_BANDS.medium - item.relativeWeight) * 1.5),
      evidence: {
        relativeWeight: item.relativeWeight,
        normalizedScore: item.normalizedScore,
        negativeShare: item.negativeShare,
        respondents: item.count,
      },
    });
  } else if (item.relativeWeight < NARRATIVE_THRESHOLDS.weakness) {
    found.push({
      ...base,
      id: `q${item.questionNumber}-weak`,
      kind: 'weakness',
      severity: clamp(40 + (NARRATIVE_THRESHOLDS.weakness - item.relativeWeight) * 2),
      evidence: {
        relativeWeight: item.relativeWeight,
        normalizedScore: item.normalizedScore,
        negativeShare: item.negativeShare,
        respondents: item.count,
      },
    });
  } else if (item.relativeWeight >= NARRATIVE_THRESHOLDS.strength) {
    found.push({
      ...base,
      id: `q${item.questionNumber}-strength`,
      kind: 'strength',
      // القوة تُذكر للتثبيت لا للإصلاح، فتبقى أسفل كل مشكلة حقيقية
      severity: clamp((item.relativeWeight - NARRATIVE_THRESHOLDS.strength) / 2),
      evidence: {
        relativeWeight: item.relativeWeight,
        positiveShare: item.positiveShare,
        respondents: item.count,
      },
    });
  }

  // قيمة رصد الانقسام أنه يكشف ما يخفيه المتوسط. فإن كان المتوسط نفسه دون
  // عتبة القبول فالمشكلة ظاهرة أصلاً، ورصدها مرة ثانية تكرار لا إضافة.
  const averageLooksAcceptable = item.relativeWeight >= DISTRIBUTION_BANDS.medium;

  if (
    averageLooksAcceptable &&
    item.negativeShare >= POLARIZATION.endShare &&
    item.positiveShare >= POLARIZATION.endShare
  ) {
    found.push({
      ...base,
      id: `q${item.questionNumber}-polarized`,
      kind: 'polarization',
      severity: clamp(45 + Math.min(item.negativeShare, item.positiveShare)),
      evidence: {
        negativeShare: item.negativeShare,
        positiveShare: item.positiveShare,
        relativeWeight: item.relativeWeight,
        respondents: item.count,
      },
    });
  } else if (averageLooksAcceptable && item.negativeShare >= FINDING_THRESHOLDS.negativeTail) {
    // كتلة رافضة كبيرة بلا كتلة مؤيدة تقابلها — يخفيها المتوسط أيضاً
    found.push({
      ...base,
      id: `q${item.questionNumber}-tail`,
      kind: 'negative-tail',
      severity: clamp(30 + item.negativeShare),
      evidence: {
        negativeShare: item.negativeShare,
        relativeWeight: item.relativeWeight,
        respondents: item.count,
      },
    });
  }

  if (item.responseRate < QUALITY_THRESHOLDS.minimumResponseRate) {
    found.push({
      ...base,
      id: `q${item.questionNumber}-response`,
      kind: 'low-response',
      severity: clamp(100 - item.responseRate),
      evidence: { responseRate: item.responseRate, respondents: item.count },
    });
  }

  return found;
}

function axisFindings(axes: Axis[], results: QuestionResult[]): Finding[] {
  const found: Finding[] = [];

  axes.forEach((axis) => {
    const members = results.filter((item) =>
      axis.questionNumbers?.length
        ? axis.questionNumbers.includes(item.questionNumber)
        : item.questionNumber >= axis.start && item.questionNumber <= axis.end
    );
    if (members.length === 0) return;

    const theme = classifyTheme(members[0].question, axis.name);
    const average = axis.average ?? 0;

    if (average < FINDING_THRESHOLDS.axisWeakness) {
      found.push({
        id: `axis-${axis.start}-weak`,
        kind: 'axis-weakness',
        theme,
        axisName: axis.name,
        severity: clamp(55 + (FINDING_THRESHOLDS.axisWeakness - average) * 2),
        evidence: {
          axisAverage: average,
          normalizedScore: axis.normalizedAverage,
          items: members.length,
        },
      });
    }

    if (axis.cronbachAlpha !== undefined && axis.cronbachAlpha < QUALITY_THRESHOLDS.minimumAlpha) {
      found.push({
        id: `axis-${axis.start}-reliability`,
        kind: 'low-reliability',
        theme,
        axisName: axis.name,
        severity: clamp(35 + (QUALITY_THRESHOLDS.minimumAlpha - axis.cronbachAlpha) * 40),
        evidence: { alpha: axis.cronbachAlpha, axisAverage: average, items: members.length },
      });
    }
  });

  return found;
}

function comparisonFindings(
  comparison: CategoryComparison | undefined,
  axes: Axis[],
  results: QuestionResult[]
): Finding[] {
  if (!comparison || comparison.rows.length < 2) return [];

  const found: Finding[] = [];

  comparison.axisNames.forEach((axisName, index) => {
    const values = comparison.rows
      .map((row) => ({ category: row.category, value: row.axisAverages[index] }))
      .filter((entry) => entry.value > 0);
    if (values.length < 2) return;

    const highest = values.reduce((a, b) => (a.value >= b.value ? a : b));
    const lowest = values.reduce((a, b) => (a.value <= b.value ? a : b));
    const gap = Math.round((highest.value - lowest.value) * 100) / 100;
    if (gap < FINDING_THRESHOLDS.groupGap) return;

    const axis = axes.find((candidate) => candidate.name === axisName);
    const member = results.find((item) =>
      axis?.questionNumbers?.length ? axis.questionNumbers.includes(item.questionNumber) : false
    );

    found.push({
      id: `gap-${index}`,
      kind: 'group-gap',
      theme: classifyTheme(member?.question ?? axisName, axisName),
      axisName,
      severity: clamp(35 + gap * 1.5),
      evidence: {
        gap,
        axisAverage: lowest.value,
        categories: [lowest.category, highest.category],
      },
    });
  });

  return found;
}

/** يستخرج كل النتائج من تقرير مكتمل، مرتبة بالشدة تنازلياً */
export function collectFindings(data: ReportData): Finding[] {
  const themeByQuestion = new Map<number, ThemeKey>();
  data.results.forEach((item) => {
    themeByQuestion.set(item.questionNumber, themeFor(item, data.axes));
  });

  const findings = [
    ...data.results.flatMap((item) =>
      questionFindings(item, themeByQuestion.get(item.questionNumber) ?? 'general')
    ),
    ...axisFindings(data.axes, data.results),
    ...comparisonFindings(data.comparison, data.axes, data.results),
  ];

  // ترتيب حتمي: الشدة أولاً ثم المعرّف، حتى ينتج التقرير نفسه في كل تشغيل
  return findings.sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id));
}
