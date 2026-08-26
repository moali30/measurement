/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * تحقق طرف-إلى-طرف: يبني حمولة من المحرك، يدققها، ثم يطلب من الـ API طباعتها.
 * `npm run verify:pdf -- http://127.0.0.1:3000 tmp/pdfs/analysis-verification.pdf`
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadTypeScriptModule } = require('./load-ts.cjs');
const { buildVerificationReport } = require('./build-verification-report.cjs');

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const output = path.resolve(process.argv[3] || 'tmp/pdfs/analysis-verification.pdf');

const { auditReport, formatAuditIssue } = loadTypeScriptModule('src/lib/analysis/audit.ts');

(async () => {
  const report = buildVerificationReport();

  // ندقّق قبل الإرسال: فشل الـ API بعدها يعني خللاً في الطباعة لا في الأرقام
  const audit = auditReport(report);
  if (audit.errors.length > 0) {
    throw new Error(
      `حمولة التحقق نفسها مكسورة:\n  ${audit.errors.map(formatAuditIssue).join('\n  ')}`
    );
  }
  console.log(
    `الحمولة: ${report.results.length} بنداً · ${report.totalRespondents} مشاركاً · ` +
      `${audit.checks} فحصاً · ${audit.warnings.length} ملاحظة`
  );

  const response = await fetch(`${baseUrl}/api/reports/analysis`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes);
  console.log(`PDF verification generated: ${output} (${bytes.length} bytes)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
