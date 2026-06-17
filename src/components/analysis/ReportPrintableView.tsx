'use client';

import React from 'react';
import { ReportData, QuestionResult } from '@/types/analysis';

interface ReportPrintableViewProps {
  data: ReportData;
}

const PAGE_STYLE = {
  width: '210mm',
  minHeight: '297mm',
  padding: '15mm',
  margin: '0 auto',
  backgroundColor: 'white',
  color: 'black',
  display: 'flex',
  flexDirection: 'column' as const,
  boxSizing: 'border-box' as const,
  fontFamily: 'Cairo, sans-serif',
};

const Header = ({ title, subtitle, logos }: any) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #1a237e' }}>
    <div style={{ width: '100px', display: 'flex', justifyContent: 'flex-end' }}>
      {logos?.quality && <img src={logos.quality} alt="Quality" style={{ maxHeight: '60px' }} />}
    </div>
    <div style={{ flex: 1, textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 5px 0', color: '#1a237e', fontSize: '20px' }}>{title}</h3>
      <p style={{ margin: 0, color: '#666', fontSize: '16px' }}>{subtitle}</p>
    </div>
    <div style={{ width: '100px', display: 'flex', justifyContent: 'flex-start' }}>
      {logos?.college && <img src={logos.college} alt="College" style={{ maxHeight: '60px' }} />}
    </div>
  </div>
);

const Footer = ({ signature }: { signature: string }) => (
  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '15px', borderTop: '1px solid #ddd', fontSize: '14px' }}>
    <div style={{ flex: 1, textAlign: 'center' }}>إعداد لجنة القياس والتقويم</div>
    <div style={{ flex: 1, textAlign: 'center' }}>
      <p style={{ margin: '0 0 10px 0' }}>التوقيع:</p>
      {signature ? (
        <img src={signature} alt="Signature" style={{ maxHeight: '60px', margin: '0 auto', display: 'block' }} />
      ) : (
        <div style={{ borderBottom: '1px solid #000', width: '150px', margin: '0 auto', height: '30px' }}></div>
      )}
    </div>
  </div>
);

export default function ReportPrintableView({ data }: ReportPrintableViewProps) {
  if (!data.results || data.results.length === 0) return null;

  const ROWS_PER_PAGE = 30;
  const resultChunks: QuestionResult[][] = [];
  for (let i = 0; i < data.results.length; i += ROWS_PER_PAGE) {
    resultChunks.push(data.results.slice(i, i + ROWS_PER_PAGE));
  }

  // A helper to clean tailwind classes for the print view
  const cleanHtml = (html: string) => {
    return html
      .replace(/bg-[a-z0-9-/]+/g, '')
      .replace(/text-[a-z0-9-/]+/g, '')
      .replace(/border-[a-z0-9-/]+/g, '')
      .replace(/dark:[a-z0-9-/]+/g, '')
      .replace(/shadow-[a-z0-9-/]+/g, '')
      .replace(/rounded-[a-z0-9-/]+/g, '');
  };

  return (
    <div dir="rtl" className="print-container" style={{ background: '#f0f0f0', padding: '20px' }}>
      {/* Cover Page */}
      <div className="report-page bg-white" style={PAGE_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: '40px', marginTop: '50mm' }}>
          {data.logos?.quality && <img src={data.logos.quality} style={{ maxHeight: '120px' }} />}
          {data.logos?.university && <img src={data.logos.university} style={{ maxHeight: '120px' }} />}
          {data.logos?.college && <img src={data.logos.college} style={{ maxHeight: '120px' }} />}
        </div>
        
        <h1 style={{ fontSize: '36px', textAlign: 'center', color: '#1a237e', margin: '60px 0' }}>{data.title}</h1>
        
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 'auto', marginBottom: '50mm', fontSize: '18px' }}>
          <div>تاريخ طرح الاستبيان: {data.surveyDate}</div>
          <div>تاريخ إعداد التقرير: {data.reportDate}</div>
        </div>
      </div>

      {/* Result Pages */}
      {resultChunks.map((chunk, index) => (
        <div key={index} className="report-page bg-white mt-8" style={PAGE_STYLE}>
          <Header title={data.title} subtitle={`نتائج تحليل الاستبيان - صفحة ${index + 1}`} logos={data.logos} />
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e8eaf6' }}>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>م</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>السؤال</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>العدد</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>المتوسط</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>الوزن النسبي</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>الترتيب</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map(item => (
                <tr key={item.questionNumber}>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.questionNumber}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.question}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.count}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.mean}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.relativeWeight}%</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {index === resultChunks.length - 1 && (
            <div style={{ fontWeight: 'bold', marginTop: '20px' }}>المتوسط العام: {data.overallAverage}%</div>
          )}

          <Footer signature={data.signature} />
        </div>
      ))}

      {/* Axes Pages */}
      {data.axes.length > 0 && (
        <div className="report-page bg-white mt-8" style={PAGE_STYLE}>
          <Header title={data.title} subtitle={`نتائج تحليل المحاور`} logos={data.logos} />
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e8eaf6' }}>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>المحور</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>نطاق الأسئلة</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>المتوسط</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>الترتيب</th>
              </tr>
            </thead>
            <tbody>
              {data.axes.map((axis, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{axis.name}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>من {axis.start} إلى {axis.end}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{axis.average}%</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{axis.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Footer signature={data.signature} />
        </div>
      )}

      {/* Comments Page */}
      <div className="report-page bg-white mt-8" style={PAGE_STYLE}>
        <Header title={data.title} subtitle="تحليل النتائج والملاحظات" logos={data.logos} />
        <div style={{ padding: '20px', lineHeight: '1.8' }} dangerouslySetInnerHTML={{ __html: cleanHtml(data.autoComment) }}></div>
        
        {data.manualComment && (
          <div style={{ marginTop: '30px', padding: '20px', borderRight: '4px solid #f9a825', backgroundColor: '#fff8e1' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>ملاحظات إضافية:</h4>
            <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{data.manualComment}</p>
          </div>
        )}
        <Footer signature={data.signature} />
      </div>
    </div>
  );
}
