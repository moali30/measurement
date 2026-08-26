/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * يصلح بدائل أسئلة ليكرت المخزَّنة بغير خمس.
 *
 * الخلل: ٢٦ سؤالاً في نموذج «تقييم مدير وحدة ضمان الجودة» — وغيره — مخزَّن
 * بـ `["موافق","محايد","غير موافق"]` بينما إجاباته تحوي «موافق جداً». أي أن
 * الاستجابات جُمعت على نموذج خماسي ثم استُبدلت بدائل الأسئلة بثلاث.
 *
 * أثر ذلك مزدوج: التحليل يرفض النموذج لأن الترميز المبني على ثلاث بدائل لا
 * يغطي إجاباته، **والصفحة العامة تعرض ثلاثة بدائل للمشاركين الجدد** لأنها
 * ترسم `options` كما هي.
 *
 * القاعدة هنا محافظة: لا يُصلَّح سؤال إلا إذا كانت **كل** إجاباته المخزَّنة من
 * البدائل الخمسة المعيارية. أي سؤال فيه إجابة خارجها — مثل سؤال نعم/لا وُسم
 * ليكرت بالخطأ — يُترك ويُبلَّغ عنه، فتصحيحه قرار لا استنتاج.
 *
 *   node scripts/repair-likert-options.cjs          # عرض فقط، بلا كتابة
 *   node scripts/repair-likert-options.cjs --apply  # تنفيذ الإصلاح
 */
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const STANDARD = ['موافق جداً', 'موافق', 'محايد', 'غير موافق', 'غير موافق جداً'];

/** الإجابات الرقمية سليمة أصلاً ولا تحتاج مطابقة نصية */
const NUMERIC = new Set(['1', '2', '3', '4', '5']);

function loadEnv() {
  const file = path.resolve(__dirname, '..', '.env.local');
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => [
        line.slice(0, line.indexOf('=')).trim(),
        line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''),
      ])
  );
}

async function run() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: forms, error } = await supabase.from('forms').select('id, title');
  if (error) throw new Error(error.message);

  const repairable = [];
  const skipped = [];

  for (const form of forms) {
    const { data: questions } = await supabase
      .from('questions')
      .select('id, order_index, text, options')
      .eq('form_id', form.id)
      .eq('type', 'likert');
    if (!questions || questions.length === 0) continue;

    const candidates = questions.filter((question) => {
      const options = (question.options || []).map((o) => String(o).trim()).filter(Boolean);
      return options.length !== STANDARD.length;
    });
    if (candidates.length === 0) continue;

    for (const question of candidates) {
      const { data: answers } = await supabase
        .from('response_answers')
        .select('text_value')
        .eq('question_id', question.id)
        .limit(2000);

      const foreign = new Set();
      (answers || []).forEach((answer) => {
        const value = answer.text_value && String(answer.text_value).trim();
        if (value && !STANDARD.includes(value) && !NUMERIC.has(value)) foreign.add(value);
      });

      const entry = {
        form: form.title,
        order: question.order_index,
        text: String(question.text).slice(0, 40),
        id: question.id,
        before: question.options,
        answers: (answers || []).length,
      };
      if (foreign.size > 0) skipped.push({ ...entry, foreign: [...foreign] });
      else repairable.push(entry);
    }
  }

  console.log(APPLY ? 'MODE: apply' : 'MODE: dry run (no writes)');
  console.log('repairable questions: ' + repairable.length);
  console.log('skipped questions:    ' + skipped.length + '\n');

  const byForm = new Map();
  repairable.forEach((entry) => byForm.set(entry.form, (byForm.get(entry.form) || 0) + 1));
  byForm.forEach((count, title) => console.log('  ' + count + ' × ' + title.slice(0, 60)));

  if (skipped.length > 0) {
    console.log('\nSKIPPED — answers outside the standard five, decide manually:');
    skipped.forEach((entry) =>
      console.log(
        '  [' + entry.order + '] ' + entry.text + ' → ' + entry.foreign.join(' / ') +
          '   (' + entry.form.slice(0, 40) + ')'
      )
    );
  }

  if (!APPLY) {
    console.log('\nNothing was written. Re-run with --apply to perform the repair.');
    return;
  }

  let done = 0;
  for (const entry of repairable) {
    const { error: updateError } = await supabase
      .from('questions')
      .update({ options: STANDARD })
      .eq('id', entry.id);
    if (updateError) {
      console.error('  ✖ [' + entry.order + '] ' + entry.text + ': ' + updateError.message);
      continue;
    }
    done += 1;
  }
  console.log('\nrepaired ' + done + ' / ' + repairable.length + ' questions.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
