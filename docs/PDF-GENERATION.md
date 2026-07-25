# PDF Generation System

Analysis reports are exported via a **server-side Playwright print pipeline** (vector text + SVG charts), not html2canvas screenshots.

## Flow

1. Dashboard calls `POST /api/reports/analysis` with `ReportData` JSON.
2. API stores data in a short-lived token and opens `/reports/print/analysis?token=…` in headless Chromium.
3. Playwright waits for `[data-print-ready="true"]`, then calls `page.pdf()` with A4 margins.
4. PDF bytes are returned to the browser for download.

## Key files

| Path | Purpose |
|---|---|
| `src/lib/pdf/config.ts` | Page size, margins, filename/metadata defaults |
| `src/lib/pdf/generate-analysis-pdf.ts` | Playwright orchestration |
| `src/components/pdf/AnalysisPrintDocument.tsx` | Print-only React template |
| `src/styles/print.css` | Pagination, RTL, table header repeat, break rules |
| `src/app/reports/print/analysis/page.tsx` | Internal print route (token-gated) |

## Adding a new report section

1. Add a `<section className="print-section">` block in `AnalysisPrintDocument.tsx`.
2. Wrap charts/KPI blocks with `print-chart-block` (uses `break-inside: avoid`).
3. Use `print-table` for tables so `<thead>` repeats across pages.
4. Reuse `PrintHeader` / `PrintFooter` for consistent branding.

## Configuration

Edit `PDF_CONFIG` in `src/lib/pdf/config.ts`:

- `defaultPageSize`: `'A4'` or `'Letter'`
- `margins`: top/bottom/left/right in mm
- `buildFilename()`: exported file naming

## Local requirements

- Run `npx playwright install chromium` once after `npm install`.
- Set `NEXT_PUBLIC_BASE_URL` (defaults to `http://localhost:3000`) so the PDF worker can reach the print route.

## Preview vs export

- **Preview modal** still uses `ReportPrintableView` → `AnalysisPrintDocument preview`.
- **Export** uses the API route only; the interactive `AnalysisReport` dashboard is unchanged.
