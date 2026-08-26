/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * تدقيق التخطيط والرسوم على صفحة مطبوعة حقيقية.
 *
 * لماذا متصفّح لا اختبار وحدة: القصّ والفيض وتداخل العناصر لا وجود لها في
 * البيانات، بل تولد من التنسيق على عرض A4 بخطوط عربية. ولا نقارن بلقطات
 * مرجعية بالبكسل لأن رسم الخطوط يختلف بين الأجهزة فتفشل المقارنة بلا سبب
 * حقيقي؛ نقيس هندسة العناصر بدلاً من ذلك، فالفشل يقول أين ولماذا.
 *
 *   npm run verify:layout -- http://127.0.0.1:3000
 */
const { chromium } = require('playwright');
const { loadTypeScriptModule } = require('./load-ts.cjs');
const { buildVerificationReport } = require('./build-verification-report.cjs');

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';

const { auditReport } = loadTypeScriptModule('src/lib/analysis/audit.ts');

/** عرض منطقة المحتوى داخل هوامش A4 كما يضبطها قالب الطباعة */
const A4_CONTENT_WIDTH_PX = Math.round((210 - 2 * 12) * (96 / 25.4));

const failures = [];
let checks = 0;

function expect(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

async function run() {
  const report = buildVerificationReport();
  const audit = auditReport(report);
  if (audit.errors.length > 0) {
    throw new Error('حمولة التحقق نفسها مكسورة — شغّل npm run verify:analysis أولاً.');
  }

  /**
   * تخريب مقصود للتأكد من أن هذا الملف يفحص شيئاً فعلاً.
   *
   * يُعدَّل ما يُرسَم فقط، ويبقى `report` مرجعاً سليماً — تعديل الاثنين معاً
   * يجعلهما متفقين على الخطأ فلا يكشفه أي فحص. تُشغَّل بـ:
   *   LAYOUT_SABOTAGE=weight npm run verify:layout
   */
  const rendered = structuredClone(report);
  const sabotage = process.env.LAYOUT_SABOTAGE;
  if (sabotage === 'weight') {
    rendered.results[0].relativeWeight += 5;
  } else if (sabotage === 'normalized') {
    rendered.results[0].normalizedScore += 7;
  } else if (sabotage === 'reco') {
    rendered.recommendations = rendered.recommendations.slice(0, -1);
  }
  if (sabotage) console.log(`[تخريب مقصود: ${sabotage}]`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: A4_CONTENT_WIDTH_PX, height: 1400 } });
  await page.addInitScript((data) => {
    window.__PRINT_DATA__ = data;
  }, rendered);
  await page.goto(`${baseUrl}/reports/print/analysis`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-print-ready="true"]', { timeout: 60000 });

  if (sabotage === 'wide') {
    // الفيض لا يولد من البيانات بل من التنسيق، فنحقنه في الصفحة مباشرةً
    await page.evaluate(() => {
      const block = document.createElement('div');
      block.style.cssText = 'width:2000px;height:4px;background:#000';
      document.querySelector('.print-document').appendChild(block);
    });
  }

  // ---------- ١) الأقسام المتوقعة موجودة ----------
  const titles = await page.$$eval('.print-section-title', (nodes) =>
    nodes.map((node) => node.textContent.trim())
  );
  const required = [
    'الملخص التنفيذي',
    'نتائج تحليل الاستبيان',
    'توصيف العيّنة',
    'نتائج تحليل المحاور',
    'الرسوم البيانية والمؤشرات',
    'الجوانب التي تحتاج إلى تحسين',
  ];
  required.forEach((title) => {
    expect(titles.includes(title), `القسم «${title}» غائب عن التقرير`);
  });
  expect(
    titles.includes('أسئلة انقسام الآراء'),
    'حمولة التحقق تحتوي بنوداً منقسمة، فيجب أن يظهر قسمها'
  );

  // ---------- ٢) لا فيض أفقي ----------
  const overflowing = await page.$$eval(
    '.print-document *',
    (nodes, limit) =>
      nodes
        .filter((node) => node.getBoundingClientRect().width > limit + 1)
        .slice(0, 5)
        .map((node) => `${node.tagName.toLowerCase()}.${node.className}`.slice(0, 90)),
    A4_CONTENT_WIDTH_PX
  );
  expect(overflowing.length === 0, `عناصر أعرض من منطقة الطباعة: ${overflowing.join(' | ')}`);

  const documentScroll = await page.$eval('.print-document', (node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }));
  expect(
    documentScroll.scrollWidth <= documentScroll.clientWidth + 1,
    `المستند يفيض أفقياً: ${documentScroll.scrollWidth} > ${documentScroll.clientWidth}`
  );

  // ---------- ٣) لا نص مقصوص ----------
  // العرض وحده هو مقياس القصّ هنا: الخلايا تلتف رأسياً بحرية، وارتفاع صندوق
  // السطر يزيد بكسلين عن الارتفاع المحسوب بحكم التقريب، فيبلّغ فحص الارتفاع
  // عن قصٍّ وهمي في كل خلية.
  const clipped = await page.$$eval(
    '.print-table td, .print-table th, .print-kpi-card, .print-reco__goal, .print-reco__why',
    (nodes) =>
      nodes
        .filter((node) => node.scrollWidth > node.clientWidth + 1)
        .slice(0, 5)
        .map((node) => (node.textContent || '').trim().slice(0, 40))
  );
  expect(clipped.length === 0, `خلايا نصّها مقصوص: ${clipped.join(' | ')}`);

  // ---------- ٤) جداول بأعمدة متسقة ----------
  // محاكاة شبكة الجدول: خلية بـ rowSpan تشغل أعمدة في صفوف لاحقة لا خلايا لها،
  // فعدّ الخلايا وحده يُبلغ عن نقص وهمي في جدول توصيف العيّنة.
  const tableShapes = await page.$$eval('.print-table', (tables) =>
    tables.map((table) => {
      const headers = table.querySelectorAll('thead th').length;
      let spans = [];
      const widths = Array.from(table.querySelectorAll('tbody tr')).map((row) => {
        const carried = spans.reduce((sum, span) => sum + span.colspan, 0);
        const own = Array.from(row.children).reduce(
          (sum, cell) => sum + (Number(cell.getAttribute('colspan')) || 1),
          0
        );
        spans = spans
          .map((span) => ({ ...span, remaining: span.remaining - 1 }))
          .filter((span) => span.remaining > 0);
        Array.from(row.children).forEach((cell) => {
          const rowSpan = Number(cell.getAttribute('rowspan')) || 1;
          if (rowSpan > 1) {
            spans.push({
              remaining: rowSpan - 1,
              colspan: Number(cell.getAttribute('colspan')) || 1,
            });
          }
        });
        return carried + own;
      });
      return { headers, widths };
    })
  );
  tableShapes.forEach((shape, index) => {
    const mismatched = shape.widths.filter((width) => width !== shape.headers);
    expect(
      mismatched.length === 0,
      `الجدول رقم ${index + 1}: ${mismatched.length} صفاً عرضه ` +
        `${[...new Set(mismatched)].join('/')} بينما الرأس ${shape.headers} عموداً`
    );
  });

  // ---------- ٥) الرسم الدائري يطابق الجدول ----------
  const donut = await page.$$eval('.print-donut__legend li', (items) =>
    items.map((item) => (item.querySelector('.print-donut__value')?.textContent || '').trim())
  );
  expect(donut.length > 0, 'الرسم الدائري بلا وسيلة إيضاح');
  const donutTotal = donut.reduce((sum, text) => sum + (parseInt(text, 10) || 0), 0);
  expect(
    donutTotal === report.results.length,
    `مجموع فئات الرسم الدائري ${donutTotal} لا يساوي عدد الأسئلة ${report.results.length}`
  );

  // ---------- ٦) قسم الانقسام: تلوين وإطار ----------
  const shareCells = await page.$$eval('.print-table--shares tbody tr', (rows) =>
    rows.map((row) => {
      const cells = Array.from(row.querySelectorAll('.share'));
      return {
        values: cells.map((cell) => parseFloat(cell.textContent)),
        dominantIndex: cells.findIndex((cell) => cell.classList.contains('share--dominant')),
        backgrounds: cells.map((cell) => getComputedStyle(cell).backgroundColor),
      };
    })
  );
  expect(shareCells.length > 0, 'جدول انقسام الآراء بلا صفوف');
  shareCells.forEach((row, index) => {
    const maximum = Math.max(...row.values);
    expect(
      row.values[row.dominantIndex] === maximum,
      `الصف ${index + 1} في جدول الانقسام: الإطار على ${row.values[row.dominantIndex]}% ` +
        `بينما الأكبر ${maximum}%`
    );
    expect(
      new Set(row.backgrounds).size > 1,
      `الصف ${index + 1}: خلايا الاتجاهات الثلاثة بلون واحد، فلا دلالة للتلوين`
    );
    expect(
      Math.abs(row.values.reduce((sum, value) => sum + value, 0) - 100) < 0.5,
      `الصف ${index + 1}: مجموع النسب المعروضة ${row.values.join('+')} لا يساوي 100`
    );
  });

  // ---------- ٧) الأرقام المعروضة تطابق الحمولة ----------
  const printedWeights = await page.$$eval(
    '.print-table--results tbody tr',
    (rows) =>
      rows.map((row) => {
        const cells = row.querySelectorAll('td');
        return {
          number: Number(cells[0].textContent.trim()),
          mean: Number(cells[3].textContent.trim()),
          normalized: Number(cells[4].textContent.trim()),
          weight: parseFloat(cells[5].textContent),
        };
      })
  );
  expect(
    printedWeights.length === report.results.length,
    `جدول النتائج فيه ${printedWeights.length} صفاً والحمولة ${report.results.length}`
  );
  printedWeights.forEach((printed) => {
    const source = report.results.find((item) => item.questionNumber === printed.number);
    expect(Boolean(source), `الصف ${printed.number} لا يقابله بند في الحمولة`);
    if (!source) return;
    expect(printed.mean === source.mean, `السؤال ${printed.number}: المتوسط المطبوع يخالف الحمولة`);
    expect(
      printed.normalized === source.normalizedScore,
      `السؤال ${printed.number}: المؤشر المعياري المطبوع يخالف الحمولة`
    );
    expect(
      printed.weight === source.relativeWeight,
      `السؤال ${printed.number}: الوزن النسبي المطبوع يخالف الحمولة`
    );
  });

  await browser.close();

  if (failures.length > 0) {
    console.error(`فشل تدقيق التخطيط — ${failures.length} من ${checks} فحصاً:`);
    failures.forEach((message) => console.error('  ✖', message));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Report layout verification passed — ${checks} فحصاً هندسياً على ` +
      `${report.results.length} بنداً و${titles.length} قسماً.`
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
