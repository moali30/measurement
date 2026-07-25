"use client";

import { useState, useEffect } from "react";
import { Database, HardDrive, Users, Activity, AlertCircle, Info, TrendingUp, CheckCircle2 } from "lucide-react";
import { getUsageStatsServer } from "@/app/actions/usage";

interface UsageStats {
  forms: number;
  responses: number;
  users: number;
  signatures: number;
  estimatedMb: number;
}

export default function PlanAndUsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Supabase Free Tier Limits
  const MAX_DB_SIZE_MB = 500;

  const MAX_USERS = 50000;

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const res = await getUsageStatsServer();
      if (res.success && res.stats) {
        setStats(res.stats);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  const dbPercentage = stats ? Math.min(100, (stats.estimatedMb / MAX_DB_SIZE_MB) * 100).toFixed(2) : "0";
  // Assuming signatures take approx DB space, but we also show storage as 0 if not using buckets
  const usersPercentage = stats ? Math.min(100, (stats.users / MAX_USERS) * 100).toFixed(2) : "0";

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-indigo-900 mb-2 flex items-center gap-3">
          <Database className="text-blue-600" /> خطة الاشتراك والاستهلاك
        </h1>
        <p className="text-gray-600 font-medium">متابعة استهلاك الموارد الخاصة بقاعدة البيانات (Supabase Free Plan)</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Database Size Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full blur-2xl z-0"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                <Database size={24} />
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-full">قاعدة البيانات</span>
            </div>
            <h3 className="text-gray-500 font-semibold mb-1">استهلاك مساحة البيانات</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-black text-gray-800">{stats ? stats.estimatedMb : "0"}</span>
              <span className="text-gray-500 font-medium">/ 500 MB</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
              <div 
                className={`h-2.5 rounded-full transition-all duration-1000 ${parseFloat(dbPercentage) > 80 ? 'bg-red-500' : 'bg-blue-500'}`} 
                style={{ width: `${dbPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">{dbPercentage}% مستخدم (تقديري)</p>
          </div>
        </div>

        {/* File Storage Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full blur-2xl z-0"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                <HardDrive size={24} />
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-purple-50 text-purple-600 rounded-full">التخزين السحابي</span>
            </div>
            <h3 className="text-gray-500 font-semibold mb-1">تخزين الملفات (Storage)</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-black text-gray-800">0</span>
              <span className="text-gray-500 font-medium">/ 1 GB</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
              <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: '0%' }}></div>
            </div>
            <p className="text-xs text-gray-500">التوقيعات تُحفظ في قاعدة البيانات مباشرة حالياً</p>
          </div>
        </div>

        {/* MAU Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full blur-2xl z-0"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                <Users size={24} />
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">المستخدمين</span>
            </div>
            <h3 className="text-gray-500 font-semibold mb-1">المستخدمين النشطين شهرياً</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-black text-gray-800">{stats ? stats.users : "0"}</span>
              <span className="text-gray-500 font-medium">/ 50,000</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
              <div 
                className="h-2.5 rounded-full transition-all duration-1000 bg-emerald-500" 
                style={{ width: `${usersPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">{usersPercentage}% مستخدم</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 p-6">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Activity className="text-blue-500" /> تفاصيل السجلات
              </h2>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-gray-500 text-sm font-semibold mb-1">الاستبيانات</span>
                    <span className="text-2xl font-black text-gray-800">{stats?.forms}</span>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-gray-500 text-sm font-semibold mb-1">الردود المسجلة</span>
                    <span className="text-2xl font-black text-gray-800">{stats?.responses}</span>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-gray-500 text-sm font-semibold mb-1">إجمالي الحسابات</span>
                    <span className="text-2xl font-black text-gray-800">{stats?.users}</span>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-gray-500 text-sm font-semibold mb-1">التوقيعات المحفوظة</span>
                    <span className="text-2xl font-black text-gray-800">{stats?.signatures}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-6 border border-blue-100">
            <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <AlertCircle className="text-blue-600" /> نصائح لإدارة الخطة المجانية بفعالية
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-blue-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 text-sm leading-relaxed">
                  <strong>حذف الاستبيانات القديمة:</strong> قم بحذف الاستبيانات التي انتهى العمل بها ولم تعد بحاجة إلى الردود الخاصة بها لتحرير مساحة.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-blue-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 text-sm leading-relaxed">
                  <strong>تقليل جودة التوقيعات:</strong> يتم حفظ التوقيعات حالياً كصور Base64 في قاعدة البيانات. قم بمسح التوقيعات التي لا تستخدمها لتوفير مساحة ملحوظة من قاعدة البيانات (حيث تستهلك مساحة أكبر من النصوص).
                </p>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-blue-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 text-sm leading-relaxed">
                  <strong>الحد الأقصى لقاعدة البيانات:</strong> 500 ميجابايت تكفي لمئات الآلاف من الردود النصية، ولكنها تمتلئ أسرع في حال حفظ الكثير من التوقيعات أو الصور.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-blue-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 text-sm leading-relaxed">
                  <strong>مراقبة الاستهلاك الدقيق:</strong> للحصول على أرقام دقيقة 100% يمكنك زيارة لوحة تحكم Supabase الخاصة بمشروعك ومراجعة قسم Reports &gt; Database.
                </p>
              </li>
            </ul>
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sticky top-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Info className="text-gray-400" size={20} /> تفاصيل الخطة المجانية
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 mb-1">قاعدة البيانات (Database)</h4>
                <p className="text-xs text-gray-500">تصل إلى 500 MB مساحة لتخزين الجداول والنصوص والصور المرمزة.</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 mb-1">التخزين (Storage)</h4>
                <p className="text-xs text-gray-500">مساحة 1 GB لرفع الملفات (غير مستخدمة حالياً في التطبيق، مما يوفر في الاستهلاك).</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 mb-1">المستخدمين (Auth)</h4>
                <p className="text-xs text-gray-500">حتى 50,000 مستخدم نشط شهرياً (MAU)، وهو أكثر من كافٍ لمعظم الجامعات.</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 mb-1">البيانات المنقولة (Bandwidth)</h4>
                <p className="text-xs text-gray-500">5 GB شهرياً من تناقل البيانات بين السيرفر والمتصفح.</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <a href="https://supabase.com/dashboard/projects" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors">
                <TrendingUp size={16} /> فتح لوحة Supabase
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
