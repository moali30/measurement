import { processData } from '@/lib/analysis-utils';
import type { Axis, ReportData } from '@/types/analysis';

/** بدائل ليكرت بترتيبها المخزَّن: الأول أفضل تقدير */
export const LIKERT_LABELS = [
  'موافق جداً',
  'موافق',
  'محايد',
  'غير موافق',
  'غير موافق جداً',
] as const;

export const VALUE_MAP: Record<string, number> = Object.fromEntries(
  LIKERT_LABELS.map((label, index) => [label, 5 - index])
);

/** `counts[i]` عدد من اختار `LIKERT_LABELS[i]` */
export type LevelCounts = readonly [number, number, number, number, number];

/** يحوّل أعداد البدائل إلى إجابة كل مشارك على حدة */
export function choiceAt(counts: LevelCounts, person: number): string {
  let remaining = person;
  for (let level = 0; level < counts.length; level += 1) {
    if (remaining < counts[level]) return LIKERT_LABELS[level];
    remaining -= counts[level];
  }
  return LIKERT_LABELS[LIKERT_LABELS.length - 1];
}

export function respondentsIn(counts: LevelCounts): number {
  return counts.reduce((sum, count) => sum + count, 0);
}

/** صفوف سؤال واحد، بالنص كما تُخزَّن في قاعدة البيانات */
export function rowsFor(question: string, counts: LevelCounts): Record<string, unknown>[] {
  return Array.from({ length: respondentsIn(counts) }, (_, person) => ({
    [question]: choiceAt(counts, person),
  }));
}

export interface AnalyseOptions {
  reversedQuestions?: string[];
  comparisonColumn?: string;
  axes?: Axis[];
}

/** يحلّل سؤال ليكرت واحداً بالمسار الكامل الذي يسلكه التطبيق */
export function analyseSingle(
  question: string,
  counts: LevelCounts,
  options: AnalyseOptions = {}
) {
  return processData(rowsFor(question, counts), options.axes ?? [], { [question]: 'likert' }, [], {
    questionOptionCounts: { [question]: 5 },
    questionValueMaps: { [question]: VALUE_MAP },
    reversedQuestions: options.reversedQuestions,
    comparisonColumn: options.comparisonColumn,
  });
}

export interface SurveyFixture {
  /** أنماط الإجابة لكل سؤال، بالترتيب */
  patterns: LevelCounts[];
  /**
   * نصوص الأسئلة. تركها فارغة يعطي نصاً صورياً يكفي لاختبار الحساب، لكن
   * اختبار تصنيف المجال والتوصيات يحتاج نصوصاً حقيقية: بند اسمه «سؤال رقم 4»
   * لا يمكن لأي مصنِّف أن يعرف أنه عن المعامل.
   */
  questionTexts?: string[];
  axes?: Axis[];
  /** يضيف عمودي «النوع» و«هل توصي» وعمود ملاحظات نصياً */
  withDemographics?: boolean;
}

export interface BuiltSurvey {
  rows: Record<string, unknown>[];
  questionTypes: Record<string, string>;
  questionOptionCounts: Record<string, number>;
  questionValueMaps: Record<string, Record<string, number>>;
  commentQuestions: string[];
  questionKeys: string[];
  genderKey: string;
  axes: Axis[];
}

export function buildSurvey(fixture: SurveyFixture): BuiltSurvey {
  const { patterns, withDemographics = true } = fixture;
  const count = patterns.length;
  const questionKeys = patterns.map(
    (_, index) => `${index + 1}. ${fixture.questionTexts?.[index] ?? `سؤال رقم ${index + 1}`}`
  );
  const genderKey = `${count + 1}. النوع`;
  const recommendKey = `${count + 2}. هل توصي بالبرنامج؟`;
  const notesKey = `${count + 3}. ملاحظاتك`;

  const respondents = respondentsIn(patterns[0]);
  const rows = Array.from({ length: respondents }, (_, person) => {
    const row: Record<string, unknown> = {};
    patterns.forEach((counts, index) => {
      row[questionKeys[index]] = choiceAt(counts, person);
    });
    if (withDemographics) {
      row[genderKey] = person % 2 === 0 ? 'ذكر' : 'أنثى';
      row[recommendKey] = person % 4 === 0 ? 'لا' : 'نعم';
      row[notesKey] = person % 5 === 0 ? 'نحتاج تطوير المعامل ومواعيد أوضح للامتحانات.' : '';
    }
    return row;
  });

  const questionTypes: Record<string, string> = {};
  const questionOptionCounts: Record<string, number> = {};
  const questionValueMaps: Record<string, Record<string, number>> = {};
  questionKeys.forEach((key) => {
    questionTypes[key] = 'likert';
    questionOptionCounts[key] = 5;
    questionValueMaps[key] = VALUE_MAP;
  });
  if (withDemographics) {
    questionTypes[genderKey] = 'radio';
    questionTypes[recommendKey] = 'yes_no';
    questionTypes[notesKey] = 'textarea';
  }

  return {
    rows,
    questionTypes,
    questionOptionCounts,
    questionValueMaps,
    commentQuestions: withDemographics ? [notesKey] : [],
    questionKeys,
    genderKey,
    axes: fixture.axes ?? [],
  };
}

export function analyseSurvey(survey: BuiltSurvey, comparisonColumn?: string) {
  return processData(
    survey.rows,
    survey.axes,
    survey.questionTypes,
    survey.commentQuestions,
    {
      questionOptionCounts: survey.questionOptionCounts,
      questionValueMaps: survey.questionValueMaps,
      comparisonColumn,
    }
  );
}

/** يغلّف نتيجة المحرك في تقرير كامل صالح للتدقيق والطباعة */
export function toReport(
  processed: ReturnType<typeof processData>,
  title = 'تقرير اختبار'
): ReportData {
  return {
    title,
    surveyDate: '2026-06-01',
    reportDate: '2026-08-24',
    manualComment: '',
    logos: { quality: '', university: '', college: '' },
    signatures: [],
    filters: [],
    ...processed,
  } as unknown as ReportData;
}
