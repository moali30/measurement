"use client";

import { useAuth } from "@/hooks/useAuth";
import { FileText, Users, Activity, BarChart2, Plus, ArrowUpLeft, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { databases } from "@/lib/appwrite";
import { Query } from "appwrite";

export default function DashboardPage() {
  const { user } = useAuth();
  const [formCount, setFormCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [responseCount, setResponseCount] = useState(0);

  useEffect(() => {
    if(!user) return;
    const load = async () => {
      try {
        const db = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "aems_db";
        const forms = await databases.listDocuments(db, "forms", [Query.limit(100)]);
        setFormCount(forms.total);
        setActiveCount(forms.documents.filter((f:any)=>f.status==="active").length);
        setResponseCount(forms.documents.reduce((s:number,f:any)=>s+(f.responsesCount||0),0));
      } catch(e) { console.error(e); }
    };
    load();
  }, [user]);

  const stats = [
    { name: "إجمالي الاستبيانات", value: formCount.toString(), icon: FileText, color: "blue", bgColor: "bg-blue-50", textColor: "text-blue-600" },
    { name: "الاستبيانات النشطة", value: activeCount.toString(), icon: Activity, color: "emerald", bgColor: "bg-emerald-50", textColor: "text-emerald-600" },
    { name: "إجمالي الردود", value: responseCount.toString(), icon: Users, color: "purple", bgColor: "bg-purple-50", textColor: "text-purple-600" },
    { name: "معدل الاستجابة", value: formCount > 0 ? Math.round(responseCount / formCount) + " رد/استبيان" : "—", icon: TrendingUp, color: "amber", bgColor: "bg-amber-50", textColor: "text-amber-600" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            مرحباً، {user?.name || "المستخدم"} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">إليك نظرة عامة على نظامك</p>
        </div>
        <Link href="/dashboard/forms/create">
          <Button className="bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl flex gap-2 px-5 shadow-md shadow-blue-200 h-11">
            <Plus size={18} /> استبيان جديد
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.name} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <item.icon size={22} className={item.textColor} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{item.value}</p>
            <p className="text-sm text-gray-500">{item.name}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-white shadow-lg shadow-blue-200/50">
          <h3 className="text-lg font-bold mb-2">أنشئ استبيان جديد</h3>
          <p className="text-blue-100 text-sm mb-6">ابدأ من الصفر أو اختر من القوالب الجاهزة</p>
          <Link href="/dashboard/forms/create">
            <Button className="bg-white text-blue-700 hover:bg-blue-50 rounded-xl font-semibold flex gap-2">
              <Plus size={16} /> إنشاء الآن
            </Button>
          </Link>
        </div>
        
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-2">إدارة الاستبيانات</h3>
          <p className="text-gray-500 text-sm mb-6">تعديل، نسخ، أو حذف الاستبيانات الموجودة</p>
          <Link href="/dashboard/forms">
            <Button variant="outline" className="rounded-xl font-semibold flex gap-2 border-gray-200 hover:bg-gray-50">
              <ArrowUpLeft size={16} /> عرض الاستبيانات
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
