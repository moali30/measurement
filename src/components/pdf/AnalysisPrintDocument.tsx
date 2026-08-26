/* eslint-disable @next/next/no-img-element */
'use client';
import '@/styles/print.css';

import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import { QuestionResult, ReportData } from '@/types/analysis';
import { PieChart, Pie, Cell } from 'recharts';
import { POLARIZATION, ShareTone, gradeFor, shareStyle } from '@/lib/analysis/scale';
import {
  cleanAutoCommentHtml,
  formatReportDate,
  getAxisExtremes,
  getPolarizedResults,
  getRespondentCount,
  getWeightDistributionPieData,
} from '@/lib/pdf/report-helpers';
import {
  balanceReportPageStarts,
  getReportLayoutProfile,
} from '@/lib/pdf/report-layout';
import { PRIORITY_STYLES, recommendationScope } from '@/lib/analysis/recommendations';

interface AnalysisPrintDocumentProps {
  data: ReportData;
  preview?: boolean;
}

/** لون شريط الأداء يتبع نفس عتبات درجة التقييم */
function barColor(average: number): string {
  return gradeFor(average).color;
}

const RADIAN = Math.PI / 180;

/**
 * خلية نسبة داخل جدول انقسام الآراء.
 *
 * درجة اللون تتبع حجم النسبة، وعائلة اللون تتبع اتجاه الرأي: تدرّج واحد لكل
 * الأعمدة كان يجعل «رفض 45%» و«موافقة 45%» متطابقين بصرياً رغم تناقضهما.
 * الإطار السميك يميّز أكبر النسب الثلاث في الصف.
 */
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
      className={`share${dominant ? ' share--dominant' : ''}`}
      style={{ color: style.color, background: style.background }}
    >
      {value}%
    </td>
  );
}

