import { Axis, QuestionResult, ReportData } from '../types/analysis';

export function processData(data: Record<string, unknown>[], currentAxes: Axis[], questionTypes?: Record<string, string>): Pick<ReportData, 'results' | 'resultsForAnalysis' | 'overallAverage' | 'axes' | 'autoComment' | 'comments'> {
  if (!data || data.length === 0) {
    return {
      results: [],
      resultsForAnalysis: [],
      overallAverage: 0,
      axes: currentAxes,
      autoComment: generateAutoComment([], 0, currentAxes),
      comments: []
    };
  }

  const questions = Object.keys(data[0] || {});
  const results: QuestionResult[] = [];
  const comments: {question: string, answers: string[]}[] = [];

  questions.forEach((question, index) => {
    const qType = questionTypes ? questionTypes[question] : undefined;
    
    // Skip completely if we know it's a structural or filtering question (radio, select, etc)
    if (qType && ['radio', 'select', 'dropdown', 'checkbox'].includes(qType)) {
       return;
    }

    const answers: number[] = [];
    const textAnswers: string[] = [];

    data.forEach(row => {
      const val = row[question];
      if (val === undefined || val === null || val === '') return;
      if (typeof val === 'string') {
        const cleanVal = val.trim();
        if (!cleanVal) return;
        
        const likertMap: Record<string, number> = {
          "موافق جداً": 5, "موافق جدا": 5,
          "موافق": 4,
          "محايد": 3, "إلى حد ما": 3,
          "غير موافق": 2,
          "غير موافق جداً": 1, "غير موافق جدا": 1,
          "ممتاز": 5,
          "جيد جداً": 4, "جيد جدا": 4,
          "جيد": 3,
          "مقبول": 2,
          "ضعيف": 1,
          "دائماً": 5, "دائما": 5,
          "غالباً": 4, "غالبا": 4,
          "أحياناً": 3, "أحيانا": 3,
          "نادراً": 2, "نادرا": 2,
          "أبداً": 1, "أبدا": 1,
          "نعم": 5,
          "لا": 1
        };
        
        // If it's explicitly a text/textarea question, force it to comments
        if (qType === 'text' || qType === 'textarea') {
           textAnswers.push(cleanVal);
        } else if (likertMap[cleanVal]) {
           answers.push(likertMap[cleanVal]);
        } else {
           const num = parseFloat(cleanVal);
           if (!isNaN(num)) {
             answers.push(num);
           } else {
             textAnswers.push(cleanVal);
           }
        }
      } else if (typeof val === 'number') {
        if (qType === 'text' || qType === 'textarea') {
           textAnswers.push(val.toString());
        } else {
           answers.push(val);
        }
      }
    });

    if (answers.length > 0) {
      const sum = answers.reduce((a, b) => a + b, 0);
      const count = answers.length;
      const mean = count > 0 ? sum / count : 0;
      const relativeWeight = count > 0 ? (sum / (count * 5)) * 100 : 0;
  
      let questionNumber = index + 1;
      const numberMatch = question.match(/^(\d+)[.)\s]/);
      if (numberMatch) {
        questionNumber = parseInt(numberMatch[1], 10);
      }
  
      results.push({
        question,
        questionNumber,
        count,
        mean: parseFloat(mean.toFixed(2)),
        relativeWeight: parseFloat(relativeWeight.toFixed(2))
      });
    } else if (textAnswers.length > 0) {
      comments.push({
        question,
        answers: textAnswers
      });
    }
  });

  results.sort((a, b) => a.questionNumber - b.questionNumber);

  const resultsForAnalysis = [...results].sort((a, b) => b.relativeWeight - a.relativeWeight);

  let currentRank = 1;
  resultsForAnalysis.forEach((item, index) => {
    if (index > 0 && item.relativeWeight < resultsForAnalysis[index - 1].relativeWeight) {
      currentRank = index + 1;
    }
    item.rank = currentRank;
  });

  const totalRelativeWeight = results.reduce((sum, item) => sum + item.relativeWeight, 0);
  const overallAverage = parseFloat((results.length > 0 ? totalRelativeWeight / results.length : 0).toFixed(2));

  let processedAxes = [...currentAxes];
  if (processedAxes.length > 0) {
    processedAxes = processAxesAverages(results, processedAxes);
  }

  const autoComment = generateAutoComment(resultsForAnalysis, overallAverage, processedAxes);

  return {
    results,
    resultsForAnalysis,
    overallAverage,
    axes: processedAxes,
    autoComment,
    comments
  };
}

export function processAxesAverages(results: QuestionResult[], axes: Axis[]): Axis[] {
  const newAxes = axes.map(axis => {
    const axisQuestions = results.filter(item => item.questionNumber >= axis.start && item.questionNumber <= axis.end);
    const totalWeight = axisQuestions.reduce((sum, item) => sum + item.relativeWeight, 0);
    const average = parseFloat((axisQuestions.length > 0 ? totalWeight / axisQuestions.length : 0).toFixed(2));
    return { ...axis, average, count: axisQuestions.length };
  });

  newAxes.sort((a, b) => (b.average || 0) - (a.average || 0));

  let currentRank = 1;
  newAxes.forEach((axis, index) => {
    if (index > 0 && (axis.average || 0) < (newAxes[index - 1].average || 0)) {
      currentRank = index + 1;
    }
    axis.rank = currentRank;
  });

  return newAxes;
}

