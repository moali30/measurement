import type { QuestionResult } from '@/types/analysis';

/**
 * تقسيم الأسئلة على رسمَي «الأعلى» و«الأدنى».
 *
 * الرسمان كانا ثابتين: أول عشرة وآخر خمسة. مع أقل من خمسة عشر سؤالاً تتقاطع
 * المجموعتان فيظهر السؤال نفسه في الرسمين، فيقرأ المستخدم عموداً واحداً مرتين
 * ويظن أن أحد الرسمين خطأ. والمجموعتان هنا متباينتان دائماً بحكم البناء:
 * إما رسم واحد يعرض كل الأسئلة، أو رسمان لا يشترك بينهما سؤال.
 */

/** أقل عدد أسئلة يسمح برسمين متباينين (10 + 3 على الأقل) */
export const SPLIT_CHART_MINIMUM = 13;

const TOP_COUNT = 10;
const BOTTOM_COUNT = 5;

export interface RankedChartPoint {
  name: string;
  /** المؤشر المعياري — أرضيته صفر فيقرأ ارتفاع العمود كنسبة حقيقية */
  score: number;
  questionNumber: number;
}

export interface RankedChart {
  title: string;
  points: RankedChartPoint[];
}

export interface RankedCharts {
  top: RankedChart;
  /** غائب حين تُعرض كل الأسئلة في رسم واحد */
  bottom: RankedChart | null;
}

function toPoint(item: QuestionResult): RankedChartPoint {
  return {
    name: `س ${item.questionNumber}`,
    score: item.normalizedScore,
    questionNumber: item.questionNumber,
  };
}

/** صيغة العدد العربية الصحيحة: سؤال / سؤالان / أسئلة */
function questionCountLabel(count: number): string {
  if (count === 1) return 'سؤال واحد';
  if (count === 2) return 'سؤالان';
  if (count <= 10) return `${count} أسئلة`;
  return `${count} سؤالاً`;
}

/**
 * `resultsForAnalysis` مرتبة تنازلياً بالوزن النسبي، والتحويل إلى المؤشر
 * المعياري خطي، فالترتيب واحد بالمقياسين.
 */
export function getRankedCharts(resultsForAnalysis: QuestionResult[]): RankedCharts {
  const total = resultsForAnalysis.length;

  if (total < SPLIT_CHART_MINIMUM) {
    return {
      top: {
        title:
          total > 0
            ? `ترتيب الأسئلة كاملاً — ${questionCountLabel(total)}`
            : 'ترتيب الأسئلة',
        points: resultsForAnalysis.map(toPoint),
      },
      bottom: null,
    };
  }

  const bottomCount = Math.min(BOTTOM_COUNT, total - TOP_COUNT);

  return {
    top: {
      title: `أعلى ${questionCountLabel(TOP_COUNT)}`,
      points: resultsForAnalysis.slice(0, TOP_COUNT).map(toPoint),
    },
    bottom: {
      title: `أدنى ${questionCountLabel(bottomCount)}`,
      // معكوسة حتى يُقرأ الرسم من الأسوأ إلى الأقل سوءاً
      points: resultsForAnalysis.slice(total - bottomCount).reverse().map(toPoint),
    },
  };
}
