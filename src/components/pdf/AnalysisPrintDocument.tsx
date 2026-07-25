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
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { PrintFooter } from './shared/PrintFooter';
import {
  cleanAutoCommentHtml,
  getAxisExtremes,
  getAxesChartData,
  getRespondentCount,
  getTop10ChartData,
  getWeightDistributionPieData,
} from '@/lib/pdf/report-helpers';

interface AnalysisPrintDocumentProps {
  data: ReportData;
  preview?: boolean;
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

  const respondentCount = getRespondentCount(data.results);
  const top10Data = getTop10ChartData(data.resultsForAnalysis);
  const pieData = getWeightDistributionPieData(data.results);
  const axesChartData = getAxesChartData(data.axes);
  const { best: bestAxis, worst: worstAxis } = getAxisExtremes(data.axes);
  const useLandscapeAxes = axesChartData.length > 6;

  return (
    <div
      className={`print-document${preview ? ' print-document--preview' : ''}`}
      data-print-ready={printReady ? 'true' : 'false'}
      dir="rtl"
    >
      {/* Cover page */}
      <section className="print-cover print-section">
        <div className="print-cover__logos">
          {data.logos?.quality && <img src={data.logos.quality} alt="Quality Logo" />}
          {data.logos?.university && <img src={data.logos.university} alt="University Logo" />}
          {data.logos?.college && <img src={data.logos.college} alt="College Logo" />}
        </div>

        <div className="print-cover__title-block">
          <h1 className="print-cover__title">{data.title}</h1>
          <p style={{ marginTop: '6mm', fontSize: '12pt', fontWeight: 600 }}>
            عدد المشاركين: <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{respondentCount}</span>
          </p>

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
          <div>تاريخ طرح الاستبيان: {data.surveyDate}</div>
          <div>تاريخ إعداد التقرير: {data.reportDate}</div>
        </div>
      </section>

      {/* Question results — single table with CSS header repeat */}
      <section className="print-section print-section--flow">
        <h2 className="print-section-title">نتائج تحليل الاستبيان</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>م</th>
              <th style={{ width: '46%' }}>السؤال</th>
              <th>العدد</th>
              <th>المتوسط</th>
              <th>الوزن النسبي</th>
              <th>الترتيب</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((item) => (
              <tr key={item.questionNumber}>
                <td className="num">{item.questionNumber}</td>
                <td>{item.question}</td>
                <td className="num">{item.count}</td>
                <td className="num">{item.mean}</td>
                <td className="weight">{item.relativeWeight}%</td>
                <td className="num">{item.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="print-kpi">
          <span>المتوسط العام للاستبيان:</span>
          <span className="print-kpi__value">{data.overallAverage}%</span>
        </div>
      </section>

      {/* Axes table */}
      {data.axes.length > 0 && (
        <section className="print-section print-section--flow">
          <h2 className="print-section-title">نتائج تحليل المحاور</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>المحور</th>
                <th>نطاق الأسئلة</th>
                <th>عدد الأسئلة</th>
                <th>المتوسط (%)</th>
                <th>الترتيب</th>
              </tr>
            </thead>
            <tbody>
              {data.axes.map((axis) => (
                <tr key={axis.name + axis.start}>
                  <td style={{ fontWeight: 700 }}>{axis.name}</td>
                  <td className="num">
                    من {axis.start} إلى {axis.end}
                  </td>
                  <td className="num">{axis.count}</td>
                  <td className="weight">{axis.average}%</td>
                  <td className="num">{axis.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Axis comparison chart */}
      {data.axes.length > 0 && (
        <section
          className={`print-section print-chart-block${useLandscapeAxes ? ' print-chart-block--landscape' : ''}`}
          style={useLandscapeAxes ? { page: 'landscape' } as React.CSSProperties : undefined}
        >
          <h2 className="print-section-title">مقارنة بين المحاور</h2>
          <div className="print-chart-wrap">
            <BarChart
              width={useLandscapeAxes ? 900 : 650}
              height={useLandscapeAxes ? 380 : 340}
              data={axesChartData}
            >
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
              <Bar dataKey="average" fill="#10b981" name="متوسط الوزن النسبي (%)" isAnimationActive={false} />
            </BarChart>
          </div>
        </section>
      )}

      {/* Charts section */}
      <section className="print-section">
        <h2 className="print-section-title">الرسوم البيانية والمؤشرات</h2>

        <div className="print-chart-block">
          <h3>أعلى 10 أسئلة حسب الوزن النسبي</h3>
          <div className="print-chart-wrap">
            <BarChart width={650} height={280} data={top10Data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Bar dataKey="weight" fill="#3b82f6" name="الوزن النسبي (%)" isAnimationActive={false} />
            </BarChart>
          </div>
        </div>

        {pieData.length > 0 && (
          <div className="print-chart-block">
            <h3>توزيع الأوزان النسبية للأسئلة</h3>
            <div className="print-chart-wrap">
              <PieChart width={650} height={280}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </div>
          </div>
        )}
      </section>

      {/* Final analysis */}
      <section className="print-section print-section--flow">
        <h2 className="print-section-title">التحليل النهائي والاستنتاجات</h2>

        <div className="print-narrative">
          <div className="print-narrative-box" style={{ textAlign: 'center', borderColor: '#1a237e' }}>
            <h4>المتوسط العام للاستبيان</h4>
            <div className="print-kpi__value" style={{ fontSize: '22pt' }}>
              {data.overallAverage}%
            </div>
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

      {/* Participant comments */}
      {data.comments && data.comments.length > 0 && (
        <section className="print-section print-section--flow">
          <h2 className="print-section-title">تعليقات وملاحظات المشاركين</h2>
          {data.comments.map((group) => (
            <div key={group.question} className="print-comment-group">
              <h4>{group.question}</h4>
              <ul>
                {group.answers.map((answer) => (
                  <li key={answer.slice(0, 40) + answer.length}>{answer}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Single footer with signatures at the very end of the document */}
      <PrintFooter signatures={data.signatures} />
    </div>
  );
}
