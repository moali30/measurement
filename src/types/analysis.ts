export interface Axis {
  name: string;
  start: number;
  end: number;
  average?: number;
  count?: number;
  rank?: number;
}

export interface QuestionResult {
  question: string;
  questionNumber: number;
  count: number;
  mean: number;
  relativeWeight: number;
  rank?: number;
}

export interface ReportData {
  title: string;
  surveyDate: string;
  reportDate: string;
  results: QuestionResult[];
  resultsForAnalysis: QuestionResult[];
  overallAverage: number;
  axes: Axis[];
  autoComment: string;
  manualComment: string;
  logos: {
    quality: string;
    university: string;
    college: string;
  };
  signatures: {name: string, url: string}[];
  comments?: {question: string, answers: string[]}[];
}
