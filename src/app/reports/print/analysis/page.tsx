import { notFound } from 'next/navigation';
import AnalysisPrintDocument from '@/components/pdf/AnalysisPrintDocument';
import { getReportTokenData } from '@/lib/pdf/token-store';

export const dynamic = 'force-dynamic';

export default function AnalysisPrintPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;
  if (!token) notFound();

  const data = getReportTokenData(token);
  if (!data) notFound();

  return <AnalysisPrintDocument data={data} />;
}
