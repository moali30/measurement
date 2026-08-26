# Handoff — Fixed Likert Scale, Audit Layer, and Recommendation Engine

**Last updated:** 2026-08-26 (second pass)
**Repository:** `moali30/measurement`
**Branch:** `master`
**Supersedes:** the previous handoff for commit `5683d3d` (*Fix survey scoring and optimize analysis
report layout*). Several decisions in that document are deliberately reversed here — see §9.

---

## 1. What changed, in one paragraph

The previous work made the analysis engine *tolerant*: it inferred the measurement scale from the
data, promoted it when the data disagreed with the stored metadata, and documented the repair as a
warning. This release makes the engine *strict* instead. The scale is now a fixed five-point Likert
constant, inference and promotion are gone, and a mismatch stops the report with a message that
names the offending question. On top of that fixed base the release adds three new layers: a
normalised score with a real zero floor, an invariant auditor that can block printing, and a
recommendation engine that turns the numbers into assigned, measurable actions.

---

## 1b. Second pass — what the report shows

After reviewing the printed output, the report was cut back to what a quality committee
actually reads. The engine and its guarantees are unchanged; this pass is about presentation.

**Removed from the report:**

| Removed | Reason |
|---|---|
| the whole *methodology* section | it explained the engine to a reader who wants results |
| the *audit appendix* | the auditor still blocks a bad report; printing its scorecard added a page nobody acts on |
| the *top-N* and *bottom-N* ranked charts | they repeated the results table, which is already sorted and ranked |
| the *response histogram* | the same information, one level less specific than the distribution table |
| the *owner* and *timeframe* fields on every recommendation | they turned a recommendation into an improvement plan, which was not wanted |

The exclusion warnings that used to live in the methodology section moved to the top of the
results table, since they say which questions are *not* in that table.

**Simplified:**

- **The recommendation indicator is now the relative weight for every kind of finding.** Six
  different indicators (rejection share, alpha, gap in points) cannot be followed in practice;
  one measure that already appears next to every question can. Each recommendation is now four
  fields: priority · action · rationale · weight target.
- **The polarisation table lost its intensity ramp.** One flat tint per direction, the largest
  share in bold, no legend and no explanatory line. The three-level ramp asked the reader to
  decode two meanings at once — hue for direction, shade for size — while the number in the cell
  already stated the size.
- **The charts grid is a single column**, since only the performance donut remains.

**Fixed:** the *final analysis* section was clipped at page boundaries. `.print-narrative` was a
CSS grid, and Chromium clips grid items at a page break instead of moving them. It is block flow
now, and the two short boxes are marked atomic so they move whole.

### Section order after this pass

Cover → contents → executive summary → results → polarised questions → sample profile → axis
results → axis comparison → charts → group comparison → final analysis → recommendations →
participant comments.

### Consequences in code

`src/lib/analysis/charts.ts` was deleted with the ranked charts, along with
`getResponseHistogramData`, the `SHARE_BANDS` ramp, `THEMES[].owner`, and the audit's ranked-chart
checks — replaced by a donut-bucket check. The layout verifier and both `.cjs` verifiers were
updated to match; `LAYOUT_SABOTAGE=chart` is gone since there is no ranked chart to sabotage.

---

## 2. The scale decision (the core change)

### Why inference was removed

The number of points on a measurement scale is a property of **the instrument**, not of the
answers. Inferring it is guessing, and the previous guard was asymmetric:

- when the true scale was *larger* than assumed, the engine raised it and warned — visible;
- when the true scale was *smaller*, the engine silently computed on a five-point denominator and
  deflated every percentage by 40% — invisible.

Removing the guess removes the whole failure class.

### The rule now

> Only five-point Likert questions enter the quantitative analysis. Questions with two or three
> answers are demographic variables: they describe the sample and drive group comparison, and they
> never enter the overall mean.

Implemented in `src/lib/analysis/scale.ts` (`ANALYSIS_SCALE` = `{min: 1, max: 5, points: 5}`) and
enforced in `src/lib/analysis-utils.ts` (`collectErrors`).

### Two blocking errors

