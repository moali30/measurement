/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * يبني حمولة تقرير تحقق من المحرك نفسه، لا بأرقام مكتوبة يدوياً.
 *
 * الحمولة اليدوية السابقة كانت تتقادم مع كل تغيير في المحرك: حقول تُضاف فلا
 * توجد فيها، وقواعد تُشدَّد فترفضها بوابة الطباعة، فيفشل التحقق بسبب الحمولة
 * لا بسبب التطبيق. البناء من `processData` يضمن أن الحمولة متسقة دائماً.
 */
const { loadTypeScriptModule } = require('./load-ts.cjs');

const analysis = loadTypeScriptModule('src/lib/analysis-utils.ts');

const LABELS = ['موافق جداً', 'موافق', 'محايد', 'غير موافق', 'غير موافق جداً'];
const VALUE_MAP = Object.fromEntries(LABELS.map((label, index) => [label, 5 - index]));

/** أنماط توزيع متنوعة عمداً: ممتاز، منقسم، ضعيف، مُجمَع عليه */
const PATTERNS = [
  [11, 6, 2, 1, 0],
  [3, 4, 3, 5, 5],
  [7, 3, 1, 4, 5],
  [2, 3, 3, 6, 6],
  [12, 5, 2, 1, 0],
  [6, 3, 2, 4, 5],
  [5, 5, 4, 3, 3],
  [8, 6, 3, 2, 1],
];

const AXIS_NAMES = [
  'القيادة والإدارة',
  'التخطيط وإدارة أنشطة الجودة',
  'نشر ثقافة الجودة وبناء القدرات',
  'التواصل والعمل الجماعي',
  'إدارة الوثائق والتقارير',
  'المتابعة والتطوير المستمر',
  'التقييم العام',
];

const QUESTIONS_PER_AXIS = 4;
const QUESTION_COUNT = AXIS_NAMES.length * QUESTIONS_PER_AXIS;

function svgDataUrl(label, color) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="72">` +
    `<rect width="180" height="72" rx="8" fill="${color}"/>` +
    `<text x="90" y="45" text-anchor="middle" font-family="Arial" font-size="22" fill="white">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * نصوص واقعية تغطي المجالات المختلفة.
 *
 * تكرار نص واحد على كل البنود كان يجعل مصنِّف المجالات يرى الكلمات نفسها في
 * كل سؤال، فتخرج التوصيات مصنَّفة عشوائياً ولا يمثّل التحقق ما يراه المستخدم.
 */
const QUESTION_TEXTS = [
  'أهداف المقرر ومخرجات التعلم معلنة وواضحة للطلاب منذ بداية الفصل',
  'محتوى المقرر يواكب متطلبات سوق العمل ويتضمن تطبيقات عملية كافية',
  'مفردات المقرر متوازنة مع عدد الساعات المخصصة له',
  'توصيف المقرر متاح ومحدَّث على المنصة الإلكترونية',
  'أعضاء هيئة التدريس يستخدمون أساليب شرح متنوعة تراعي الفروق الفردية',
  'المحاضرات تتيح مساحة كافية للمناقشة والتفاعل',
  'يوصل المحاضر المعلومة بلغة واضحة ومنظمة',
  'الوسائل التعليمية المستخدمة في المحاضرات مناسبة وحديثة',
  'معايير تقييم الطلاب في الامتحانات معلنة وعادلة',
  'أسئلة الامتحانات تقيس مخرجات التعلم المستهدفة',
  'تُعلن نتائج الامتحانات في الموعد المحدد',
  'توزيع الدرجات بين التقويم المستمر والامتحان النهائي متوازن',
  'المكتبة توفر المراجع العلمية المطلوبة لكل مقرر',
  'مصادر التعلم الرقمية وقواعد البيانات متاحة وسهلة الوصول',
  'الموارد التعليمية المتاحة كافية لعدد الطلاب',
  'الدوريات العلمية المتوفرة حديثة ومناسبة للتخصص',
  'المعامل مجهزة بالأجهزة اللازمة لتنفيذ التطبيقات العملية',
  'القاعات الدراسية مناسبة من حيث الإضاءة والتهوية والمقاعد',
  'شبكة الإنترنت داخل الكلية تكفي احتياجات الدراسة',
  'مرافق الكلية نظيفة وصالحة للاستخدام',
  'الإرشاد الأكاديمي متاح ويقدم دعماً فعلياً للطلاب',
  'الأنشطة الطلابية متنوعة وتلبي اهتمامات الطلاب',
  'تُعالج شكاوى الطلاب في وقت مناسب',
  'يوجد دعم واضح للطلاب المتعثرين دراسياً',
  'إجراءات شؤون الطلاب واضحة وسريعة الإنجاز',
  'الجداول الدراسية تُعلن في وقت مناسب قبل بدء الفصل',
  'المعلومات عن البرنامج متاحة ودقيقة في دليل الطالب',
  'جدية الإشراف والمتابعة لبرامج التدريب الميداني',
];

