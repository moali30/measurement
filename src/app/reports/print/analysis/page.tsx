'use client';
import { useEffect, useState } from 'react';
import AnalysisPrintDocument from '@/components/pdf/AnalysisPrintDocument';
import { ReportData } from '@/types/analysis';

declare global {
  interface Window {
    __PRINT_DATA__?: ReportData;
  }
}

export default function AnalysisPrintPage() {
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const checkData = () => {
      if (typeof window !== 'undefined' && window.__PRINT_DATA__) {
        setData(window.__PRINT_DATA__);
        return true;
      }
      return false;
    };

    if (!checkData()) {
      const interval = setInterval(() => {
        if (checkData()) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }
  }, []);

  if (!data) {
    return <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>جاري تجهيز التقرير...</div>;
  }

  return <AnalysisPrintDocument data={data} />;
}