| Code | Trigger | Message names |
|---|---|---|
| `non-standard-likert` | a Likert question stored with a number of options other than five | the question, and the fix (edit the form) |
| `values-out-of-scale` | any numeric value outside 1–5 | the question, the count, the range, and how to exclude a non-Likert column |

`no-likert-questions` fires when nothing analysable remains.

A blocking error returns **no partial results**. A number computed on the wrong denominator looks
perfectly correct on the page, so a partial report is worse than none.

### Question routing

| Question type | Destination |
|---|---|
| `likert` | quantitative results, axes, overall mean |
| `radio` / `select` / `dropdown` / `multiple_choice` / `checkbox` / `yes_no` | sample profile + filtering + group comparison |
| `rating` / `linear_scale` / `number` / `date` / `file` / `matrix` | excluded, with a documented warning |
| `text` / `textarea` | comments |

Exclusion warnings print at the head of the results table.

For Excel imports there is no type metadata, so a text column with ≤ 12 distinct short values is
treated as demographic and anything longer as comments.

---

## 3. The normalised score

The relative weight divides by the maximum only, so on a 1–5 scale its floor is **20%, not zero**:
the worst possible rating reads 20% and total neutrality reads 60%. The normalised score measures
the distance from the real floor:

```text
normalised = (mean − 1) ÷ (5 − 1) × 100
           = relative weight × 1.25 − 25
```

| Mean | Meaning | Relative weight | Normalised |
|---|---|---|---|
| 1.0 | everyone chose the lowest option | 20% | 0 |
| 3.0 | everyone chose neutral | 60% | **50** |
| 4.0 | everyone chose "agree" | 80% | 75 |
| 5.0 | everyone chose the highest option | 100% | 100 |

**Decisions taken:**

- The **relative weight stays official** — grades, colours and ranking are all computed from it,
  because its thresholds sit on real Likert anchors (80% = "agree").
- The normalised score **replaced the standard-deviation column** in the results table. The
  deviation is still computed and exported to Excel; a number like `1.83` says nothing to a reader.
- The ranked charts that used it were removed in the second pass; the index now lives in the
  results table and the axis table.
- The transform is linear, so **ranking never changes** between the two measures.

**Precision trap found during verification:** the normalised score was first computed from the
*rounded* mean. Multiplying by the scale range amplifies the rounding error 25×, shifting the index
up to 0.13 points away from the weight printed beside it. It is now computed from `sum ÷ count`
directly (`analysis-utils.ts`, `buildQuestionResult`). Worst residual gap: 0.011.

---

## 4. Polarisation

Three completely different realities produce identical means, weights and normalised scores:

| Reality | Mean | Weight | Normalised | Std dev |
|---|---|---|---|---|
| everyone neutral | 3.00 | 60% | 50 | 0.00 |
| half reject, half agree | 3.00 | 60% | 50 | 2.11 |
| normal spread | 3.00 | 60% | 50 | 1.16 |

Removing the deviation column would have made the split invisible, so a dedicated section replaced
it. A question is polarised when **both ends reach 20%** of valid responses
(`POLARIZATION.endShare`). Rows are sorted by the *smaller* end, because the sharpest split is the
one where the two blocks are closest in size.

Each direction has one flat tint — red for rejection, amber for neutral, green for agreement — and
the largest of the three is bold. An earlier version varied the shade by size as well, which needed
a four-item legend and a line of explanation to read a six-column table; the number in the cell
already says how large the share is.

---

## 5. The audit layer (`src/lib/analysis/audit.ts`)

`auditReport(data)` checks **invariants, not results**. "The overall mean is 90%" is a result and
can be any number; "the distribution percentages sum to 100" is an invariant that must hold on any
data. A broken invariant means a calculation error, so it blocks the report.

Two severities: `error` blocks printing, `warning` prints as a note in the appendix.

**Errors** cover per-question consistency (scale, mean in range, the three-way agreement between
mean / weight / normalised score, `count + missing = respondents`, distribution sums, opinion
shares derived from the distribution itself), ranking (competition ranks consistent with weights, no
duplicate question numbers), aggregates, axes, comparison rows, the sample profile, the charts (no
question in both charts, every bar equal to its table value), and the recommendations.

