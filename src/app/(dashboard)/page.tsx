"use client";

import { useAuth } from "@/hooks/useAuth";
import { FileText, Users, Activity, BarChart2 } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();

  const stats = [
    { name: "فورمات نشطة", value: "12", icon: FileText, change: "+2", changeType: "increase" },
    { name: "إجمالي الردود", value: "847", icon: Users, change: "+140", changeType: "increase" },
    { name: "نسبة الاستجابة", value: "76%", icon: Activity, change: "+5%", changeType: "increase" },
    { name: "قوالب مخصصة", value: "3", icon: BarChart2, change: "0", changeType: "neutral" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          مرحباً، {user?.name || "المستخدم"} 👋
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden border border-gray-100"
          >
            <dt>
              <div className="absolute bg-blue-50 rounded-md p-3">
                <item.icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
              </div>
              <p className="mr-16 text-sm font-medium text-gray-500 truncate">
                {item.name}
              </p>
            </dt>
            <dd className="mr-16 pb-6 flex items-baseline sm:pb-7">
              <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
              <p
                className={`ml-2 flex items-baseline text-sm font-semibold ${
                  item.changeType === "increase" ? "text-green-600" : "text-gray-500"
                }`}
              >
                {item.change}
              </p>
            </dd>
          </div>
        ))}
      </div>
      
      {/* Placeholder for Recent Forms Table & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100 h-96 flex items-center justify-center text-gray-400">
          [جدول أحدث الاستبيانات]
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100 h-96 flex items-center justify-center text-gray-400">
          [رسم بياني للاستجابات]
        </div>
      </div>
    </div>
  );
}
