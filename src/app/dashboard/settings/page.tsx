"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateNameServer, changePasswordServer } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { User, Lock, Bell, Globe, Palette, Shield, ChevronLeft, Check } from "lucide-react";

type Tab = "profile" | "security" | "notifications" | "appearance";

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile
  const [name, setName] = useState(user?.name || "");
  const [email] = useState(user?.email || "");

  // Security
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passError, setPassError] = useState("");

  // Notifications
  const [emailNotif, setEmailNotif] = useState(true);
  const [responseNotif, setResponseNotif] = useState(true);

  // Appearance
  const [theme, setTheme] = useState("light");

  const tabs = [
    { key: "profile" as Tab, label: "الملف الشخصي", icon: User },
    { key: "security" as Tab, label: "الأمان", icon: Lock },
    { key: "notifications" as Tab, label: "الإشعارات", icon: Bell },
    { key: "appearance" as Tab, label: "المظهر", icon: Palette },
  ];

  const saveName = async () => {
    setSaving(true);
    try { await updateNameServer(name); setSaved(true); setTimeout(()=>setSaved(false),2000); } catch(e){console.error(e);}
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    setPassError("");
    if(newPassword.length < 8) { setPassError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if(newPassword !== confirmPassword) { setPassError("كلمة المرور غير متطابقة"); return; }
    setSaving(true);
    try { 
      const result = await changePasswordServer(newPassword, oldPassword);
      if (result.success) { setSaved(true); setOldPassword(""); setNewPassword(""); setConfirmPassword(""); setTimeout(()=>setSaved(false),2000); }
      else { setPassError(result.error || "حدث خطأ"); }
    } 
    catch(e:unknown) { setPassError(e instanceof Error ? e.message : "حدث خطأ"); }
    finally { setSaving(false); }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v:boolean)=>void }) => (
    <button onClick={()=>onChange(!checked)} className={`relative w-11 h-6 rounded-full transition-colors ${checked?'bg-blue-500':'bg-gray-200'}`}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked?'left-0.5':'right-0.5'}`}/>
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-sm text-gray-500 mt-1">إدارة حسابك وتفضيلات النظام</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-56 flex-shrink-0">
          <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 space-y-1">
            {tabs.map(t => (
              <button key={t.key} onClick={()=>setActiveTab(t.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab===t.key ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}>
                <t.icon size={18} className={activeTab===t.key?'text-blue-500':'text-gray-400'}/>
                {t.label}
                {activeTab===t.key && <ChevronLeft size={14} className="mr-auto text-blue-400"/>}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-200">
                  {user?.name?.charAt(0) || "U"}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">الاسم</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-gray-50/50"/>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">البريد الإلكتروني</label>
                <input type="email" value={email} disabled
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-100 text-gray-500 cursor-not-allowed"/>
                <p className="text-xs text-gray-400 mt-1">لا يمكن تغيير البريد الإلكتروني</p>
              </div>

              <Button onClick={saveName} disabled={saving}
                className="bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl px-6 shadow-md shadow-blue-200">
                {saving ? "جاري الحفظ..." : saved ? <><Check size={16}/>تم الحفظ</> : "حفظ التغييرات"}
              </Button>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-6 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center"><Shield size={22} className="text-amber-500"/></div>
                <div><h2 className="text-lg font-bold text-gray-900">الأمان</h2><p className="text-sm text-gray-500">تغيير كلمة المرور</p></div>
              </div>

              {passError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">{passError}</div>}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">كلمة المرور الحالية</label>
                <input type="password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">كلمة المرور الجديدة</label>
                <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">تأكيد كلمة المرور</label>
                <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"/>
              </div>
              <Button onClick={changePassword} disabled={saving}
                className="bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl px-6 shadow-md shadow-blue-200">
                {saving?"جاري التحديث...":saved?<><Check size={16}/>تم التحديث</>:"تحديث كلمة المرور"}
              </Button>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-6 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center"><Bell size={22} className="text-purple-500"/></div>
                <div><h2 className="text-lg font-bold text-gray-900">الإشعارات</h2><p className="text-sm text-gray-500">التحكم في إشعارات النظام</p></div>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-gray-50">
                <div><p className="text-sm font-medium text-gray-800">إشعارات البريد</p><p className="text-xs text-gray-400">تلقي إشعارات عبر البريد الإلكتروني</p></div>
                <Toggle checked={emailNotif} onChange={setEmailNotif}/>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-gray-50">
                <div><p className="text-sm font-medium text-gray-800">إشعارات الردود</p><p className="text-xs text-gray-400">تنبيه عند وصول رد جديد</p></div>
                <Toggle checked={responseNotif} onChange={setResponseNotif}/>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-6 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center"><Palette size={22} className="text-indigo-500"/></div>
                <div><h2 className="text-lg font-bold text-gray-900">المظهر</h2><p className="text-sm text-gray-500">تخصيص واجهة النظام</p></div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">السمة</label>
                <div className="grid grid-cols-3 gap-3">
                  {[{k:"light",l:"فاتح",emoji:"☀️"},{k:"dark",l:"داكن",emoji:"🌙"},{k:"auto",l:"تلقائي",emoji:"💻"}].map(t=>(
                    <button key={t.k} onClick={()=>setTheme(t.k)}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${theme===t.k?'border-blue-500 bg-blue-50':'border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-2xl mb-2 block">{t.emoji}</span>
                      <span className="text-sm font-medium text-gray-700">{t.l}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">اللغة</label>
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <Globe size={16} className="text-gray-400"/>
                  <span className="text-sm text-gray-700">العربية</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">اللغة الإنجليزية ستكون متاحة قريباً</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
