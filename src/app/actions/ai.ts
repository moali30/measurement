"use server";

export async function generateQuestionsFromDocument(base64Document: string) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY || "GZZx7AipA7sdygHnIuRvXcJGIEuCS7FS";
    if (!apiKey) {
      throw new Error("لم يتم العثور على مفتاح Mistral API في الإعدادات");
    }

    // المرحلة الأولى: استخراج النص باستخدام Mistral OCR
    const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          document_url: base64Document
        }
      })
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error("Mistral OCR Error:", errorText);
      throw new Error(`خطأ في قراءة المستند باستخدام OCR: ${ocrResponse.status}`);
    }

    const ocrData = await ocrResponse.json();
    const markdownContent = ocrData.pages.map((p: any) => p.markdown).join("\n\n---\n\n");

    // المرحلة الثانية: تحويل الـ Markdown إلى JSON للأسئلة
    const promptText = `أنت مساعد ذكي لإنشاء الاستبيانات. لقد قمت بقراءة استبيان باستخدام تقنية OCR وهذا هو المحتوى النصي المستخرج منه بتنسيق Markdown:

${markdownContent}

بناءً على النص أعلاه، استخرج الأسئلة الموجودة، خيارات الإجابة، واستنتج نوع كل سؤال من الأنواع التالية فقط:
"multiple_choice", "checkbox", "text", "rating", "likert", "dropdown", "yes_no", "linear_scale".

هام جداً:
1. يجب عليك استخراج **جميع الأسئلة بلا استثناء** الموجودة في النص. لا تتخطى أي سؤال حتى لو كان النموذج طويلاً.
2. بخصوص المحاور (الفئات/Categories):
   - لاحظ جيداً العناوين الرئيسية (المحاور) التي تسبق مجموعة من الأسئلة أو العبارات (مثل "أولاً: القيادة والإدارة" أو "ثانياً: التخطيط").
   - يجب عليك استخراج هذا العنوان الرئيسي (المحور) ووضعه في حقل "minLabel" لكل الأسئلة/العبارات التابعة له.
   - تأكد من تكرار نفس اسم المحور في حقل "minLabel" لجميع الأسئلة التي تندرج تحته.

يجب أن تكون إجابتك **حصرياً** مصفوفة JSON (Array) صالحة بدون أي نصوص إضافية أو Markdown.
هذا مثال على الشكل المطلوب:
[
  {
    "text": "يدير وحدة ضمان الجودة بكفاءة وفاعلية.",
    "type": "likert",
    "options": ["موافق", "محايد", "غير موافق"],
    "required": true,
    "minLabel": "أولاً: القيادة والإدارة"
  }
]`;

    const chatResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-large-latest", // استخدام موديل لغوي قوي لفهم الـ Markdown والجداول
        messages: [
          {
            role: "user",
            content: promptText
          }
        ],
        temperature: 0.1,
        max_tokens: 8192
      })
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error("Mistral Chat Error:", errorText);
      throw new Error(`خطأ في تحليل البيانات بالذكاء الاصطناعي: ${chatResponse.status}`);
    }

    const chatData = await chatResponse.json();
    let textOutput = chatData.choices[0].message.content;

    // Remove <think>...</think> tags if they exist
    textOutput = textOutput.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Clean up output in case it wrapped in markdown
    textOutput = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Sometimes the model might add intro text, find the first [
    const firstBracket = textOutput.indexOf('[');
    const lastBracket = textOutput.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      textOutput = textOutput.substring(firstBracket, lastBracket + 1);
    }

    const parsedQuestions = JSON.parse(textOutput);
    
    if (!Array.isArray(parsedQuestions)) {
      throw new Error("النتيجة المسترجعة ليست مصفوفة أسئلة صالحة");
    }

    return { success: true, questions: parsedQuestions };
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return { success: false, error: error.message || "حدث خطأ غير متوقع أثناء معالجة المستند" };
  }
}
