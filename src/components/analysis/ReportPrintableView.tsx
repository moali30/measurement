/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import { ReportData, Axis } from '@/types/analysis';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';

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
  pageBreakAfter: 'always' as const,
};

interface HeaderProps {
  subtitle: string;
  logos?: { quality?: string; university?: string; college?: string };
  title?: string;
}

const Header = ({ subtitle, logos }: HeaderProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #1a237e' }}>
    <div style={{ width: '100px', display: 'flex', justifyContent: 'flex-end' }}>
      {logos?.quality && <img src={logos.quality} alt="Quality" style={{ maxHeight: '60px' }} />}
    </div>
    <div style={{ flex: 1, textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 5px 0', color: '#1a237e', fontSize: '18px' }}>{subtitle}</h3>
    </div>
    <div style={{ width: '100px', display: 'flex', justifyContent: 'flex-start' }}>
      {logos?.college && <img src={logos.college} alt="College" style={{ maxHeight: '60px' }} />}
    </div>
  </div>
);

const Footer = ({ signatures = [] }: { signatures: {name: string, url: string}[] }) => (
  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '15px', borderTop: '2px solid #1a237e', fontSize: '14px', fontWeight: 'bold' }}>
    <div style={{ flex: 1, textAlign: 'center', color: '#1a237e' }}>إعداد<br/>لجنة القياس والتقويم</div>
    
    <div style={{ flex: 2, display: 'flex', justifyContent: 'space-around' }}>
      {signatures.map((sig, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', color: '#333' }}>{sig.name}</p>
          <img src={sig.url} alt={sig.name} style={{ maxHeight: '60px', margin: '0 auto', display: 'block', mixBlendMode: 'multiply' }} />
        </div>
      ))}
      {signatures.length === 0 && (
         <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 10px 0' }}>التوقيع المعتمد</p>
            <div style={{ borderBottom: '1px solid #000', width: '150px', margin: '0 auto', height: '30px' }}></div>
         </div>
      )}
    </div>
  </div>
);

