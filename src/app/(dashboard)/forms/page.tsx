"use client";

import Link from "next/link";
import { Plus, MoreVertical, FileText, Settings, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FormsListPage() {
  const forms = [
    { id: "1", title: "تقييم المقرر الدراسي", responses: 120, status: "نشط", date: "2024-05-10" },
    { id: "2", title: "استبيان رضا الطلاب", responses: 85, status: "نشط", date: "2024-05-08" },
    { id: "3", title: "تقييم أعضاء هيئة التدريس", responses: 0, status: "مسودة", date: "2024-05-11" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">الاستبيانات</h1>
        <Link href="/dashboard/forms/create">
          <Button className="bg-blue-600 hover:bg-blue-700 flex gap-2">
            <Plus size={16} /> استبيان جديد
          </Button>
        </Link>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                العنوان
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الحالة
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الردود
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                تاريخ الإنشاء
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">إجراءات</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {forms.map((form) => (
              <tr key={form.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg">
                      <FileText size={20} />
                    </div>
                    <div className="mr-4">
                      <div className="text-sm font-medium text-gray-900">{form.title}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    form.status === "نشط" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    {form.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {form.responses}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {form.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                  <div className="flex items-center justify-end gap-2 text-gray-400">
                    <button className="hover:text-blue-600 p-1" title="النتائج"><BarChart2 size={18} /></button>
                    <button className="hover:text-blue-600 p-1" title="الإعدادات"><Settings size={18} /></button>
                    <button className="hover:text-gray-600 p-1"><MoreVertical size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {forms.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  لا توجد استبيانات حالياً. ابدأ بإنشاء استبيان جديد!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