/** أي الاتجاهات الثلاثة صاحب أكبر نسبة في الصف */
function dominantTone(item: QuestionResult): ShareTone {
  const max = Math.max(item.negativeShare, item.neutralShare, item.positiveShare);
  if (item.positiveShare === max) return 'positive';
  if (item.negativeShare === max) return 'negative';
  return 'neutral';
}

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
  // يُعاد حسابه هنا لا يُمرَّر: التقرير المطبوع قد يُفتح من ملف محفوظ، والملحق
  // يجب أن يصف الأرقام المعروضة فعلاً على الصفحة لا حالتها وقت التوليد.
  const distribution = getWeightDistributionPieData(data.results);
  const { best: bestAxis, worst: worstAxis } = getAxisExtremes(data.axes);

  const hasAxes = data.axes.length > 0;
  const hasComments = Boolean(data.comments && data.comments.length > 0);
  const recommendations = data.recommendations ?? [];
  const hasRecommendations = recommendations.length > 0;
  const polarized = getPolarizedResults(data.results);
  const hasPolarized = polarized.length > 0;
  const sampleProfile = data.sampleProfile ?? [];
  const hasSampleProfile = sampleProfile.length > 0;
  const comparison = data.comparison;
  const overallGrade = gradeFor(data.overallAverage);

  // السُّلَّم لم يعد متغيراً: كل بند يدخل التحليل هو ليكرت خماسي، والتحقق يمنع
  // إنتاج التقرير أصلاً إذا خالف بند ذلك. فلا حاجة لوصف سلالم متعددة.
  const warnings = data.analysisWarnings ?? [];

  const tocEntries: { title: string; note: string }[] = [
    { title: 'الملخص التنفيذي', note: 'أهم المؤشرات في لمحة واحدة' },
    { title: 'نتائج تحليل الاستبيان', note: 'جدول تفصيلي بكل الأسئلة ودرجاتها' },
    ...(hasPolarized
      ? [{ title: 'أسئلة انقسام الآراء', note: 'بنود تباعدت فيها كتلتا الرفض والموافقة' }]
      : []),
    ...(hasSampleProfile
      ? [{ title: 'توصيف العيّنة', note: 'المتغيرات الديموغرافية وتوزيع المشاركين' }]
      : []),
    ...(hasAxes
      ? [
          { title: 'نتائج تحليل المحاور', note: 'متوسط كل محور وترتيبه' },
          { title: 'مقارنة بين المحاور', note: 'أشرطة أداء مرتبة' },
        ]
      : []),
    { title: 'الرسوم البيانية والمؤشرات', note: 'توزيع الأسئلة على مستويات الأداء' },
    ...(comparison
      ? [{ title: 'مقارنة بين الفئات', note: `حسب ${comparison.column.replace(/^\d+\.\s*/, '')}` }]
      : []),
    { title: 'التحليل النهائي والاستنتاجات', note: 'نقاط القوة ومواضع التحسين' },
    ...(hasRecommendations
      ? [{ title: 'الجوانب التي تحتاج إلى تحسين', note: 'المجالات الأدنى وأهدافها الرقمية' }]
      : []),
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

          <div className="print-kpi-card">
            <div className="print-kpi-card__label">المؤشر المعياري العام</div>
            <div className="print-kpi-card__value">{data.overallNormalized}</div>
            <div className="print-kpi-card__note">من 100 — أرضيته صفر والحياد التام 50</div>
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

      {/* ===== نتائج الأسئلة ===== */}
      <section className="print-section print-section--flow" data-layout-section="true">
        <h2 className="print-section-title">نتائج تحليل الاستبيان</h2>
        <div className="print-kpi" data-layout-lead="true">
          <span>المتوسط العام للاستبيان:</span>
          <span className="print-kpi__value">{data.overallAverage}%</span>
        </div>
        {warnings.length > 0 && (
          <div className="print-data-warning">
            <h4>بنود استُبعدت من التحليل الكمي</h4>
            <ul>
              {warnings.map((warning, index) => (
                <li key={`${warning.code}-${warning.questionNumber ?? index}`}>{warning.message}</li>
              ))}
            </ul>
          </div>
        )}
        <table className="print-table print-table--results">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>م</th>
              <th style={{ width: '34%' }}>السؤال</th>
              <th>العدد</th>
              <th>المتوسط</th>
              <th>المؤشر المعياري</th>
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
                  <td className="num">{item.normalizedScore}</td>
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

      {/* ===== انقسام الآراء ===== */}
      {hasPolarized && (
        <section className="print-section print-section--flow" data-layout-section="true">
          <h2 className="print-section-title">أسئلة انقسام الآراء</h2>
          <p style={{ fontSize: '10pt', marginBottom: '4mm' }} data-layout-lead="true">
            {`بنود بلغت فيها كتلتا الرفض والموافقة معاً ${POLARIZATION.endShare}% فأكثر. المتوسط وحده لا يميّزها عن بند أجاب عنه الجميع بالحياد، والنسبة الأكبر في كل صف مكتوبة بخط عريض.`}
          </p>
          <table className="print-table print-table--shares">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>م</th>
                <th style={{ width: '40%' }}>السؤال</th>
                <th>العدد</th>
                <th>غير موافق</th>
                <th>محايد</th>
                <th>موافق</th>
                <th>الوزن النسبي</th>
              </tr>
            </thead>
            <tbody>
              {polarized.map((item) => {
                const dominant = dominantTone(item);
                return (
                  <tr key={item.questionNumber}>
                    <td className="num">{item.questionNumber}</td>
                    <td>{item.question}</td>
                    <td className="num">{item.count}</td>
                    <ShareCell
                      tone="negative"
                      value={item.negativeShare}
                      dominant={dominant === 'negative'}
                    />
                    <ShareCell
                      tone="neutral"
                      value={item.neutralShare}
                      dominant={dominant === 'neutral'}
                    />
                    <ShareCell
                      tone="positive"
                      value={item.positiveShare}
                      dominant={dominant === 'positive'}
                    />
                    <td className="weight">{item.relativeWeight}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </section>
      )}

      {/* ===== توصيف العيّنة ===== */}
      {hasSampleProfile && (
        <section className="print-section print-section--flow" data-layout-section="true">
          <h2 className="print-section-title">توصيف العيّنة</h2>
          <p style={{ fontSize: '10pt', marginBottom: '4mm' }} data-layout-lead="true">
            المتغيرات الديموغرافية وأسئلة الإجابتين. هذه متغيرات تصف من أجاب، لا بنود قياس، فلا
            تدخل المتوسط العام ولا ترتيب الأسئلة؛ وتُستخدم أساساً للمقارنة بين الفئات.
          </p>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '38%' }}>المتغير</th>
                <th style={{ width: '32%' }}>الفئة</th>
                <th>العدد</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              {sampleProfile.flatMap((group) =>
                group.values.map((value, index) => (
                  <tr key={`${group.column}-${value.label}`}>
                    {index === 0 && (
                      <td rowSpan={group.values.length} style={{ fontWeight: 700 }}>
                        {group.column.replace(/^\d+\.\s*/, '')}
                        <div style={{ fontWeight: 400, fontSize: '8.5pt', color: '#666666' }}>
                          {`${group.answered} مشاركاً`}
                        </div>
                      </td>
                    )}
                    <td>{value.label}</td>
                    <td className="num">{value.count}</td>
                    <td className="weight">{value.percentage}%</td>
                  </tr>
                ))
              )}
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
                <th>الوزن النسبي (%)</th>
                <th>المؤشر المعياري</th>
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
                    <td className="num">{axis.normalizedAverage ?? '—'}</td>
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
                      {`${average}% · معياري ${axis.normalizedAverage ?? 0}`}
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
        {distribution.length > 0 && (
          <div className="print-chart-block" data-layout-lead="true">
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
            className="print-narrative-box print-narrative-box--atomic"
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
            <div
              className="print-narrative-box print-narrative-box--atomic"
              style={{ borderColor: '#1a237e' }}
            >
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

      {/* ===== الجوانب التي تحتاج إلى تحسين ===== */}
      {hasRecommendations && (
        <section className="print-section print-section--flow" data-layout-section="true">
          <h2 className="print-section-title">الجوانب التي تحتاج إلى تحسين</h2>
          <p style={{ fontSize: '10pt', marginBottom: '4mm' }} data-layout-lead="true">
            {'الجوانب مرتبة بالأولوية، وكل رقم فيها مأخوذ من نتائج هذا التقرير. لكل جانب هدف رقمي بالوزن النسبي يُقاس عليه التحسن في الدورة القادمة، وتحديد وسيلة المعالجة متروك للجهة المختصة.'}
          </p>

          {recommendations.map((recommendation, index) => {
            const badge = PRIORITY_STYLES[recommendation.priority];
            return (
              <article
                key={recommendation.id}
                className="print-reco"
                data-layout-lead={index === 0 ? 'true' : undefined}
              >
                <header className="print-reco__head">
                  <span
                    className="print-reco__badge"
                    style={{ color: badge.color, background: badge.background }}
                  >
                    {recommendation.priority}
                  </span>
                  <span className="print-reco__scope">{recommendationScope(recommendation)}</span>
                </header>

                <p className="print-reco__why">{recommendation.rationale}</p>

                <p className="print-reco__goal">
                  <strong>{recommendation.indicator}: </strong>
                  {recommendation.target}
                </p>

                {recommendation.quotes.length > 0 && (
                  <ul className="print-reco__quotes">
                    {recommendation.quotes.map((quote) => (
                      <li key={quote}>{quote}</li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </section>
      )}

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
