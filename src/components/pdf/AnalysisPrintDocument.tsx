/* eslint-disable @next/next/no-img-element */
'use client';
import '@/styles/print.css';

import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import { ReportData } from '@/types/analysis';
import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
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
  getBottom5ChartData,
  getRespondentCount,
  getResponseHistogramData,
  getTop10ChartData,
  getWeightDistributionPieData,
} from '@/lib/pdf/report-helpers';
import {
  balanceReportPageStarts,
  getReportLayoutProfile,
} from '@/lib/pdf/report-layout';

interface AnalysisPrintDocumentProps {
  data: ReportData;
  preview?: boolean;
}

/** لون شريط الأداء يتبع نفس عتبات درجة التقييم */
function barColor(average: number): string {
  return gradeFor(average).color;
}

const RADIAN = Math.PI / 180;

interface DonutLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}

/**
 * نسبة مكتوبة داخل كل قطاع. الحلقة بلا أرقام كانت تُقرأ كزينة لا كبيانات،
 * وخطوط الإيضاح الخارجية تتداخل وتُقصّ عند حد الصفحة في الطباعة.
 */
function renderDonutLabel(props: unknown) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as DonutLabelProps;
  const share = Math.round((percent ?? 0) * 100);
  if (!share) return null;

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
    >
      {share}%
    </text>
  );
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
  const documentRef = useRef<HTMLDivElement>(null);
  const layoutProfile = getReportLayoutProfile(data);

  useEffect(() => {
    setPrintReady(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled && documentRef.current) {
        balanceReportPageStarts(documentRef.current);
        setPrintReady(true);
      }
    }, 4000);

    const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    const prepareLayout = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      // Recharts يحتاج إطارين ليكمل SVG بعد استقرار الخطوط.
      await nextFrame();
      await nextFrame();
      if (cancelled || !documentRef.current) return;
      balanceReportPageStarts(documentRef.current);
      await nextFrame();
      window.clearTimeout(timer);
      setPrintReady(true);
    };
    void prepareLayout();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data, layoutProfile.density]);

  if (!data.results?.length) return null;

  // العدد الإجمالي أدق من أكبر عدد استجابات لسؤال واحد، لأن الأسئلة تختلف في
  // القيم المفقودة. نعود للتقدير القديم فقط مع تقارير قديمة لا تحمل الحقل.
  const respondentCount = data.totalRespondents ?? getRespondentCount(data.results);
  const top10Data = getTop10ChartData(data.resultsForAnalysis);
  const bottom5Data = getBottom5ChartData(data.resultsForAnalysis);
  const distribution = getWeightDistributionPieData(data.results);
  const { best: bestAxis, worst: worstAxis } = getAxisExtremes(data.axes);

  const hasAxes = data.axes.length > 0;
  const hasComments = Boolean(data.comments && data.comments.length > 0);
  const hasBinary = Boolean(data.binaryResults && data.binaryResults.length > 0);
  const comparison = data.comparison;
  const overallGrade = gradeFor(data.overallAverage);

  const usedScaleRanges = Array.from(
    new Map(
      data.results.map((item) => {
        const minimum = item.scaleMin ?? ANALYSIS_SCALE.min;
        return [`${minimum}-${item.scaleMax}`, { minimum, maximum: item.scaleMax }];
      })
    ).values()
  ).sort((a, b) => a.maximum - b.maximum || a.minimum - b.minimum);
  const scaleCounts = usedScaleRanges
    .map(({ minimum, maximum }) => {
      const count = data.results.filter(
        (item) => (item.scaleMin ?? ANALYSIS_SCALE.min) === minimum && item.scaleMax === maximum
      ).length;
      return `من ${minimum} إلى ${maximum}: ${count} سؤال`;
    })
    .join('، ');
  const scaleDescription =
    usedScaleRanges.length === 1
      ? `سُلَّم ${usedScaleRanges[0].minimum}-${usedScaleRanges[0].maximum}`
      : `سلالم متعددة حسب السؤال (${usedScaleRanges
          .map(({ minimum, maximum }) => `${minimum}-${maximum}`)
          .join('، ')})`;
  const floorDescription = usedScaleRanges
    .map(({ minimum, maximum }) =>
      `${Math.round((minimum / maximum) * 100)}% للسُلَّم ${minimum}-${maximum}`
    )
    .join('، ');
  const histogramData = getResponseHistogramData(data.results);
  const warnings = data.analysisWarnings ?? [];

  const methodologyItems: Array<{ term: string; description: React.ReactNode }> = [
    {
      term: 'وحدة التحليل ونطاقه',
      description: (
        <>
          وحدة التحليل هي إجابة المشارك عن بند كمي. شمل التقرير {respondentCount} مشاركاً و
          {data.results.length} بنداً كمياً، وتُعرض أسئلة نعم/لا والتعليقات في أقسام منفصلة.
        </>
      ),
    },
    {
      term: 'مصدر سُلَّم السؤال',
      description: (
        <>
          بدائل السؤال المخزنة هي المرجع الأول لليكرت، والحد الصريح هو المرجع للمقياس الخطي.
          السلالم المستخدمة: <strong>{scaleCounts}</strong>. إذا تجاوزت قيمة مرصودة الحد الموصوف،
          يرفع المحرك الحد ويصدر تحذيراً بدلاً من إنتاج نسبة تتجاوز 100%.
        </>
      ),
    },
    {
      term: 'ترميز الاستجابات',
      description: (
        <>
          تُرمز البدائل ترتيبياً من الحد الأدنى الموصوف للسؤال إلى حده الأعلى. يعتمد
          التحليل خريطة بدائل كل سؤال، ولا يخلط بين عدد البدائل وقيمة رقمية موروثة من سؤال آخر.
        </>
      ),
    },
    {
      term: 'الأسئلة العكسية',
      description: (
        <>
          يعاد ترميز السؤال المحدد عكسياً قبل الحساب بالصيغة: (الحد الأدنى + الحد الأعلى - القيمة)،
          حتى تشير الدرجة الأعلى دائماً إلى تقييم أفضل.
        </>
      ),
    },
    {
      term: 'المفقود وغير الصالح',
      description: (
        <>
          تُستبعد الإجابة الفارغة أو غير الرقمية من السؤال فقط، ويظهر العدد الصالح لكل بند. القيم
          خارج نطاق السُلَّم تُستبعد وتوثق في تحذيرات سلامة البيانات.
        </>
      ),
    },
    {
      term: 'المتوسط والانحراف',
      description: (
        <>
          المتوسط هو مجموع القيم الصالحة ÷ عددها. الانحراف المعياري المعروض هو انحراف العينة
          بقسمة التباين على (ن - 1)، ويصف تشتت الآراء ولا يرفع التقييم أو يخفضه.
        </>
      ),
    },
    {
      term: 'الوزن النسبي',
      description: (
        <>
          نسبة مجموع الاستجابات إلى أقصى مجموع ممكن للسؤال:
          <span className="print-formula">
            ( مجموع الاستجابات ÷ ( العدد الصالح × الحد الأعلى للسُلَّم ) ) × 100
          </span>
        </>
      ),
    },
    {
      term: 'المتوسط العام والمحاور',
      description: (
        <>
          المتوسط العام هو المتوسط الحسابي لأوزان البنود الكمية، فيأخذ كل بند وزناً متساوياً.
          ومتوسط المحور هو متوسط أوزان البنود التابعة له فقط؛ لا تدخل البنود الثنائية أو النصية.
        </>
      ),
    },
    {
      term: 'أرضية الوزن النسبي',
      description: (
        <>
          تعتمد أرضية الوزن على الحد الأدنى للسؤال، وتساوي <strong>{floorDescription}</strong>.
          لذلك الوزن النسبي مؤشر نسبة من الدرجة القصوى؛ ويبدأ من صفر فقط عندما يبدأ السُلَّم من صفر.
        </>
      ),
    },
    {
      term: 'الثبات الداخلي',
      description: (
        <>
          يحسب ألفا كرونباخ المعياري من متوسط ارتباطات البنود، بعد الحذف القائمي للاستجابات غير
          المكتملة. هذه الصيغة تجعل السلالم المختلفة قابلة للجمع، ولا تعرض قيمة عند انعدام تباين
          بند أو عدم كفاية البنود والعينة.
        </>
      ),
    },
    {
      term: 'الترتيب والتعادل',
      description: (
        <>
          ترتيب تنافسي تنازلي حسب الوزن النسبي: البنود المتساوية تأخذ الرتبة نفسها، ثم يقفز الرقم
          التالي بعدد البنود المتعادلة. تُقرب النتائج المعروضة إلى منزلتين فقط بعد إتمام الحساب.
        </>
      ),
    },
    {
      term: 'عتبات التفسير',
      description: (
        <>
          ممتاز (90% فأعلى)، جيد جداً (80-أقل من 90%)، جيد (70-أقل من 80%)، مقبول
          (60-أقل من 70%)، ضعيف (أقل من 60%). هذه عتبات وصفية للنظام وليست اختبار دلالة إحصائية.
        </>
      ),
    },
    {
      term: 'القوة والتحسين',
      description: (
        <>
          نقطة قوة عند {NARRATIVE_THRESHOLDS.strength}% فأعلى، ونقطة تحسين عند أقل من{' '}
          {NARRATIVE_THRESHOLDS.weakness}%. وتصنف الأسئلة مرتفعة عند {DISTRIBUTION_BANDS.high}%
          فأعلى، ومتوسطة من {DISTRIBUTION_BANDS.medium}% إلى أقل من {DISTRIBUTION_BANDS.high}%،
          ومنخفضة دون ذلك.
        </>
      ),
    },
    {
      term: 'المقارنات والتعليقات',
      description: (
        <>
          المقارنة بين الفئات وصفية وتعتمد متوسطات المحاور ولا تدعي فروقاً دالة إحصائياً. تنظف
          التعليقات من الإجابات الخالية، وتجمع النصوص المتطابقة مع إظهار مرات التكرار دون تحويلها
          إلى درجات كمية.
        </>
      ),
    },
    {
      term: 'ضبط الجودة وحدود القراءة',
      description: (
        <>
          يمنع التصدير إذا خرج متوسط عن سُلَّمه أو وزن عن 0-100%. النتائج تصف العينة المستجيبة
          فقط؛ ولا تثبت السببية أو تمثيل غير المستجيبين، وتفسر مع حجم العينة ومعدل الاستجابة.
        </>
      ),
    },
  ];

  // الفهرس يتبع الأقسام الفعلية — قسم غائب لا يظهر في الفهرس
  const tocEntries: { title: string; note: string }[] = [
    { title: 'الملخص التنفيذي', note: 'أهم المؤشرات في لمحة واحدة' },
    { title: 'منهجية التحليل', note: 'المقياس والمعادلة وعتبات الحكم' },
    { title: 'نتائج تحليل الاستبيان', note: 'جدول تفصيلي بكل الأسئلة ودرجاتها' },
    ...(hasBinary
      ? [{ title: 'أسئلة الإجابة الثنائية', note: 'أسئلة نعم/لا خارج المتوسط العام' }]
      : []),
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
      ref={documentRef}
      className={`print-document ${layoutProfile.className}${preview ? ' print-document--preview' : ''}`}
      data-print-ready={printReady ? 'true' : 'false'}
      data-layout-profile={layoutProfile.density}
      data-layout-score={layoutProfile.contentScore}
      style={{ '--print-comment-columns': layoutProfile.commentColumns } as CSSProperties}
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
      <section className="print-section print-section--flow print-section--front-matter-end">
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
      <section className="print-section" data-layout-section="true">
        <h2 className="print-section-title">الملخص التنفيذي</h2>

        <div className="print-kpi-grid" data-layout-lead="true">
          <div className="print-kpi-card">
            <div className="print-kpi-card__label">المتوسط العام للاستبيان</div>
            <div className="print-kpi-card__value" style={{ color: overallGrade.color }}>
              {data.overallAverage}%
            </div>
            <div className="print-kpi-card__note">درجة التقييم: {overallGrade.label}</div>
          </div>

          {data.overallCronbachAlpha !== undefined && (
            <div className="print-kpi-card">
            <div className="print-kpi-card__label">الثبات الداخلي (ألفا المعياري)</div>
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
      <section className="print-section print-section--flow" data-layout-section="true">
        <h2 className="print-section-title">منهجية التحليل</h2>

        {warnings.length > 0 && (
          <div className="print-data-warning" data-layout-lead="true">
            <h4>تنبيهات سلامة البيانات التي عالجها المحرك</h4>
            <ul>
              {warnings.map((warning, index) => (
                <li key={`${warning.code}-${warning.questionNumber ?? index}`}>{warning.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="print-method-summary">
          <strong>{scaleDescription}</strong>
          <span> · </span>
          <span>الأوزان مقيدة بالنطاق 0-100%</span>
          <span> · </span>
          <span>التقريب بعد الحساب إلى منزلتين</span>
        </div>

        <ul className="print-method-list">
          {methodologyItems.map((item, index) => (
            <li key={item.term} data-layout-lead={index === 0 && warnings.length === 0 ? 'true' : undefined}>
              <span className="term">{item.term}</span>
              <span className="desc">{item.description}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ===== نتائج الأسئلة ===== */}
      <section className="print-section print-section--flow" data-layout-section="true">
        <h2 className="print-section-title">نتائج تحليل الاستبيان</h2>
        <div className="print-kpi" data-layout-lead="true">
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
        <section className="print-section print-section--flow" data-layout-section="true">
          <h2 className="print-section-title">أسئلة الإجابة الثنائية (نعم / لا)</h2>
          <p style={{ fontSize: '10pt', marginBottom: '4mm' }} data-layout-lead="true">
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
                const no = item.distribution.find((slice) => slice.value === (item.scaleMin ?? 1));
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

      {/* ===== جدول المحاور ===== */}
      {hasAxes && (
        <section className="print-section print-section--flow" data-layout-section="true">
          <h2 className="print-section-title">نتائج تحليل المحاور</h2>
          <table className="print-table">
            <thead>
              <tr data-layout-lead="true">
                <th>المحور</th>
                <th>نطاق الأسئلة</th>
                <th>عدد الأسئلة</th>
                <th>المتوسط (%)</th>
                <th>ألفا المعياري</th>
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
        <section className="print-section print-section--flow" data-layout-section="true">
          <h2 className="print-section-title">مقارنة بين المحاور</h2>

          {/* أُزيل هنا رسم أعمدة رأسي بأسماء محاور مائلة: أسماء المحاور العربية
              أطول من ارتفاع محور السينات المتاح، فكانت تفيض خارج حدود الـ SVG
              وتُرسم فوق تذييل الصفحة وتُقصّ. الأشرطة الأفقية أدناه تعرض نفس
              البيانات وتستوعب الاسم الكامل بلا ميل ولا قصّ. */}
          <div className="print-axis-bars">
            {data.axes.map((axis, axisIndex) => {
              const average = axis.average || 0;
              return (
                <div
                  key={axis.name + axis.start}
                  className="print-axis-bar"
                  data-layout-lead={axisIndex === 0 ? 'true' : undefined}
                >
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
      <section className="print-section print-section--flow" data-layout-section="true">
        <h2 className="print-section-title">الرسوم البيانية والمؤشرات</h2>

        <div className="print-chart-grid">
        <div className="print-chart-block" data-layout-lead="true">
          <h3>أعلى 10 أسئلة حسب الوزن النسبي</h3>
          <div className="print-chart-wrap">
            <BarChart width={layoutProfile.chartWidth} height={layoutProfile.chartHeight} data={top10Data}>
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
              <BarChart width={layoutProfile.chartWidth} height={layoutProfile.chartHeight} data={bottom5Data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Bar dataKey="weight" fill="#c62828" isAnimationActive={false} />
              </BarChart>
            </div>
          </div>
        )}

        {histogramData.length > 0 && (
          <div className="print-chart-block">
            <h3>المدرج التكراري للاستجابات</h3>
            <p className="print-chart-note">
              موضع الاستجابة داخل سُلَّم سؤالها بعد توحيده إلى خمس فئات قابلة للمقارنة.
            </p>
            <div className="print-chart-wrap">
              <AreaChart
                width={layoutProfile.chartWidth}
                height={layoutProfile.chartHeight}
                data={histogramData}
                margin={{ top: 16, right: 12, bottom: 8, left: 4 }}
              >
                <defs>
                  <linearGradient id="histogramFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3949ab" stopOpacity={0.75} />
                    <stop offset="100%" stopColor="#3949ab" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e3f2" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#1a237e"
                  strokeWidth={2}
                  fill="url(#histogramFill)"
                  isAnimationActive={false}
                  label={{ position: 'top', fontSize: 10, fill: '#1a237e' }}
                  dot={{ r: 3, fill: '#1a237e' }}
                />
              </AreaChart>
            </div>
          </div>
        )}

        {distribution.length > 0 && (
          <div className="print-chart-block">
            <h3>توزيع الأسئلة على مستويات الأداء</h3>
            {/* الرسم ووسيلة الإيضاح جنباً إلى جنب: الحلقة وحدها كانت تترك نصف
                عرض الصفحة فارغاً، والنسب لم تكن مكتوبة عليها إطلاقاً. */}
            <div className="print-donut">
              <PieChart width={layoutProfile.chartWidth} height={layoutProfile.chartHeight}>
                <Pie
                  data={distribution}
                  cx={layoutProfile.chartWidth / 2}
                  cy={layoutProfile.chartHeight / 2}
                  innerRadius={Math.min(38, layoutProfile.chartHeight * 0.25)}
                  outerRadius={Math.min(70, layoutProfile.chartHeight * 0.42)}
                  paddingAngle={distribution.length > 1 ? 2 : 0}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  stroke="#ffffff"
                  strokeWidth={2}
                  labelLine={false}
                  label={renderDonutLabel}
                  isAnimationActive={false}
                >
                  {distribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <text x={layoutProfile.chartWidth / 2} y={layoutProfile.chartHeight / 2 - 5} textAnchor="middle" fontSize={18} fontWeight={700} fill="#1a237e">
                  {data.results.length}
                </text>
                <text x={layoutProfile.chartWidth / 2} y={layoutProfile.chartHeight / 2 + 11} textAnchor="middle" fontSize={9} fill="#666666">
                  سؤالاً
                </text>
              </PieChart>

              <ul className="print-donut__legend">
                {distribution.map((bucket) => (
                  <li key={bucket.name}>
                    <span className="print-legend__swatch" style={{ background: bucket.fill }} />
                    <span className="print-donut__label">{bucket.name}</span>
                    <span className="print-donut__value">
                      {bucket.value} سؤال · {bucket.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        </div>
      </section>

      {/* ===== مقارنة بين الفئات ===== */}
      {comparison && (
        <section className="print-section print-section--flow" data-layout-section="true">
          <h2 className="print-section-title">مقارنة بين الفئات</h2>
          <p style={{ fontSize: '10pt', marginBottom: '4mm' }} data-layout-lead="true">
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
      <section className="print-section print-section--flow" data-layout-section="true">
        <h2 className="print-section-title">التحليل النهائي والاستنتاجات</h2>

        <div className="print-narrative">
          <div
            className="print-narrative-box"
            data-layout-lead="true"
            style={{ textAlign: 'center', borderColor: '#1a237e' }}
          >
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

          <div
            className={`print-narrative-box${
              layoutProfile.density === 'compact' && data.manualComment
                ? ''
                : ' print-narrative-box--wide'
            }`}
          >
            <h4>ملاحظات وتوصيات تفسيرية (تلقائية)</h4>
            <div dangerouslySetInnerHTML={{ __html: cleanAutoCommentHtml(data.autoComment) }} />
          </div>

          {data.manualComment && (
            <div
              className={`print-narrative-box${
                layoutProfile.density === 'compact'
                  ? ''
                  : ' print-narrative-box--wide'
              }`}
              style={{ borderColor: '#1a237e' }}
            >
              <h4>إضافات وتوصيات (لجنة القياس والتقويم):</h4>
              <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{data.manualComment}</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== تعليقات المشاركين ===== */}
      {hasComments && (
        <section className="print-section print-section--flow" data-layout-section="true">
          <h2 className="print-section-title">تعليقات وملاحظات المشاركين</h2>
          {data.comments!.map((group, groupIndex) => (
            <div
              key={group.question}
              className="print-comment-group"
              data-layout-lead={groupIndex === 0 ? 'true' : undefined}
            >
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
    </div>
  );
}
