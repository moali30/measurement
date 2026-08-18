/* eslint-disable @next/next/no-img-element */
'use client';
import '@/styles/print.css';

import React, { useEffect, useState } from 'react';
import { ReportData } from '@/types/analysis';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { PrintFooter } from './shared/PrintFooter';
import {
  ANALYSIS_SCALE,
  DISTRIBUTION_BANDS,
  NARRATIVE_THRESHOLDS,
  gradeFor,
} from '@/lib/analysis/scale';
import {
  cleanAutoCommentHtml,
  formatReportDate,
  getAxisExtremes,
  getAxesChartData,
  getBottom5ChartData,
  getRespondentCount,
  getTop10ChartData,
  getWeightDistributionPieData,
} from '@/lib/pdf/report-helpers';

interface AnalysisPrintDocumentProps {
  data: ReportData;
  preview?: boolean;
}

/** لون شريط الأداء يتبع نفس عتبات درجة التقييم */
function barColor(average: number): string {
  return gradeFor(average).color;
}

function reliabilityLabel(alpha: number): string {
  if (alpha >= 0.9) return 'ثبات ممتاز';
  if (alpha >= 0.8) return 'ثبات جيد جداً';
  if (alpha >= 0.7) return 'ثبات مقبول';
  if (alpha >= 0.6) return 'ثبات يحتاج مراجعة';
  return 'ثبات ضعيف';
}

function axisRangeLabel(axis: ReportData['axes'][number]): string {
  if (axis.questionNumbers?.length) return axis.questionNumbers.join('، ');
  return `من ${axis.start} إلى ${axis.end}`;
}

