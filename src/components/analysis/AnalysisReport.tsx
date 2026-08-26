'use client';

import React from 'react';
import { QuestionResult, ReportData } from '@/types/analysis';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getPolarizedResults, getWeightDistributionPieData } from '@/lib/pdf/report-helpers';
import { POLARIZATION, ShareTone, gradeFor, shareStyle } from '@/lib/analysis/scale';
import { PRIORITY_STYLES, recommendationScope } from '@/lib/analysis/recommendations';

interface AnalysisReportProps {
  data: ReportData;
}

/** خلية نسبة داخل جدول انقسام الآراء: اللون بالشدة، والإطار للنسبة الأكبر */
function ShareCell({
  tone,
  value,
  dominant,
}: {
  tone: ShareTone;
  value: number;
  dominant: boolean;
}) {
  const style = shareStyle(tone);
  return (
    <td
      className={`p-3 border border-gray-200 dark:border-gray-700 text-center ${
        dominant ? 'font-extrabold' : 'font-normal'
      }`}
      style={{ color: style.color, background: style.background }}
    >
      {value}%
    </td>
  );
}

function dominantTone(item: QuestionResult): ShareTone {
  const max = Math.max(item.negativeShare, item.neutralShare, item.positiveShare);
  if (item.positiveShare === max) return 'positive';
  if (item.negativeShare === max) return 'negative';
  return 'neutral';
}

