'use client';

import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { gradeFor } from '@/lib/analysis/scale';
import { getPolarizedResults } from '@/lib/pdf/report-helpers';
import { recommendationScope } from '@/lib/analysis/recommendations';
import type { ReportData } from '@/types/analysis';

function safeBaseName(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'تحليل_الاستبيان';
}

function addSheet(workbook: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  // SheetJS يسمّي الخاصية RTL؛ اسم مثل rightToLeft يُتجاهل بصمت فتخرج الأوراق
  // بترتيب أعمدة من اليسار لليمين رغم أن كل المحتوى عربي.
  sheet['!views'] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

/** ملف جداول التحليل، لا ملف الردود الخام. */
export function exportAnalysisWorkbook(data: ReportData): void {
  const workbook = XLSX.utils.book_new();
  // نفس معيار التقرير المطبوع، حتى لا يختلف تعريف «الانقسام» بين المخرجين
  const polarizedNumbers = new Set(
    getPolarizedResults(data.results).map((item) => item.questionNumber)
  );

  addSheet(workbook, 'الملخص', [
    {
      'عنوان التقرير': data.title,
      'تاريخ الاستبيان': data.surveyDate,
      'تاريخ التقرير': data.reportDate,
      'عدد المشاركين': data.totalRespondents ?? 0,
      'عدد الأسئلة': data.results.length,
      'المتوسط العام (وزن نسبي)': data.overallAverage,
      'المؤشر المعياري العام': data.overallNormalized,
      'أسئلة انقسام الآراء': polarizedNumbers.size,
      'ألفا كرونباخ': data.overallCronbachAlpha ?? '',
      'عينة الثبات': data.cronbachRespondents ?? '',
    },
  ]);

  addSheet(
    workbook,
    'الأسئلة',
    data.results.map((item) => ({
      'رقم السؤال': item.questionNumber,
      السؤال: item.question,
      'العدد الصالح': item.count,
      'القيم المفقودة': item.missing,
      'نسبة الاستجابة': item.responseRate,
      المتوسط: item.mean,
      'الانحراف المعياري': item.stdDev,
      الوسيط: item.median,
      المنوال: item.mode,
      'سُلَّم السؤال': `${item.scaleMin}-${item.scaleMax}`,
      'الوزن النسبي': item.relativeWeight,
      'المؤشر المعياري': item.normalizedScore,
      'نسبة غير الموافقين': item.negativeShare,
      'نسبة المحايدين': item.neutralShare,
      'نسبة الموافقين': item.positiveShare,
      'انقسام في الآراء': polarizedNumbers.has(item.questionNumber) ? 'نعم' : 'لا',
      'درجة التقييم': gradeFor(item.relativeWeight).label,
      الترتيب: item.rank ?? '',
      'سؤال عكسي': item.isReversed ? 'نعم' : 'لا',
    }))
  );

  if (data.axes.length > 0) {
    addSheet(
      workbook,
      'المحاور',
      data.axes.map((axis) => ({
        المحور: axis.name,
        'أرقام الأسئلة': axis.questionNumbers?.join('، ') || `${axis.start}–${axis.end}`,
        'عدد الأسئلة': axis.count ?? 0,
        'الوزن النسبي': axis.average ?? 0,
        'المؤشر المعياري': axis.normalizedAverage ?? 0,
        'ألفا كرونباخ': axis.cronbachAlpha ?? '',
        'عينة الثبات': axis.reliabilityRespondents ?? '',
        الترتيب: axis.rank ?? '',
      }))
    );
  }

  addSheet(
    workbook,
    'التوزيع التكراري',
    data.results.flatMap((item) =>
      item.distribution.map((slice) => ({
        'رقم السؤال': item.questionNumber,
        السؤال: item.question,
        'مستوى الإجابة': slice.value,
        العدد: slice.count,
        النسبة: slice.percentage,
      }))
    )
  );

  if (data.sampleProfile?.length) {
    addSheet(
      workbook,
      'توصيف العينة',
      data.sampleProfile.flatMap((group) =>
        group.values.map((value) => ({
          المتغير: group.column,
          الفئة: value.label,
          العدد: value.count,
          'النسبة %': value.percentage,
          'إجمالي من أجاب': group.answered,
        }))
      )
    );
  }

  if (data.comparison) {
    addSheet(
      workbook,
      'مقارنة الفئات',
      data.comparison.rows.map((row) => ({
        الفئة: row.category,
        العدد: row.respondents,
        ...Object.fromEntries(
          data.comparison!.axisNames.map((name, index) => [name, row.axisAverages[index]])
        ),
        'المتوسط العام': row.overallAverage,
      }))
    );
  }

  if (data.recommendations?.length) {
    addSheet(
      workbook,
      'جوانب التحسين',
      data.recommendations.map((recommendation, index) => ({
        '#': index + 1,
        الأولوية: recommendation.priority,
        المجال: recommendationScope(recommendation),
        المبرر: recommendation.rationale,
        'مؤشر القياس': recommendation.indicator,
        الهدف: recommendation.target,
        'أرقام الأسئلة': recommendation.questionNumbers.join('، '),
        'شواهد من التعليقات': recommendation.quotes.join(' | '),
        'درجة الأولوية': recommendation.severity,
      }))
    );
  }

  if (data.comments?.length) {
    addSheet(
      workbook,
      'التعليقات',
      data.comments.flatMap((group) =>
        group.answers.map((answer) => ({
          السؤال: group.question,
          التعليق: answer.text,
          'عدد التكرار': answer.occurrences,
        }))
      )
    );
  }

  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${safeBaseName(data.title)}_${data.reportDate}.xlsx`
  );
}

/** يحفظ فقط مدخلات إعادة الإنتاج، لا النتائج المحسوبة ولا الصور الثقيلة. */
export function exportAnalysisSettings(data: ReportData): void {
  const snapshot = {
    version: 1,
    title: data.title,
    surveyDate: data.surveyDate,
    reportDate: data.reportDate,
    manualComment: data.manualComment,
    axes: data.axes.map(({ name, start, end, questionNumbers }) => ({
      name,
      start,
      end,
      ...(questionNumbers?.length ? { questionNumbers } : {}),
    })),
    filters: data.filters ?? [],
    signatures: data.signatures ?? [],
    analysisOptions: data.analysisOptions ?? { reversedQuestions: [] },
  };

  saveAs(
    new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${safeBaseName(data.title)}_${data.reportDate}_settings.json`
  );
}