export default function AnalysisPrintDocument({ data, preview = false }: AnalysisPrintDocumentProps) {
  const [printReady, setPrintReady] = useState(false);

  useEffect(() => {
    setPrintReady(false);

    let timer = window.setTimeout(() => setPrintReady(true), 3000);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setPrintReady(true), 800);
      });
    }

    return () => {
      window.clearTimeout(timer);
    };
  }, [data]);

  if (!data.results?.length) return null;

  // العدد الإجمالي أدق من أكبر عدد استجابات لسؤال واحد، لأن الأسئلة تختلف في
  // القيم المفقودة. نعود للتقدير القديم فقط مع تقارير قديمة لا تحمل الحقل.
  const respondentCount = data.totalRespondents ?? getRespondentCount(data.results);
  const top10Data = getTop10ChartData(data.resultsForAnalysis);
  const bottom5Data = getBottom5ChartData(data.resultsForAnalysis);
  const distribution = getWeightDistributionPieData(data.results);
  const axesChartData = getAxesChartData(data.axes);
  const { best: bestAxis, worst: worstAxis } = getAxisExtremes(data.axes);

  const hasAxes = data.axes.length > 0;
  const hasComments = Boolean(data.comments && data.comments.length > 0);
  const hasBinary = Boolean(data.binaryResults && data.binaryResults.length > 0);
  const comparison = data.comparison;
  const overallGrade = gradeFor(data.overallAverage);

  // أعمدة التوزيع التكراري — من الأعلى للأدنى كما يُقرأ في التقارير الأكاديمية
  const scaleMax = data.scaleMax ?? ANALYSIS_SCALE.max;
  const usedScales = Array.from(new Set(data.results.map((item) => item.scaleMax))).sort((a, b) => a - b);
  const scaleDescription =
    usedScales.length === 1
      ? `سُلَّم من ${ANALYSIS_SCALE.min} إلى ${usedScales[0]}`
      : `سلالم متعددة حسب السؤال (${usedScales.join('، ')})`;
  const floorDescription = usedScales
    .map((maximum) => `${Math.round((ANALYSIS_SCALE.min / maximum) * 100)}% للسُلَّم ${maximum}`)
    .join('، ');
  const distributionLevels = Array.from(
    { length: scaleMax - ANALYSIS_SCALE.min + 1 },
    (_, i) => scaleMax - i
  );

  // الفهرس يتبع الأقسام الفعلية — قسم غائب لا يظهر في الفهرس
  const tocEntries: { title: string; note: string }[] = [
    { title: 'الملخص التنفيذي', note: 'أهم المؤشرات في لمحة واحدة' },
    { title: 'منهجية التحليل', note: 'المقياس والمعادلة وعتبات الحكم' },
    { title: 'نتائج تحليل الاستبيان', note: 'جدول تفصيلي بكل الأسئلة ودرجاتها' },
    ...(hasBinary
      ? [{ title: 'أسئلة الإجابة الثنائية', note: 'أسئلة نعم/لا خارج المتوسط العام' }]
      : []),
    { title: 'التوزيع التكراري للاستجابات', note: 'عدد ونسبة كل مستوى إجابة' },
    ...(hasAxes
      ? [
          { title: 'نتائج تحليل المحاور', note: 'متوسط كل محور وترتيبه' },
          { title: 'مقارنة بين المحاور', note: 'رسم بياني وأشرطة أداء' },
        ]
      : []),
    { title: 'الرسوم البيانية والمؤشرات', note: 'أعلى وأدنى الأسئلة وتوزيع الأوزان' },
    ...(comparison
      ? [{ title: 'مقارنة بين الفئات', note: `حسب ${comparison.column.replace(/^\d+\.\s*/, '')}` }]
      : []),
    { title: 'التحليل النهائي والاستنتاجات', note: 'نقاط القوة والتحسين والتوصيات' },
    ...(hasComments
      ? [{ title: 'تعليقات وملاحظات المشاركين', note: 'الإجابات النصية مجمَّعة' }]
      : []),
  ];

  return (
    <div
      className={`print-document${preview ? ' print-document--preview' : ''}`}
      data-print-ready={printReady ? 'true' : 'false'}
      dir="rtl"
    >
      {/* ===== الغلاف ===== */}
      <section className="print-cover print-section">
        <div className="print-cover__logos">
          {data.logos?.quality && <img src={data.logos.quality} alt="شعار الجودة" />}
          {data.logos?.university && <img src={data.logos.university} alt="شعار الجامعة" />}
          {data.logos?.college && <img src={data.logos.college} alt="شعار الكلية" />}
        </div>

        <div className="print-cover__title-block">
          <h1 className="print-cover__title">{data.title}</h1>

          <div>
            <div className="print-cover__count">
              عدد المشاركين: <span>{respondentCount}</span>
            </div>
          </div>

          {data.filters && data.filters.length > 0 && (
            <div className="print-cover__filters">
              <strong style={{ color: '#1a237e', display: 'block', marginBottom: '2mm' }}>
                الفئة المستهدفة للتحليل:
              </strong>
              <ul>
                {data.filters.map((filter) => (
                  <li key={filter.column} style={{ marginBottom: '1mm', fontSize: '10.5pt' }}>
                    <span style={{ fontWeight: 700 }}>{filter.column.replace(/^\d+\.\s*/, '')}:</span>{' '}
                    {filter.values.join(' ، ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="print-cover__meta">
          <div>
            <strong>تاريخ طرح الاستبيان</strong>
            {formatReportDate(data.surveyDate)}
          </div>
          <div>
            <strong>تاريخ إعداد التقرير</strong>
            {formatReportDate(data.reportDate)}
          </div>
        </div>
      </section>

      {/* ===== فهرس المحتويات ===== */}
      <section className="print-section print-section--flow">
        <h2 className="print-section-title">فهرس المحتويات</h2>
        <ol className="print-toc">
          {tocEntries.map((entry) => (
            <li key={entry.title}>
              <b>{entry.title}</b>
              <small>— {entry.note}</small>
            </li>
          ))}
        </ol>
      </section>

      {/* ===== الملخص التنفيذي ===== */}
      <section className="print-section print-section--page">
        <h2 className="print-section-title">الملخص التنفيذي</h2>

        <div className="print-kpi-grid">
          <div className="print-kpi-card">
            <div className="print-kpi-card__label">المتوسط العام للاستبيان</div>
            <div className="print-kpi-card__value" style={{ color: overallGrade.color }}>
              {data.overallAverage}%
            </div>
            <div className="print-kpi-card__note">درجة التقييم: {overallGrade.label}</div>
          </div>

          {data.overallCronbachAlpha !== undefined && (
            <div className="print-kpi-card">
              <div className="print-kpi-card__label">معامل الثبات (ألفا كرونباخ)</div>
              <div className="print-kpi-card__value">{data.overallCronbachAlpha}</div>
              <div className="print-kpi-card__note">
                {reliabilityLabel(data.overallCronbachAlpha)} · {data.cronbachRespondents} استجابة مكتملة
              </div>
            </div>
          )}

          <div className="print-kpi-card">
            <div className="print-kpi-card__label">عدد المشاركين</div>
            <div className="print-kpi-card__value">{respondentCount}</div>
            <div className="print-kpi-card__note">عدد الأسئلة المحللة: {data.results.length}</div>
          </div>

          {bestAxis && (
            <div className="print-kpi-card">
              <div className="print-kpi-card__label">أعلى محور أداءً</div>
              <div className="print-kpi-card__value print-kpi-card__value--text">{bestAxis.name}</div>
              <div className="print-kpi-card__note">بمتوسط {bestAxis.average}%</div>
            </div>
          )}

          {worstAxis && (
            <div className="print-kpi-card">
              <div className="print-kpi-card__label">المحور الأقل تقييماً</div>
              <div className="print-kpi-card__value print-kpi-card__value--text">{worstAxis.name}</div>
              <div className="print-kpi-card__note">بمتوسط {worstAxis.average}%</div>
            </div>
          )}
        </div>

        <div className="print-narrative-box">
          <h4>توزيع الأسئلة على مستويات الأداء</h4>
          <div className="print-legend" style={{ justifyContent: 'flex-start' }}>
            {distribution.map((bucket) => (
              <div key={bucket.name} className="print-legend__item">
                <span className="print-legend__swatch" style={{ background: bucket.fill }} />
                <span>
                  {bucket.name}:{' '}
                  <span className="print-legend__count">
                    {bucket.value} سؤال ({bucket.percentage}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== منهجية التحليل ===== */}
      <section className="print-section print-section--flow print-section--page">
        <h2 className="print-section-title">منهجية التحليل</h2>

        <ul className="print-method-list">
          <li>
            <span className="term">مقياس الاستجابة</span>
            <span className="desc">
              {scaleDescription}. تُرمَّز الاستجابات من {ANALYSIS_SCALE.min} (أدنى موافقة) إلى الحد
              الأعلى الموصوف لكل سؤال، والاستجابات النصية تُترجم إلى قيم رقمية مكافئة.
            </span>
          </li>
          <li>
            <span className="term">المتوسط الحسابي</span>
            <span className="desc">
              مجموع استجابات السؤال مقسوماً على عدد الاستجابات الصالحة له. الاستجابات الفارغة تُستبعد،
              لذلك قد يختلف العدد من سؤال لآخر.
            </span>
          </li>
          <li>
            <span className="term">الوزن النسبي</span>
            <span className="desc">
              نسبة مجموع الاستجابات إلى أقصى مجموع ممكن:
              <span className="print-formula">
                ( مجموع الاستجابات ÷ ( العدد × الحد الأعلى لسُلَّم السؤال ) ) × 100
              </span>
            </span>
          </li>
          <li>
            <span className="term">أرضية المقياس</span>
            <span className="desc">
              لأن أدنى استجابة ممكنة هي {ANALYSIS_SCALE.min} وليست صفراً، فإن أرضية الوزن النسبي هي{' '}
              <strong>{floorDescription}</strong> وليست 0%. تُقرأ النسب على هذا الأساس، ولا تُفسَّر
              كنسبة مئوية تبدأ من الصفر.
            </span>
          </li>
          <li>
            <span className="term">معامل الثبات</span>
            <span className="desc">
              يُحسب ألفا كرونباخ من الاستجابات المكتملة على بنود المجموعة. لا تُعرض قيمة عندما يقل
              عدد البنود عن اثنين، أو يقل عدد الاستجابات المكتملة عن اثنتين، أو ينعدم تباين المجموع.
            </span>
          </li>
          <li>
            <span className="term">درجات التقييم</span>
            <span className="desc">
              ممتاز (90% فأعلى) · جيد جداً (80-90%) · جيد (70-80%) · مقبول (60-70%) · ضعيف (أقل من 60%).
            </span>
          </li>
          <li>
            <span className="term">نقاط القوة والتحسين</span>
            <span className="desc">
              يُعدّ السؤال نقطة قوة عند {NARRATIVE_THRESHOLDS.strength}% فأعلى، ويُدرَج ضمن نقاط
              التحسين عند أقل من {NARRATIVE_THRESHOLDS.weakness}%.
            </span>
          </li>
          <li>
            <span className="term">تصنيف مستويات الأداء</span>
            <span className="desc">
              مرتفع ({DISTRIBUTION_BANDS.high}% فأعلى) · متوسط ({DISTRIBUTION_BANDS.medium}-
              {DISTRIBUTION_BANDS.high}%) · منخفض (أقل من {DISTRIBUTION_BANDS.medium}%).
            </span>
          </li>
          <li>
            <span className="term">ترتيب الأسئلة</span>
            <span className="desc">
              ترتيب تنافسي حسب الوزن النسبي: الأسئلة المتساوية تأخذ نفس الترتيب، ويقفز الترتيب التالي
              بعدد المتساويات.
            </span>
          </li>
        </ul>
      </section>

      {/* ===== نتائج الأسئلة ===== */}
      <section className="print-section print-section--flow print-section--page">
        <h2 className="print-section-title">نتائج تحليل الاستبيان</h2>
        <div className="print-kpi">
          <span>المتوسط العام للاستبيان:</span>
          <span className="print-kpi__value">{data.overallAverage}%</span>
        </div>
        <table className="print-table print-table--results">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>م</th>
              <th style={{ width: '36%' }}>السؤال</th>
              <th>العدد</th>
              <th>المتوسط</th>
              <th>الانحراف</th>
              <th>الوزن النسبي</th>
              <th>الدرجة</th>
              <th>الترتيب</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((item) => {
              const grade = gradeFor(item.relativeWeight);
              return (
                <tr key={item.questionNumber}>
                  <td className="num">{item.questionNumber}</td>
                  <td>{item.question}</td>
                  <td className="num">{item.count}</td>
                  <td className="num">{item.mean}</td>
                  <td className="num">{item.stdDev}</td>
                  <td className="weight">{item.relativeWeight}%</td>
                  <td className="grade" style={{ color: grade.color, background: grade.background }}>
                    {grade.label}
                  </td>
                  <td className="num">{item.rank}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ===== أسئلة نعم/لا ===== */}
      {hasBinary && (
        <section className="print-section print-section--flow print-section--page">
          <h2 className="print-section-title">أسئلة الإجابة الثنائية (نعم / لا)</h2>
          <p style={{ fontSize: '10pt', marginBottom: '4mm' }}>
            هذه الأسئلة معروضة منفصلةً ولا تدخل في حساب المتوسط العام، لأن مداها لا يطابق مدى
            {' '}{ANALYSIS_SCALE.label} فيشوّه المقارنة.
          </p>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '6%' }}>م</th>
                <th style={{ width: '48%' }}>السؤال</th>
                <th>العدد</th>
                <th>نسبة «نعم»</th>
                <th>نسبة «لا»</th>
              </tr>
            </thead>
            <tbody>
              {data.binaryResults!.map((item) => {
                const yes = item.distribution.find((slice) => slice.value === item.scaleMax);
                const no = item.distribution.find((slice) => slice.value === 1);
                return (
                  <tr key={item.questionNumber}>
                    <td className="num">{item.questionNumber}</td>
                    <td>{item.question}</td>
                    <td className="num">{item.count}</td>
                    <td className="weight">{yes?.percentage ?? 0}%</td>
                    <td className="num">{no?.percentage ?? 0}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ===== التوزيع التكراري ===== */}
      <section className="print-section print-section--flow print-section--page">
        <h2 className="print-section-title">التوزيع التكراري للاستجابات</h2>
        <p style={{ fontSize: '10pt', marginBottom: '4mm' }}>
          عدد المشاركين الذين اختاروا كل مستوى استجابة، والنسبة بين قوسين.
        </p>
        <table className="print-table print-table--compact">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>م</th>
              <th style={{ width: '34%' }}>السؤال</th>
              {distributionLevels.map((level) => (
                <th key={level}>{level}</th>
              ))}
              <th>لم يجب</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((item) => (
              <tr key={item.questionNumber}>
                <td className="num">{item.questionNumber}</td>
                <td>{item.question}</td>
                {distributionLevels.map((level) => {
                  if (level > item.scaleMax) return <td key={level} className="num">—</td>;
                  const slice = item.distribution.find((s) => s.value === level);
                  return (
                    <td key={level} className="num">
                      {slice?.count ?? 0}
                      <span style={{ display: 'block', fontSize: '7.5pt', color: '#777' }}>
                        ({slice?.percentage ?? 0}%)
                      </span>
                    </td>
                  );
                })}
                <td className="num">{item.missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ===== جدول المحاور ===== */}
      {hasAxes && (
        <section className="print-section print-section--flow print-section--page">
          <h2 className="print-section-title">نتائج تحليل المحاور</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>المحور</th>
                <th>نطاق الأسئلة</th>
                <th>عدد الأسئلة</th>
                <th>المتوسط (%)</th>
                <th>ألفا كرونباخ</th>
                <th>الدرجة</th>
                <th>الترتيب</th>
              </tr>
            </thead>
            <tbody>
              {data.axes.map((axis) => {
                const grade = gradeFor(axis.average || 0);
                return (
                  <tr key={axis.name + axis.start}>
                    <td style={{ fontWeight: 700 }}>{axis.name}</td>
                    <td className="num">
                      {axisRangeLabel(axis)}
                    </td>
                    <td className="num">{axis.count}</td>
                    <td className="weight">{axis.average}%</td>
                    <td className="num">
                      {axis.cronbachAlpha !== undefined ? axis.cronbachAlpha : '—'}
                    </td>
                    <td className="grade" style={{ color: grade.color, background: grade.background }}>
                      {grade.label}
                    </td>
                    <td className="num">{axis.rank}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ===== مقارنة المحاور =====
          --flow لأن عدد أشرطة الأداء يساوي عدد المحاور وقد يتجاوز الصفحة */}
      {hasAxes && (
        <section className="print-section print-section--flow print-section--page">
          <h2 className="print-section-title">مقارنة بين المحاور</h2>

          <div className="print-chart-block">
            <div className="print-chart-wrap">
              <BarChart width={650} height={320} data={axesChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={90}
                  tick={{ fontSize: 10, fill: '#1a237e' }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Bar dataKey="average" fill="#3949ab" isAnimationActive={false} />
              </BarChart>
            </div>
          </div>

          <div className="print-axis-bars">
            {data.axes.map((axis) => {
              const average = axis.average || 0;
              return (
                <div key={axis.name + axis.start} className="print-axis-bar">
                  <div className="print-axis-bar__head">
                    <span className="print-axis-bar__name">
                      {axis.rank}. {axis.name}
                    </span>
                    <span className="print-axis-bar__value" style={{ color: barColor(average) }}>
                      {average}%
                    </span>
                  </div>
                  <div className="print-axis-bar__track">
                    <div
                      className="print-axis-bar__fill"
                      style={{ width: `${Math.min(100, Math.max(0, average))}%`, background: barColor(average) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== الرسوم البيانية =====
          --flow مقصود: ثلاثة رسوم مكدّسة أطول من صفحة واحدة، والمنع الكلي للكسر
          هنا يدفعها للفيض. كل print-chart-block يحمي نفسه من الكسر منفرداً. */}
      <section className="print-section print-section--flow print-section--page">
        <h2 className="print-section-title">الرسوم البيانية والمؤشرات</h2>

        <div className="print-chart-block">
          <h3>أعلى 10 أسئلة حسب الوزن النسبي</h3>
          <div className="print-chart-wrap">
            <BarChart width={650} height={250} data={top10Data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Bar dataKey="weight" fill="#2e7d32" isAnimationActive={false} />
            </BarChart>
          </div>
        </div>

        {bottom5Data.length > 0 && (
          <div className="print-chart-block">
            <h3>أدنى 5 أسئلة حسب الوزن النسبي</h3>
            <div className="print-chart-wrap">
              <BarChart width={650} height={220} data={bottom5Data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Bar dataKey="weight" fill="#c62828" isAnimationActive={false} />
              </BarChart>
            </div>
          </div>
        )}

        {distribution.length > 0 && (
          <div className="print-chart-block">
            <h3>توزيع الأوزان النسبية للأسئلة</h3>
            <div className="print-chart-wrap">
              <PieChart width={420} height={240}>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {distribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </div>

            {/* وسيلة إيضاح مكتوبة بالعدد والنسبة بدل <Legend/> الافتراضي */}
            <div className="print-legend">
              {distribution.map((bucket) => (
                <div key={bucket.name} className="print-legend__item">
                  <span className="print-legend__swatch" style={{ background: bucket.fill }} />
                  <span>
                    {bucket.name}:{' '}
                    <span className="print-legend__count">
                      {bucket.value} ({bucket.percentage}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ===== مقارنة بين الفئات ===== */}
      {comparison && (
        <section className="print-section print-section--flow print-section--page">
          <h2 className="print-section-title">مقارنة بين الفئات</h2>
          <p style={{ fontSize: '10pt', marginBottom: '4mm' }}>
            مقارنة متوسطات المحاور بين فئات{' '}
            <strong>{comparison.column.replace(/^\d+\.\s*/, '')}</strong>، مرتبة تنازلياً حسب
            المتوسط العام لكل فئة.
          </p>
          <table className="print-table">
            <thead>
              <tr>
                <th>الفئة</th>
                <th>العدد</th>
                {comparison.axisNames.map((name) => (
                  <th key={name}>{name}</th>
                ))}
                <th>المتوسط العام</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.category}>
                  <td style={{ fontWeight: 700 }}>{row.category}</td>
                  <td className="num">{row.respondents}</td>
                  {row.axisAverages.map((average, index) => {
                    const grade = gradeFor(average);
                    return (
                      <td
                        key={comparison.axisNames[index]}
                        className="num"
                        style={{ color: grade.color, fontWeight: 700 }}
                      >
                        {average}%
                      </td>
                    );
                  })}
                  <td className="weight">{row.overallAverage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ===== التحليل النهائي ===== */}
      <section className="print-section print-section--flow print-section--page">
        <h2 className="print-section-title">التحليل النهائي والاستنتاجات</h2>

        <div className="print-narrative">
          <div className="print-narrative-box" style={{ textAlign: 'center', borderColor: '#1a237e' }}>
            <h4>المتوسط العام للاستبيان</h4>
            <div className="print-kpi__value" style={{ fontSize: '22pt', color: overallGrade.color }}>
              {data.overallAverage}%
            </div>
            <div style={{ fontSize: '10pt', marginTop: '2mm' }}>درجة التقييم: {overallGrade.label}</div>
          </div>

          {bestAxis && worstAxis && (
            <div className="print-narrative-box" style={{ borderColor: '#1a237e' }}>
              <h4>تحليل المحاور</h4>
              <ul style={{ margin: 0, paddingRight: '5mm' }}>
                <li style={{ marginBottom: '2mm' }}>
                  <strong>أفضل محور أداءً:</strong> {bestAxis.name} بمتوسط ({bestAxis.average}%)
                </li>
                <li>
                  <strong>المحور الأقل تقييماً:</strong> {worstAxis.name} بمتوسط ({worstAxis.average}%)
                </li>
              </ul>
            </div>
          )}

          <div className="print-narrative-box">
            <h4>ملاحظات وتوصيات تفسيرية (تلقائية)</h4>
            <div dangerouslySetInnerHTML={{ __html: cleanAutoCommentHtml(data.autoComment) }} />
          </div>

          {data.manualComment && (
            <div className="print-narrative-box" style={{ borderColor: '#1a237e' }}>
              <h4>إضافات وتوصيات (لجنة القياس والتقويم):</h4>
              <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{data.manualComment}</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== تعليقات المشاركين ===== */}
      {hasComments && (
        <section className="print-section print-section--flow print-section--page">
          <h2 className="print-section-title">تعليقات وملاحظات المشاركين</h2>
          {data.comments!.map((group) => (
            <div key={group.question} className="print-comment-group">
              <h4>{group.question}</h4>
              <div className="print-comment-meta">
                {group.answers.length} تعليقاً من إجمالي {group.totalResponses} استجابة
                {group.skippedCount > 0 && ` — استُبعد ${group.skippedCount} بلا محتوى`}
              </div>
              <ul>
                {group.answers.map((answer, index) => (
                  <li key={`${index}-${answer.text.slice(0, 24)}`}>
                    {answer.text}
                    {answer.occurrences > 1 && (
                      <span className="print-comment-count">تكرر {answer.occurrences} مرات</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* ===== اعتماد التقرير ===== */}
      <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: '10mm' }}>
        <PrintFooter signatures={data.signatures} />
      </div>
    </div>
  );
}
