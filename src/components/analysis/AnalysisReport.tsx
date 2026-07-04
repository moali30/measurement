'use client';

import React from 'react';
import { ReportData } from '@/types/analysis';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnalysisReportProps {
  data: ReportData;
}

const COLORS = ['#4caf50', '#ffc107', '#f44336'];

export default function AnalysisReport({ data }: AnalysisReportProps) {
  if (!data.results || data.results.length === 0) return null;

  const top10 = data.resultsForAnalysis.slice(0, 10).map(item => ({
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

  const axesChartData = data.axes.map(axis => ({
    name: axis.name,
    average: axis.average || 0
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
              <th className="p-3 border border-gray-200 dark:border-gray-700">الوزن النسبي (%)</th>
              <th className="p-3 border border-gray-200 dark:border-gray-700">الترتيب</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((item) => (
              <tr key={item.questionNumber} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="p-3 border border-gray-200 dark:border-gray-700">{item.questionNumber}</td>
                <td className="p-3 border border-gray-200 dark:border-gray-700">{item.question}</td>
                <td className="p-3 border border-gray-200 dark:border-gray-700">{item.count}</td>
                <td className="p-3 border border-gray-200 dark:border-gray-700">{item.mean}</td>
                <td className="p-3 border border-gray-200 dark:border-gray-700">{item.relativeWeight}%</td>
                <td className="p-3 border border-gray-200 dark:border-gray-700">{item.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 font-bold text-gray-800 dark:text-gray-200">المتوسط العام: {data.overallAverage}%</div>
      </div>

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
                <th className="p-3 border border-gray-200 dark:border-gray-700">المتوسط (%)</th>
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
          <h4 className="font-bold mb-4 text-center">أعلى 10 أسئلة حسب الوزن النسبي</h4>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis domain={[0, 100]} />
                <RechartsTooltip />
                <Bar dataKey="weight" fill="#3b82f6" name="الوزن النسبي (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

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
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-2">
            <h4 className="font-bold mb-4 text-center">مقارنة بين المحاور</h4>
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
                  <Bar dataKey="average" fill="#10b981" name="متوسط الوزن النسبي (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}
