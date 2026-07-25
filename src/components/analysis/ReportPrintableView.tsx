'use client';

import AnalysisPrintDocument from '@/components/pdf/AnalysisPrintDocument';
import { ReportData } from '@/types/analysis';

interface ReportPrintableViewProps {
  data: ReportData;
}

/** @deprecated Use AnalysisPrintDocument directly. Kept for preview modal compatibility. */
export default function ReportPrintableView({ data }: ReportPrintableViewProps) {
  return <AnalysisPrintDocument data={data} preview />;
}