function questionKey(index) {
  return `${index + 1}. ${QUESTION_TEXTS[index % QUESTION_TEXTS.length]}`;
}

function choiceFor(counts, person) {
  let remaining = person;
  for (let level = 0; level < counts.length; level += 1) {
    if (remaining < counts[level]) return LABELS[level];
    remaining -= counts[level];
  }
  return LABELS[LABELS.length - 1];
}

function buildVerificationReport() {
  const respondents = PATTERNS[0].reduce((sum, count) => sum + count, 0);
  const genderKey = `${QUESTION_COUNT + 1}. النوع`;
  const recommendKey = `${QUESTION_COUNT + 2}. هل توصي بالبرنامج؟`;
  const notesKey = `${QUESTION_COUNT + 3}. ما أهم مقترحات التحسين؟`;

  const suggestions = [
    'زيادة التطبيقات العملية داخل المقررات.',
    'تطوير التجهيزات داخل المعامل.',
    'توضيح مسؤوليات التنفيذ ومواعيد المتابعة في خطة سنوية مختصرة يمكن للجميع الرجوع إليها.',
    'لا يوجد',
  ];

  const rows = [];
  for (let person = 0; person < respondents; person += 1) {
    const row = {
      [genderKey]: person % 2 === 0 ? 'ذكر' : 'أنثى',
      [recommendKey]: person % 4 === 0 ? 'لا' : 'نعم',
      [notesKey]: suggestions[person % suggestions.length],
    };
    for (let index = 0; index < QUESTION_COUNT; index += 1) {
      row[questionKey(index)] = choiceFor(PATTERNS[index % PATTERNS.length], person);
    }
    rows.push(row);
  }

  const questionTypes = {
    [genderKey]: 'radio',
    [recommendKey]: 'yes_no',
    [notesKey]: 'textarea',
  };
  const questionOptionCounts = {};
  const questionValueMaps = {};
  for (let index = 0; index < QUESTION_COUNT; index += 1) {
    const key = questionKey(index);
    questionTypes[key] = 'likert';
    questionOptionCounts[key] = 5;
    questionValueMaps[key] = VALUE_MAP;
  }

  const axes = AXIS_NAMES.map((name, axisIndex) => {
    const start = axisIndex * QUESTIONS_PER_AXIS + 1;
    return {
      name,
      start,
      end: start + QUESTIONS_PER_AXIS - 1,
      questionNumbers: Array.from({ length: QUESTIONS_PER_AXIS }, (_, i) => start + i),
    };
  });

  const processed = analysis.processData(rows, axes, questionTypes, [notesKey], {
    questionOptionCounts,
    questionValueMaps,
    comparisonColumn: genderKey,
  });

  if (processed.analysisErrors.length > 0) {
    throw new Error(
      `تعذّر بناء حمولة التحقق: ${processed.analysisErrors.map((e) => e.message).join(' | ')}`
    );
  }

  return {
    title: 'تقرير التحقق من تحليل الاستبيان وتخطيط الصفحات الذكي',
    surveyDate: '2026-06-01',
    reportDate: '2026-08-24',
    manualComment:
      'توصي اللجنة بربط كل إجراء تحسين بمسؤول تنفيذ ومؤشر قياس وموعد مراجعة، ' +
      'مع عرض التقدم بصورة دورية على مجلس إدارة الوحدة.',
    logos: {
      quality: svgDataUrl('QUALITY', '#1a237e'),
      university: svgDataUrl('UNIVERSITY', '#2e7d32'),
      college: svgDataUrl('COLLEGE', '#6a1b9a'),
    },
    signatures: [{ name: 'رئيس لجنة القياس والتقويم', url: svgDataUrl('SIGN', '#455a64') }],
    filters: [],
    ...processed,
  };
}

module.exports = { buildVerificationReport };