export function generateAxisComment(average: number): string {
  if (average >= 90) return "يظهر أداء استثنائي ومتفوق يتجاوز التوقعات";
  if (average >= 80) return "يظهر أداء متميز وجيد جداً";
  if (average >= 70) return "يظهر أداء جيد ولكن هناك مجال للتحسين";
  if (average >= 60) return "يظهر أداء مقبول ولكن يحتاج إلى تحسين";
  return "يظهر أداء أقل من المطلوب ويحتاج إلى تحسين عاجل";
}

export function generateAutoComment(results: QuestionResult[], average: number, axes: Axis[]): string {
  if (!results || results.length === 0) {
    return `
      <div class="detailed-analysis bg-green-50/50 border-r-4 border-green-700 p-4 rounded-xl my-4 text-gray-800 dark:text-gray-200 dark:bg-green-900/20">
        <h4 class="font-bold mb-2">تحليل النتائج</h4>
        <p>لم يتم العثور على بيانات أسئلة صالحة للتحليل. يرجى التأكد من أن الملف يحتوي على بيانات.</p>
      </div>`;
  }

  const highest = results[0];
  const lowest = results[results.length - 1];
  const strengths = results.filter(r => r.relativeWeight >= 85).map(r => r.questionNumber);
  const weaknesses = results.filter(r => r.relativeWeight < 70).map(r => r.questionNumber);

  const perfComment = average >= 85 ? 'أداء متميز' : average >= 70 ? 'أداء جيد' : 'أداء يحتاج إلى تحسين';

  let comment = `
    <div class="detailed-analysis bg-green-50/50 border-r-4 border-green-700 p-4 rounded-xl my-4 text-gray-800 dark:text-gray-200 dark:bg-green-900/20">
      <h4 class="font-bold mb-2">تحليل النتائج</h4>
      <p>بلغ المتوسط العام ${average}% مما يشير إلى ${perfComment}.</p>
      <p>أعلى سؤال تقييماً هو "${highest.question}" (رقم ${highest.questionNumber}) بنسبة ${highest.relativeWeight}%.</p>
      <p>أقل سؤال تقييماً هو "${lowest.question}" (رقم ${lowest.questionNumber}) بنسبة ${lowest.relativeWeight}%.</p>`;

  if (strengths.length > 0) {
    comment += `<p><b>نقاط القوة (أعلى من 85%):</b> الأسئلة ${strengths.slice(0, 5).join(', ')}.</p>`;
  }
  if (weaknesses.length > 0) {
    comment += `<p><b>نقاط تحتاج لتحسين (أقل من 70%):</b> الأسئلة ${weaknesses.slice(0, 5).join(', ')}.</p>`;
  }

  if (axes.length > 0 && axes[0].average !== undefined) {
    const highestAxis = axes[0];
    const lowestAxis = axes[axes.length - 1];

    comment += `
      </div>
      <div class="detailed-analysis bg-indigo-50/50 border-r-4 border-indigo-700 p-4 rounded-xl my-4 text-gray-800 dark:text-gray-200 dark:bg-indigo-900/20">
        <h4 class="font-bold mb-2">تحليل مفصل للمحاور</h4>
        <p>بناءً على تحليل المحاور المحددة، تظهر النتائج التالية لأعلى محور وأقل محور:</p>

        <div class="flex justify-between my-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
          <div>
            <strong>${highestAxis.name}</strong>
            <div>متوسط الوزن النسبي: ${highestAxis.average?.toFixed(2)}%</div>
          </div>
          <div>الترتيب: ${highestAxis.rank}</div>
        </div>

        <div class="flex justify-between my-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
          <div>
            <strong>${lowestAxis.name}</strong>
            <div>متوسط الوزن النسبي: ${lowestAxis.average?.toFixed(2)}%</div>
          </div>
          <div>الترتيب: ${lowestAxis.rank}</div>
        </div>

        <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border-r-4 border-indigo-900 shadow-sm mt-4">
          <h5 class="font-bold mb-2">ملاحظات على المحاور:</h5>
          <p>محور "${highestAxis.name}" ${generateAxisComment(highestAxis.average || 0)}.</p>
          <p>محور "${lowestAxis.name}" ${generateAxisComment(lowestAxis.average || 0)}.</p>
        </div>
      </div>`;
  }

  // Recommendations based on weaknesses
  if (weaknesses.length > 0) {
     comment += `
      <div class="detailed-analysis bg-blue-50/50 border-r-4 border-blue-700 p-4 rounded-xl my-4 text-gray-800 dark:text-gray-200 dark:bg-blue-900/20">
        <h4 class="font-bold mb-2 text-blue-800 dark:text-blue-400">التوصيات وخطة التحسين المبدئية</h4>
        <p class="mb-2">بناءً على النتائج التي حصلت على تقييم أقل من 70%، نوصي بالآتي:</p>
        <ul class="list-disc list-inside space-y-1">
          ${results.filter(r => r.relativeWeight < 70).slice(0, 5).map(r => `<li>مراجعة الأسباب المؤدية لتدني تقييم <strong>"${r.question}"</strong> (نسبة ${r.relativeWeight}%) ووضع خطة تصحيحية فورية.</li>`).join('')}
        </ul>
      </div>`;
  }

  return comment;
}
