"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function PublicFormPage() {
  const [submitted, setSubmitted] = useState(false);

  // Mock data for the form
  const formTitle = "تقييم مقرر برمجة الحاسوب";
  const formDescription = "الفصل الثاني 2024/2025";
  const questions = [
    { id: "q1", text: "1. مدى وضوح شرح المحاضر", type: "multiple_choice", options: ["ممتاز", "جيد", "مقبول"] },
    { id: "q2", text: "2. مدى صعوبة المقرر", type: "rating" },
    { id: "q3", text: "3. مقترحات إضافية", type: "text" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">تم استلام ردك بنجاح</h2>
          <p className="text-gray-600">شكراً لمشاركتك في هذا الاستبيان.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-8 rounded-xl shadow-sm border-t-8 border-blue-600">
          <h1 className="text-3xl font-bold text-gray-900">{formTitle}</h1>
          <p className="mt-2 text-gray-600">{formDescription}</p>
        </div>

        {/* Questions */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{q.text}</h3>
              
              {q.type === "multiple_choice" && (
                <div className="space-y-3">
                  {q.options?.map((opt, i) => (
                    <label key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input type="radio" name={q.id} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" required />
                      <span className="text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === "rating" && (
                <div className="flex gap-2" dir="ltr">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <label key={star} className="cursor-pointer">
                      <input type="radio" name={q.id} value={star} className="sr-only" required />
                      <svg className="w-10 h-10 text-gray-300 hover:text-yellow-400 focus:text-yellow-400 peer-checked:text-yellow-400 transition-colors" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    </label>
                  ))}
                </div>
              )}

              {q.type === "text" && (
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="أدخل إجابتك هنا..."
                ></textarea>
              )}
            </div>
          ))}

          <div className="pt-4">
            <Button type="submit" className="w-full sm:w-auto px-8 py-3 text-lg bg-blue-600 hover:bg-blue-700">
              إرسال الإجابات
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
