# Survey Analysis Engine

The analysis engine is separated from report rendering. Pure calculations live under
`src/lib/analysis/`; `src/lib/analysis-utils.ts` parses rows, applies survey metadata, and assembles
`ReportData`.

## Input rules

- Empty and non-numeric answers are excluded per question and counted as missing.
- Text Likert answers use the option order stored with the question when available. The first option
  receives the highest score and the last receives 1.
- Uploaded files without question metadata use the built-in Arabic Likert map and automatic scale
  detection. The user can override the whole file with a 3, 4, 5, 7, or 10 point scale.
- Yes/no questions are detected from their original labels, reported separately, and excluded from
  the overall average.
- Reverse-coded questions are transformed with `min + max - value` before any statistic is computed.

## Question numbering and axes

Database question order can be zero-based or one-based. The analysis form normalizes it to visible
numbers starting at 1. Automatically created axes carry an exact `questionNumbers` membership list;
their averages do not rely on a broad numeric range that may include demographic questions.

Manually edited axis ranges remain supported for uploaded files. Changing an axis start or end
explicitly clears its exact membership list and switches that axis to range mode.

## Statistics

Each quantitative question includes:

- valid count, missing count, and response rate;
- mean, sample standard deviation, median, and mode;
- relative weight using `sum / (valid count * question scale maximum) * 100`;
- frequency and percentage for every response level;
- competitive rank and a textual grade.

The overall average is the arithmetic mean of non-binary question relative weights.

## Cronbach's alpha

Cronbach's alpha is calculated for all non-binary questions and separately for every axis. The
implementation uses complete-case rows within the item group so item variances and total-score
variance use the same respondents.

No alpha is reported when:

- the group has fewer than two items;
- fewer than two complete responses remain; or
- total-score variance is zero.

## Comparisons

One categorical column can be selected for group comparison. The report computes the overall
average and each axis average for every category, using the same question scales and reverse-coding
rules as the full sample.

## Verification

`npm run verify:analysis` runs deterministic checks for descriptive statistics, scale detection,
reverse coding, relative weight, Cronbach's alpha, comment aggregation, exact axis membership,
binary separation, and category comparison.