**Warnings** cover sample size, response rate, axis alpha (low *and* suspiciously high), axes with
too few items, questions in more than one axis, and questions in none.

`getReportValidationErrors` in `report-helpers.ts` is now a thin wrapper over the auditor — the
duplicate rule set is gone, so the UI and the server can no longer disagree about validity.

The report prints an **audit appendix** stating how many checks ran, how many passed, and every
quality note.

---

## 6. The recommendation engine

Three separated layers:

```text
numbers → findings.ts (what kind of problem)
        → themes.ts   (which domain)
        → recommendations.ts (action, owner, timeframe, indicator, target)
```

### `findings.ts`

Nine finding kinds, each carrying its numeric `evidence`: critical weakness, weakness, polarisation,
negative tail, axis weakness, group gap, low reliability, low response, strength.

Polarisation and negative tail are only recorded **when the mean looks acceptable** (≥ 60%). Their
value is revealing what the mean hides; if the mean is already below the threshold the problem is
visible and a second finding is duplication.

### `themes.ts`

A normalised Arabic keyword lexicon (strips diacritics, unifies hamza forms and *tāʾ marbūṭa`)
classifies each question into one of ten domains. Axis name is weighted 3, question text 1, since
the designer chose the axis name deliberately to describe a domain. Ties are broken by lexicon
order, which is intentional and documented — the classifier must be deterministic so the report is
reproducible.

Without this layer every recommendation stays generic: the engine knows question 7 scored 62% but
not that it is about examinations.

### `recommendations.ts`

**One recommendation per domain**, each with four fields: priority · action · rationale · target.
The indicator is the relative weight for every finding kind, so the whole set is followed with one
measure that already appears beside every question in the results table.

Three constraints govern the design:

1. **Fully deterministic.** No language model in the path. An official report cannot have its
   recommendations change between two runs. Covered by a JSON-equality test.
2. **No number without a source.** Every number in the text comes from the finding's `evidence`;
   the auditor extracts every numeral from the text and requires a match in the evidence or in the
   declared thresholds. The allowed-constants list is **built from the constants themselves**, so
   changing a threshold cannot silently invalidate a correct recommendation.
3. **Per domain, not per question.** Five weak assessment items produce one recommendation naming
   them all.

Caps: ten recommendations, of which at most two may be strengths.

---

## 7. Files

### New

| File | Purpose |
|---|---|
| `src/lib/analysis/audit.ts` | invariant auditor, single source of validity |
| `src/lib/analysis/charts.ts` | ranked-chart split that cannot overlap |
| `src/lib/analysis/findings.ts` | evidence layer |
| `src/lib/analysis/themes.ts` | domain classifier |
| `src/lib/analysis/recommendations.ts` | recommendation engine |
| `vitest.config.ts` | test runner config (node environment, `@/` alias) |
| `tests/` | 158 tests across five suites |
| `scripts/load-ts.cjs` | shared TypeScript loader for the `.cjs` verifiers |
| `scripts/build-verification-report.cjs` | builds the verification payload **from the engine** |
| `scripts/verify-report-layout.cjs` | geometric layout and chart-rendering audit |

### Modified

`analysis-utils.ts` (engine rewritten), `analysis/scale.ts`, `analysis/statistics.ts`,
`types/analysis.ts`, `pdf/report-helpers.ts`, `pdf/report-layout.ts`, `AnalysisPrintDocument.tsx`,
`AnalysisReport.tsx`, `AnalysisForm.tsx`, `dashboard/analysis/page.tsx`, `analysis-export.ts`,
`styles/print.css`, and the two existing verify scripts.

---

## 8. Verification

```bash
npm test                # 158 tests, ~1.5s
npm run verify:analysis # engine reference report + 19 deliberate defects
npm run verify:layout   # 225 geometric checks (needs a server on :3000)
npm run verify:pdf      # builds → audits → renders a real PDF
```

### The negative test is the important one

An auditor that never fails does not prove the numbers are sound — it proves it checks nothing.
So every layer is tested by breaking it on purpose:

- `tests/audit.test.ts` corrupts 30 invariants individually and asserts the auditor names each one.
- `verify-analysis-engine.cjs` does the same with 19 defects against the print gate.
- `verify-report-layout.cjs` accepts `LAYOUT_SABOTAGE=weight|normalized|wide|reco`, which
  mutates **only the rendered copy** while keeping the reference intact. An early version mutated
  both, so they agreed on the error and no check caught it.

### Cross-source reconciliation

`tests/reconciliation.test.ts` analyses the same survey twice — once through the database path
(Arabic option labels plus type metadata) and once through the Excel path (bare numbers, no
metadata) — and requires field-by-field equality. The original 131% defect was born from these two
paths drifting apart. A second implementation of the statistics, written differently on purpose,
serves as an independent opinion.

### Layout auditing without pixel baselines

`verify-report-layout.cjs` measures geometry rather than comparing screenshots. Arabic font
rasterisation differs between machines, so pixel baselines fail for no real reason and, when they
do fail, say only "something differs". Geometry says *what* and *where*: no horizontal overflow, no
clipped cell, complete table grids (with `rowSpan` simulation), bar heights proportional to values,
every printed number equal to the payload, and the appendix counts equal to the auditor's.

### Real data

The 64-response survey in the repository root: 49 items, overall 90.47%, normalised 88.08,
alpha 0.95, 999 checks, zero errors. Question-level numbers were confirmed against an independent
calculation outside the engine (Q1: sum 287, mean 4.48, weight 89.69%, normalised 87.11).

---

## 9. Decisions that reverse the previous handoff

The earlier document asked to keep certain behaviours. They are intentionally gone:

| Previously | Now | Why |
|---|---|---|
| infer the scale, promote it when data exceeds it, warn | fixed 1–5, blocking error on mismatch | the scale is a property of the instrument; a warning inside a report nobody reads is not a guard |
| keep per-question scale min/max through every path | single constant | there is only one scale now |
| yes/no questions in their own results section | demographic variable in the sample profile | a two-answer question is not a Likert item |
| `scaleMaxOverride` in the analysis UI | removed; old saved settings ignore the field | it existed to work around inference |

Still valid from the previous handoff: never clamp a weight with `Math.min(weight, 100)`; keep
validation at the API boundary; treat pagination as measured content flow; `src/lib/pdf/config.ts`
remains the single source for margins and the 241 mm printable-body assumption in `report-layout.ts`.

---

## 10. Maintenance rules

- **Never infer the scale again.** If a survey genuinely uses a different scale, declare it — do not
  derive it from answers.
- **Never add a number to a recommendation that is not in its evidence.** The auditor will block it,
  and that is the intended behaviour.
- **Keep the recommendation engine deterministic.** If a language model is added later, it may only
  *phrase*, never decide, and every number it emits must be validated against the findings.
- **Keep the sabotage modes working.** If a check stops failing under its sabotage, the check is
  dead.
- **Thresholds live in `scale.ts`.** `findings.ts` and `recommendations.ts` read from it, and
  `audit.ts` builds its allowed-numbers list from the same constants. Moving a threshold elsewhere
  reintroduces the import cycle that was removed.
- When adding a printed field, extend the clipping check in `verify-report-layout.cjs`. Check width
  only: line-box rounding inflates `scrollHeight` by ~2px on every cell.

---

## 11. Known follow-up work

No blocking defect in the delivered scope. Optional next steps:

- **Optional LLM phrasing layer** (`src/app/actions/ai.ts` already has Mistral wired). Assessment:
  not needed. It would trade determinism and the number guarantee for a limited stylistic gain.
- Update `docs/ANALYSIS-ENGINE.md`, which still describes the old inference rules.
- Run one production PDF smoke test after deployment; local verification cannot reproduce the
  hosted Chromium environment.
- Pre-existing lint errors in the older `scripts/check-*.ts` and `scripts/migrate-*.ts` files are
  untouched and outside `npm run lint`.
