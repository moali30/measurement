"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical, Save, Eye } from "lucide-react";
import { ID } from "appwrite";

export type QuestionType = "multiple_choice" | "checkbox" | "text" | "rating" | "likert" | "dropdown";

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  required: boolean;
}

export function FormBuilder() {
  const [title, setTitle] = useState("استبيان جديد");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);

  const addQuestion = (type: QuestionType = "multiple_choice") => {
    const newQuestion: Question = {
      id: ID.unique(),
      text: "سؤال جديد",
      type,
      options: ["خيار 1"],
      required: false,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const addOption = (questionId: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          return { ...q, options: [...q.options, `خيار ${q.options.length + 1}`] };
        }
        return q;
      })
    );
  };

  const updateOption = (questionId: string, index: number, value: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          const newOptions = [...q.options];
          newOptions[index] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const removeOption = (questionId: string, index: number) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          const newOptions = q.options.filter((_, i) => i !== index);
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const saveForm = async () => {
    // To be implemented: save to Appwrite
    console.log({ title, description, questions });
    alert("تم حفظ النموذج مؤقتاً في الكونسول");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Form Header */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 border-t-8 border-t-blue-600">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-4xl font-bold border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-0 pb-2 transition-colors"
          placeholder="عنوان الاستبيان"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full mt-4 text-gray-600 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-0 pb-1 transition-colors"
          placeholder="وصف الاستبيان (اختياري)"
        />
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((q, qIndex) => (
          <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 group relative">
            <div className="absolute top-2 right-1/2 cursor-move text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={20} />
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-500">{qIndex + 1}.</span>
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                    className="flex-1 text-lg font-medium bg-gray-50 p-2 rounded-md border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none"
                    placeholder="نص السؤال"
                  />
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionType })}
                    className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="multiple_choice">اختيار من متعدد</option>
                    <option value="checkbox">مربعات اختيار</option>
                    <option value="dropdown">قائمة منسدلة</option>
                    <option value="text">نص (قصير / طويل)</option>
                    <option value="rating">تقييم (نجوم)</option>
                    <option value="likert">مقياس ليكرت</option>
                  </select>
                </div>

                {/* Options Rendering Based on Type */}
                {(q.type === "multiple_choice" || q.type === "checkbox" || q.type === "dropdown") && (
                  <div className="space-y-2 pr-8">
                    {q.options.map((opt, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-2">
                        <div className="w-4 h-4 border border-gray-400 rounded-full flex-shrink-0" />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(q.id, oIndex, e.target.value)}
                          className="flex-1 p-1 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                        {q.options.length > 1 && (
                          <button
                            onClick={() => removeOption(q.id, oIndex)}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-blue-600 hover:text-blue-800 cursor-pointer pt-2" onClick={() => addOption(q.id)}>
                      <div className="w-4 h-4" />
                      <span className="text-sm">إضافة خيار</span>
                    </div>
                  </div>
                )}

                {q.type === "text" && (
                  <div className="pr-8">
                    <div className="border-b border-gray-300 pb-2 text-gray-400 text-sm">
                      نص إجابة طويل...
                    </div>
                  </div>
                )}

                {q.type === "rating" && (
                  <div className="pr-8 flex gap-2 text-gray-300">
                    {[1,2,3,4,5].map(star => (
                      <svg key={star} className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    ))}
                  </div>
                )}

                {q.type === "likert" && (
                  <div className="pr-8 text-sm text-gray-500 italic">
                    (سيظهر مقياس من: غير موافق جداً إلى موافق جداً)
                  </div>
                )}

              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-4">
              <button
                onClick={() => deleteQuestion(q.id)}
                className="text-gray-400 hover:text-red-500"
                title="حذف السؤال"
              >
                <Trash2 size={20} />
              </button>
              <div className="w-px h-6 bg-gray-200"></div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <span>مطلوب</span>
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Add Question Floating Bar */}
      <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-full shadow-lg border border-gray-100 fixed bottom-8 left-1/2 transform -translate-x-1/2">
        <Button onClick={() => addQuestion("multiple_choice")} variant="outline" className="rounded-full flex gap-2">
          <Plus size={16} /> إضافة سؤال
        </Button>
        <div className="w-px h-6 bg-gray-200"></div>
        <Button onClick={saveForm} className="rounded-full flex gap-2 bg-blue-600 hover:bg-blue-700">
          <Save size={16} /> حفظ الاستبيان
        </Button>
        <Button variant="secondary" className="rounded-full flex gap-2">
          <Eye size={16} /> معاينة
        </Button>
      </div>
    </div>
  );
}
