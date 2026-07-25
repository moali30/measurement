export type PageSize = 'A4' | 'Letter';

export const PDF_CONFIG = {
  defaultPageSize: 'A4' as PageSize,
  margins: {
    top: 20,
    bottom: 22,
    left: 18,
    right: 18,
  },
  minBodyFontPt: 9,
  tokenTtlMs: 5 * 60 * 1000,
  metadata: {
    author: 'لجنة القياس والتقويم',
    subject: 'تقرير تحليل استبيان',
  },
  buildFilename(title: string, reportDate: string) {
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'تحليل_الاستبيان';
    const safeDate = reportDate.replace(/[\\/:*?"<>|]/g, '-');
    return `تقرير_${safeTitle}_${safeDate}.pdf`;
  },
} as const;
