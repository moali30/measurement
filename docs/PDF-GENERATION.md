# PDF Generation System

Analysis reports are exported via a **server-side Playwright print pipeline** (vector text + SVG charts), not html2canvas screenshots. Arabic text in the output stays selectable and searchable.

## Flow

1. `/dashboard/analysis` serializes `ReportData` and `POST`s it to `/api/reports/analysis`.
   The client rejects payloads over 4MB first — logos are base64 data URLs and Vercel caps
   the request body around 4.5MB.
2. The route launches headless Chromium and injects the report data into the page via
   `page.addInitScript` as `window.__PRINT_DATA__`, then navigates to `/reports/print/analysis`.
3. Playwright waits for `[data-print-ready="true"]`, then calls `page.pdf()`.
4. PDF bytes are streamed back to the browser as a download.

> There is **no token store**. An earlier design passed a short-lived token in the URL; it was
> replaced by direct injection because in-memory tokens cannot survive across serverless
> invocations. `src/lib/pdf/token-store.ts` has been deleted — don't reintroduce it.

## Key files

| Path | Purpose |
|---|---|
| `src/lib/pdf/config.ts` | Page size, **margins (single source of truth)**, filename/metadata |
| `src/lib/pdf/generate-analysis-pdf.ts` | Playwright orchestration + Chromium resolution |
| `src/components/pdf/AnalysisPrintDocument.tsx` | Print-only React template |
| `src/styles/print.css` | Pagination, RTL, table header repeat, break rules |
| `src/app/reports/print/analysis/page.tsx` | Internal print route, reads `window.__PRINT_DATA__` |
| `src/lib/image-utils.ts` | Client-side logo downscaling before upload |

## Margins — one source only

`PDF_CONFIG.margins` (mm) is consumed by `page.pdf()` through `PDF_CONFIG.playwrightMargins()`.

`print.css` declares `@page { size: A4 portrait; }` and **deliberately no `margin`**. Declaring
margins in both places made the effective result depend on how Chromium resolved
`preferCSSPageSize` against the API margins — a recurring source of "the margins changed and
nobody touched them". Change margins in `config.ts` only.

## Chromium resolution

`@sparticuz/chromium` bundles the browser binary in `bin/chromium.br`, so
`chromium.executablePath()` is called **with no argument** — the extracted binary always matches
the installed package version and cannot drift.

Set `CHROMIUM_PACK_URL` to fetch a remote pack tarball instead, only if the deployment bundle
size becomes a problem. Do not hardcode a version URL in the source; that is exactly what caused
the previous v131-vs-v149 mismatch.

## Timeouts

`maxDuration` in `src/app/api/reports/analysis/route.ts` is `60` — the Vercel Hobby ceiling.
Next.js reads route segment config at build time, so it **must be a literal**; an env var or
computed expression is silently ignored. On Pro, edit the number to `300`.

The route translates Playwright's raw errors into Arabic messages for timeouts and browser
launch failures; everything else passes through.

## Adding a new report section

1. Add a `<section className="print-section">` block in `AnalysisPrintDocument.tsx`.
2. Wrap charts/KPI blocks with `print-chart-block` (uses `break-inside: avoid`).
3. Use `print-table` for tables so `<thead>` repeats across pages.
4. Reuse `PrintFooter` for consistent branding.

## Local requirements

- Run `npx playwright install chromium` once after `npm install`.
- Set `NEXT_PUBLIC_BASE_URL` (defaults to `http://localhost:3000`) so the PDF worker can reach
  the print route.

## Preview vs export

- **Preview** calls the same API route used by export, then displays the returned PDF blob in the
  browser PDF viewer. Page navigation and zoom therefore reflect the real PDF, not an approximate
  scaled React preview.
- **Export** reuses the preview blob when available so Chromium is not launched twice for the same
  report.
- **Direct print** invokes the print dialog for the generated PDF, not a separate DOM print path.

## Local production testing

`next start` uses Playwright's locally installed Chromium. The Sparticuz binary is selected only
when the `VERCEL` environment flag is present; treating every production build as serverless breaks
local production testing on Windows and macOS.

Run:

```text
npx playwright install chromium
npm run build
npm start
npm run verify:pdf
```

The verification script writes `analysis-verification.pdf` for visual QA. Move it under `tmp/pdfs/`
when retaining rendered pages or contact sheets.
