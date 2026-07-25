import { ReportData } from '@/types/analysis';
import { PDF_CONFIG } from './config';

interface StoredReport {
  data: ReportData;
  expiresAt: number;
}

const store = new Map<string, StoredReport>();

function purgeExpired() {
  const now = Date.now();
  Array.from(store.entries()).forEach(([token, entry]) => {
    if (entry.expiresAt <= now) {
      store.delete(token);
    }
  });
}

export function createReportToken(data: ReportData): string {
  purgeExpired();
  const token = crypto.randomUUID();
  store.set(token, {
    data,
    expiresAt: Date.now() + PDF_CONFIG.tokenTtlMs,
  });
  return token;
}

export function getReportTokenData(token: string): ReportData | null {
  purgeExpired();
  const entry = store.get(token);
  if (!entry || entry.expiresAt <= Date.now()) {
    store.delete(token);
    return null;
  }
  return entry.data;
}

export function deleteReportToken(token: string) {
  store.delete(token);
}