export default function AnalysisReport({ data }: AnalysisReportProps) {
  if (!data.results || data.results.length === 0) return null;

  // الرسوم تعرض المؤشر المعياري: أرضيته صفر حقيقي، فارتفاع العمود يعبّر عن
  // المسافة من أسوأ تقييم ممكن لا عن نسبة من الحد الأعلى وحده.
  const polarized = getPolarizedResults(data.results);
  const recommendations = data.recommendations ?? [];

  // نفس مصدر التصنيف المستخدم في التقرير المطبوع، حتى لا تنحرف العتبات بين
  // ما يراه المستخدم على الشاشة وما يخرج في الـ PDF
  const pieData = getWeightDistributionPieData(data.results);

  const axesChartData = data.axes.map(axis => ({
    name: axis.name,
    average: axis.normalizedAverage ?? 0
  }));

  return (
    <div className="space-y-8 mt-8" dir="rtl">
      {/* Overview Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
        <h3 className="text-lg font-bold mb-4 text-indigo-800 dark:text-indigo-400">النتائج التفصيلية</h3>
        <table className="w-full text-sm text-right border-collapse">
          <thead>
            <tr className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-200">
              <th className="p-3 border border-gray-200 dark:border-gray-700">م</th>
              <th className="p-3 border border-gray-200 dark:border-gray-700 w-1/2">السؤال</th>
              <th className="p-3 border border-gray-200 dark:border-gray-700">العدد</th>
              <th className="p-3 border border-gray-200 dark:border-gray-700">المتوسط</th>
              <th className="p-3 border border-gray-200 dark:border-gray-700">المؤشر المعياري</th>
              <th className="p-3 border border-gray-200 dark:border-gray-700">الوزن النسبي (%)</th>
              <th className="p-3 border border-gray-200 dark:border-gray-700">الدرجة</th>
              <th className="p-3 border border-gray-200 dark:border-gray-700">الترتيب</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((item) => {
              const grade = gradeFor(item.relativeWeight);
              return (
                <tr key={item.questionNumber} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{item.questionNumber}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{item.question}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{item.count}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{item.mean}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{item.normalizedScore}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{item.relativeWeight}%</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700 font-bold text-center whitespace-nowrap" style={{ color: grade.color }}>
                    {grade.label}
                  </td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{item.rank}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 font-bold text-gray-800 dark:text-gray-200">
          المتوسط العام: {data.overallAverage}%
          <span className="mr-6">المؤشر المعياري العام: {data.overallNormalized}</span>
          {data.overallCronbachAlpha !== undefined && (
            <span className="mr-6">ألفا كرونباخ: {data.overallCronbachAlpha}</span>
          )}
        </div>
      </div>

      {/* انقسام الآراء */}
      {polarized.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
          <h3 className="text-lg font-bold mb-1 text-indigo-800 dark:text-indigo-400">أسئلة انقسام الآراء</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            أسئلة بلغ فيها الرافضون والموافقون معاً {POLARIZATION.endShare}% فأكثر. المتوسط وحده
            لا يميّزها عن سؤال أجاب عنه الجميع بالحياد، رغم اختلاف الواقع تماماً.
          </p>
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-200">
                <th className="p-3 border border-gray-200 dark:border-gray-700">م</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700 w-2/5">السؤال</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">غير موافق</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">محايد</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">موافق</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">الوزن النسبي</th>
              </tr>
            </thead>
            <tbody>
              {polarized.map((item) => {
                const dominant = dominantTone(item);
                return (
                  <tr key={item.questionNumber}>
                    <td className="p-3 border border-gray-200 dark:border-gray-700">{item.questionNumber}</td>
                    <td className="p-3 border border-gray-200 dark:border-gray-700">{item.question}</td>
                    <ShareCell tone="negative" value={item.negativeShare} dominant={dominant === 'negative'} />
                    <ShareCell tone="neutral" value={item.neutralShare} dominant={dominant === 'neutral'} />
                    <ShareCell tone="positive" value={item.positiveShare} dominant={dominant === 'positive'} />
                    <td className="p-3 border border-gray-200 dark:border-gray-700 text-center font-bold">{item.relativeWeight}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* توصيف العيّنة */}
      {data.sampleProfile && data.sampleProfile.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold mb-4 text-indigo-800 dark:text-indigo-400">توصيف العيّنة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.sampleProfile.map((group) => (
              <div key={group.column} className="border border-gray-100 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">
                  {group.column.replace(/^\d+\.\s*/, '')}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{group.answered} مشاركاً</p>
                <ul className="space-y-1 text-sm">
                  {group.values.map((value) => (
                    <li key={value.label} className="flex justify-between gap-4">
                      <span className="text-gray-700 dark:text-gray-300">{value.label}</span>
                      <span className="font-bold text-indigo-800 dark:text-indigo-400 whitespace-nowrap">
                        {value.count} ({value.percentage}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Axes Table */}
      {data.axes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
          <h3 className="text-lg font-bold mb-4 text-indigo-800 dark:text-indigo-400">تحليل المحاور</h3>
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-200">
                <th className="p-3 border border-gray-200 dark:border-gray-700">المحور</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">نطاق الأسئلة</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">عدد الأسئلة</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">الوزن النسبي (%)</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">المؤشر المعياري</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">ألفا كرونباخ</th>
                <th className="p-3 border border-gray-200 dark:border-gray-700">الترتيب</th>
              </tr>
            </thead>
            <tbody>
              {data.axes.map((axis, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{axis.name}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">من {axis.start} إلى {axis.end}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{axis.count}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{axis.average}%</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{axis.normalizedAverage ?? '—'}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{axis.cronbachAlpha ?? '—'}</td>
                  <td className="p-3 border border-gray-200 dark:border-gray-700">{axis.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h4 className="font-bold mb-4 text-center">توزيع الأوزان النسبية للأسئلة</h4>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {data.axes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h4 className="font-bold mb-1 text-center">مقارنة بين المحاور</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 text-center">بالمؤشر المعياري (0–100)</p>
            <div className="h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={axesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip />
                  <Bar dataKey="average" fill="#10b981" name="المؤشر المعياري" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* التوصيات */}
      {recommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold mb-1 text-indigo-800 dark:text-indigo-400">الجوانب التي تحتاج إلى تحسين</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            الجوانب مرتبة بالأولوية، ولكل جانب هدف رقمي بالوزن النسبي يُقاس عليه التحسن.
          </p>
          <div className="space-y-4">
            {recommendations.map((recommendation) => {
              const badge = PRIORITY_STYLES[recommendation.priority];
              return (
                <article
                  key={recommendation.id}
                  className="border border-gray-200 dark:border-gray-700 border-r-4 border-r-indigo-800 rounded-lg p-4"
                >
                  <header className="flex items-center gap-3 mb-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{ color: badge.color, background: badge.background }}
                    >
                      {recommendation.priority}
                    </span>
                    <span className="font-bold text-indigo-800 dark:text-indigo-400 text-sm">
                      {recommendationScope(recommendation)}
                    </span>
                  </header>

                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
                    {recommendation.rationale}
                  </p>

                  <p className="pt-3 border-t border-dashed border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200">
                    <span className="text-gray-500 dark:text-gray-400 font-normal">
                      {recommendation.indicator}:{' '}
                    </span>
                    {recommendation.target}
                  </p>

                  {recommendation.quotes.length > 0 && (
                    <ul className="mt-3 list-disc list-inside text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      {recommendation.quotes.map((quote) => (
                        <li key={quote}>{quote}</li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto Comments */}
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 auto-comment-container"
        dangerouslySetInnerHTML={{ __html: data.autoComment }}
      />

      {/* Manual Comments */}
      {data.manualComment && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-r-4 border-yellow-500 p-6 rounded-xl shadow-sm text-gray-800 dark:text-gray-200">
          <h4 className="font-bold mb-2">ملاحظات إضافية</h4>
          <p className="whitespace-pre-line">{data.manualComment}</p>
        </div>
      )}

      {/* Aggregated User Comments */}
      {data.comments && data.comments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold mb-4 text-indigo-800 dark:text-indigo-400">تعليقات وملاحظات المشاركين</h3>
          <div className="space-y-6">
            {data.comments.map((commentGroup, idx) => (
              <div key={idx} className="border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">{commentGroup.question}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {commentGroup.answers.length} تعليقاً من إجمالي {commentGroup.totalResponses} استجابة
                  {commentGroup.skippedCount > 0 && ` — استُبعد ${commentGroup.skippedCount} بلا محتوى`}
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
                  {commentGroup.answers.map((answer, aIdx) => (
                    <li key={aIdx} className="bg-gray-50 dark:bg-gray-900 p-2 rounded-md">
                      {answer.text}
                      {answer.occurrences > 1 && (
                        <span className="mr-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          (تكرر {answer.occurrences} مرات)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
