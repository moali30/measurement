"use server";

export async function generateQuestionsFromImage(base64Images: string[]) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("لم يتم العثور على مفتاح Groq API في الإعدادات");
    }

    // Construct message content
    const content: any[] = [
      {
        type: "text",
        text: `أنت مساعد ذكي لإنشاء الاستبيانات. قم بتحليل الصورة أو الصور المرفقة (وهي عبارة عن نموذج استبيان).
استخرج الأسئلة الموجودة، خيارات الإجابة، واستنتج نوع كل سؤال من الأنواع التالية فقط:
"multiple_choice", "checkbox", "text", "rating", "likert", "dropdown", "yes_no", "linear_scale".

هام جداً بخصوص المحاور (الفئات/Categories):
- غالباً ما تكون الاستبيانات في شكل جداول.
- لاحظ جيداً الأعمدة الجانبية (مثل العمود الأول) الذي يحتوي على عنوان رئيسي (المحور) يدمج أو يغطي عدة صفوف/أسئلة معاً (مثل "أولاً: القيادة والإدارة" أو "ثانياً: التخطيط").
- يجب عليك استخراج هذا العنوان الرئيسي (المحور) ووضعه في حقل "minLabel" لكل الأسئلة/العبارات التابعة له في ذلك الجزء من الجدول.
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
]`
      }
    ];

    // Add images to content
    for (const base64 of base64Images) {
      content.push({
        type: "image_url",
        image_url: {
          url: base64
        }
      });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: content
          }
        ],
        temperature: 0.2,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API Error:", errorText);
      throw new Error(`خطأ في الاتصال بالذكاء الاصطناعي: ${response.status}`);
    }

    const data = await response.json();
    let textOutput = data.choices[0].message.content;

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
    return { success: false, error: error.message || "حدث خطأ غير متوقع أثناء معالجة الصورة" };
  }
}
