"use client";

import { FormBuilder } from "@/components/forms/FormBuilder";

export default function CreateFormPage() {
  return (
    <div className="py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">إنشاء استبيان جديد</h1>
      </div>
      <FormBuilder />
    </div>
  );
}