export default function ReportPrintableView({ data }: ReportPrintableViewProps) {
  if (!data.results || data.results.length === 0) return null;

  const ITEMS_PER_PAGE = 20;
  const paddedChunks = [];
  for (let i = 0; i < data.results.length; i += ITEMS_PER_PAGE) {
    paddedChunks.push(data.results.slice(i, i + ITEMS_PER_PAGE));
  }

  const cleanHtml = (html: string) => {
    return html
      .replace(/bg-[a-z0-9-\/]+/g, '')
      .replace(/text-[a-z0-9-\/]+/g, '')
      .replace(/border-[a-z0-9-\/]+/g, '')
      .replace(/dark:[a-z0-9-\/]+/g, '')
      .replace(/shadow-[a-z0-9-\/]+/g, '')
      .replace(/rounded-[a-z0-9-\/]+/g, '');
  };

  const top10Data = data.resultsForAnalysis.slice(0, 10).map(item => ({
    name: `س ${item.questionNumber}`,
    weight: item.relativeWeight
  }));

  const dist = {
    high: data.results.filter(item => item.relativeWeight >= 80).length,
    medium: data.results.filter(item => item.relativeWeight >= 60 && item.relativeWeight < 80).length,
    low: data.results.filter(item => item.relativeWeight < 60).length,
  };

  const pieData = [
    { name: 'مرتفع (>=80%)', value: dist.high, fill: '#4caf50' },
    { name: 'متوسط (60-80%)', value: dist.medium, fill: '#ffc107' },
    { name: 'منخفض (<60%)', value: dist.low, fill: '#f44336' },
  ].filter(item => item.value > 0);
  
  let bestAxis: Axis | null = null;
  let worstAxis: Axis | null = null;
  
  if (data.axes && data.axes.length > 0) {
     bestAxis = data.axes.reduce((a,b) => (a.average || 0) > (b.average || 0) ? a : b);
     worstAxis = data.axes.reduce((a,b) => (a.average || 0) < (b.average || 0) ? a : b);
  }

  return (
    <div dir="rtl" className="print-container" style={{ background: '#f0f0f0', padding: '20px' }}>
      
      {/* صفحة 1: الغلاف */}
      <div className="report-page bg-white" style={{ ...PAGE_STYLE, justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '80px', marginTop: '10mm', width: '100%' }}>
          {data.logos?.quality && <img src={data.logos.quality} alt="Quality Logo" style={{ maxHeight: '140px', maxWidth: '30%' }} />}
          {data.logos?.university && <img src={data.logos.university} alt="University Logo" style={{ maxHeight: '140px', maxWidth: '30%' }} />}
          {data.logos?.college && <img src={data.logos.college} alt="College Logo" style={{ maxHeight: '140px', maxWidth: '30%' }} />}
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '40px', marginBottom: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
           <h1 style={{ fontSize: '34px', color: '#1a237e', margin: '0', fontWeight: 'bold', lineHeight: '1.6' }}>{data.title}</h1>
           
           {data.filters && data.filters.length > 0 && (
              <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e8eaf6', borderRadius: '8px', display: 'inline-block', margin: '20px auto 0', textAlign: 'right' }}>
                 <strong style={{ color: '#1a237e', display: 'block', marginBottom: '8px' }}>الفئة المستهدفة للتحليل:</strong>
                 <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {data.filters.map((f, i) => (
                       <li key={i} style={{ marginBottom: '4px', fontSize: '15px' }}>
                          <span style={{ fontWeight: 'bold' }}>{f.column.replace(/^\d+\.\s*/, '')}:</span> {f.values.join(' ، ')}
                       </li>
                    ))}
                 </ul>
              </div>
           )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', marginBottom: '10mm', fontSize: '18px', fontWeight: 'bold', width: '100%', padding: '0 20px' }}>
          <div>تاريخ طرح الاستبيان: {data.surveyDate}</div>
          <div>تاريخ إعداد التقرير: {data.reportDate}</div>
        </div>
      </div>

      {/* صفحات 2، 3، 4: نتائج تحليل الاستبيان */}
      {paddedChunks.map((chunk, index) => (
        <div key={`chunk-${index}`} className="report-page bg-white mt-8" style={PAGE_STYLE}>
          <Header title={data.title} subtitle={`نتائج تحليل الاستبيان - الجزء ${index + 1}`} logos={data.logos} />
          
          {chunk.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                  <th style={{ padding: '10px', border: '1px solid #ddd', width: '5%' }}>م</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd', width: '55%' }}>السؤال</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>العدد</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>المتوسط</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الوزن النسبي</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>الترتيب</th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((item, i) => (
                  <tr key={item.questionNumber} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold' }}>{item.questionNumber}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.question}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.count}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.mean}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', color: '#1a237e' }}>{item.relativeWeight}%</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', marginTop: '50px' }}>لا توجد بيانات إضافية في هذا الجزء</div>
          )}

          {index === paddedChunks.length - 1 && (
            <div style={{ fontWeight: 'bold', marginTop: '20px', backgroundColor: '#e8eaf6', padding: '15px', borderRadius: '8px', border: '2px solid #1a237e', display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
               <span>المتوسط العام للاستبيان:</span>
               <span style={{ color: '#1a237e', fontSize: '20px' }}>{data.overallAverage}%</span>
            </div>
          )}

          <Footer signatures={data.signatures} />
        </div>
      ))}

      {/* صفحة 5: نتائج تحليل المحاور */}
      <div className="report-page bg-white mt-8" style={PAGE_STYLE}>
        <Header title={data.title} subtitle="نتائج تحليل المحاور" logos={data.logos} />
        
        {data.axes && data.axes.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                <th style={{ padding: '12px', border: '1px solid #ddd' }}>المحور</th>
                <th style={{ padding: '12px', border: '1px solid #ddd' }}>نطاق الأسئلة</th>
                <th style={{ padding: '12px', border: '1px solid #ddd' }}>الوزن النسبي / المتوسط</th>
                <th style={{ padding: '12px', border: '1px solid #ddd' }}>الترتيب</th>
              </tr>
            </thead>
            <tbody>
              {data.axes.map((axis, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                  <td style={{ padding: '12px', border: '1px solid #ddd', fontWeight: 'bold' }}>{axis.name}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>من {axis.start} إلى {axis.end}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center', color: '#1a237e', fontWeight: 'bold' }}>{axis.average}%</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>{axis.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
           <div style={{ textAlign: 'center', color: '#999', marginTop: '50px' }}>لا توجد محاور لهذا الاستبيان</div>
        )}
        <Footer signatures={data.signatures} />
      </div>

      {/* صفحة 6: مقارنة بين المحاور */}
      <div className="report-page bg-white mt-8" style={PAGE_STYLE}>
        <Header title={data.title} subtitle="مقارنة بين المحاور" logos={data.logos} />
        
        {data.axes && data.axes.length > 0 ? (
          <div style={{ marginTop: '40px', height: '400px', display: 'flex', justifyContent: 'center' }} dir="ltr">
            <BarChart width={650} height={400} data={data.axes.map(a => ({ name: a.name, average: a.average || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                interval={0} 
                angle={-45} 
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12, fill: '#1a237e' }}
              />
              <YAxis domain={[0, 100]} />
              <Bar dataKey="average" fill="#10b981" name="متوسط الوزن النسبي (%)" isAnimationActive={false} />
            </BarChart>
          </div>
        ) : (
           <div style={{ textAlign: 'center', color: '#999', marginTop: '50px' }}>لا توجد محاور لعرض المقارنة</div>
        )}

        <Footer signatures={data.signatures} />
      </div>

      {/* صفحة 7: الرسوم البيانية */}
      <div className="report-page bg-white mt-8" style={PAGE_STYLE}>
        <Header title={data.title} subtitle="الرسوم البيانية والمؤشرات" logos={data.logos} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', marginTop: '30px' }}>
          <div>
            <h3 style={{ color: '#1a237e', marginBottom: '20px', textAlign: 'center' }}>أعلى 10 أسئلة حسب الوزن النسبي</h3>
            <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }} dir="ltr">
              <BarChart width={650} height={300} data={top10Data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} />
                <Bar dataKey="weight" fill="#3b82f6" name="الوزن النسبي (%)" isAnimationActive={false} />
              </BarChart>
            </div>
          </div>

          <div>
            <h3 style={{ color: '#1a237e', marginBottom: '20px', textAlign: 'center' }}>توزيع الأوزان النسبية للأسئلة</h3>
            <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }} dir="ltr">
              <PieChart width={650} height={300}>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" isAnimationActive={false}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </div>
          </div>
        </div>

        <Footer signatures={data.signatures} />
      </div>

      {/* صفحة 8: التحليل النهائي والاستنتاجات */}
      <div className="report-page bg-white mt-8" style={PAGE_STYLE}>
        <Header title={data.title} subtitle="التحليل النهائي والاستنتاجات" logos={data.logos} />
        
        <div style={{ padding: '10px', lineHeight: '1.8', fontSize: '15px' }}>
          
          <div style={{ marginBottom: '20px', display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, padding: '20px', textAlign: 'center', border: '1px solid #1a237e' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#1a237e', fontSize: '18px' }}>المتوسط العام للاستبيان</h4>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1a237e' }}>{data.overallAverage}%</div>
            </div>
          </div>

          {bestAxis && worstAxis && (
            <div style={{ marginBottom: '25px', padding: '15px', border: '1px solid #1a237e' }}>
              <h4 style={{ color: '#1a237e', borderBottom: '2px solid #1a237e', paddingBottom: '5px', display: 'inline-block', marginBottom: '15px' }}>تحليل المحاور</h4>
              <ul style={{ margin: 0, paddingRight: '20px' }}>
                  <li style={{ marginBottom: '10px' }}>
                     <strong>أفضل محور أداءً:</strong> <span style={{ color: '#1a237e' }}>{bestAxis.name}</span> بمتوسط ({bestAxis.average}%)
                  </li>
                  <li>
                     <strong>المحور الأقل تقييماً:</strong> <span style={{ color: '#1a237e' }}>{worstAxis.name}</span> بمتوسط ({worstAxis.average}%)
                  </li>
              </ul>
            </div>
          )}

          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ color: '#1a237e', borderBottom: '2px solid #1a237e', paddingBottom: '5px', display: 'inline-block', marginBottom: '15px' }}>ملاحظات وتوصيات تفسيرية (تلقائية)</h4>
            <div style={{ padding: '15px', border: '1px solid #ccc' }} dangerouslySetInnerHTML={{ __html: cleanHtml(data.autoComment) }}></div>
          </div>

          {data.manualComment && (
            <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #1a237e' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1a237e' }}>إضافات وتوصيات (لجنة القياس والتقويم):</h4>
              <p style={{ whiteSpace: 'pre-line', margin: 0, fontSize: '16px' }}>{data.manualComment}</p>
            </div>
          )}
          
        </div>

        <Footer signatures={data.signatures} />
      </div>
      
      {/* صفحة 9 (أو أكثر): تعليقات وملاحظات المشاركين */}
      {data.comments && data.comments.length > 0 && (
        <div className="report-page bg-white mt-8" style={PAGE_STYLE}>
          <Header title={data.title} subtitle="تعليقات وملاحظات المشاركين" logos={data.logos} />
          
          <div style={{ padding: '10px', fontSize: '15px' }}>
            {data.comments.map((commentGroup, idx) => (
              <div key={idx} style={{ marginBottom: '25px', padding: '15px', border: '1px solid #1a237e', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#1a237e', fontSize: '18px', borderBottom: '2px solid #1a237e', paddingBottom: '5px', display: 'inline-block' }}>
                  {commentGroup.question}
                </h4>
                <ul style={{ margin: 0, paddingRight: '20px', listStyleType: 'disc' }}>
                  {commentGroup.answers.map((answer, aIdx) => (
                    <li key={aIdx} style={{ marginBottom: '8px', lineHeight: '1.6' }}>{answer}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Footer signatures={data.signatures} />
        </div>
      )}
    </div>
  );
}
