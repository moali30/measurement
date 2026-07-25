/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { createUser, listUsers, updateUserPassword } from "@/app/actions/users";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserPlus, User as UserIcon, Key } from "lucide-react";
import { toast } from "sonner";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  registration: string;
}

export default function UsersManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const [passwordChangeUserId, setPasswordChangeUserId] = useState<string | null>(null);
  const [newPasswordForUser, setNewPasswordForUser] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (user?.email !== "admin@aems.app") {
        router.push("/dashboard");
      } else {
        loadUsers();
      }
    }
  }, [user, loading, router]);

  const loadUsers = async () => {
    setIsLoadingList(true);
    const res = await listUsers();
    if (res.success) {
      const mappedUsers = (res.users || []).map((u: any) => ({
        ...u,
        email: u.email || ''
      }));
      setUsersList(mappedUsers);
    }
    setIsLoadingList(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsCreating(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("password", password);

    const res = await createUser(formData);
    if (res.success) {
      toast.success("تم إنشاء الحساب بنجاح!");
      setName("");
      setEmail("");
      setPassword("");
      loadUsers();
    } else {
      setError(res.error || "حدث خطأ أثناء إنشاء الحساب");
    }
    setIsCreating(false);
  };

  const handleUpdatePassword = async (userId: string) => {
    if (newPasswordForUser.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    setIsChangingPassword(true);
    const res = await updateUserPassword(userId, newPasswordForUser);
    if (res.success) {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setPasswordChangeUserId(null);
      setNewPasswordForUser("");
    } else {
      toast.error(res.error || "حدث خطأ أثناء تغيير كلمة المرور");
    }
    setIsChangingPassword(false);
  };

  if (loading || user?.email !== "admin@aems.app") return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الحسابات</h1>
          <p className="text-sm text-gray-500 mt-1">إنشاء حسابات فرعية للكلية أو رؤساء الأقسام</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create User Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus size={18} className="text-blue-600" />
            حساب جديد
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">{error}</div>}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">الاسم</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-gray-50/50" placeholder="مثال: د. أحمد" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">البريد الإلكتروني</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-gray-50/50" placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">كلمة المرور (8 أحرف على الأقل)</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} minLength={8}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-gray-50/50" placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={isCreating} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
              {isCreating ? "جاري الإنشاء..." : "إنشاء الحساب"}
            </Button>
          </form>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UserIcon size={18} className="text-gray-600" />
              الحسابات المسجلة ({usersList.length})
            </h2>
          </div>
          
          {isLoadingList ? (
            <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
          ) : usersList.length === 0 ? (
            <div className="p-12 text-center text-gray-500">لا توجد حسابات أخرى.</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 font-semibold text-gray-600">الاسم</th>
                  <th className="px-6 py-3 font-semibold text-gray-600">البريد الإلكتروني</th>
                  <th className="px-6 py-3 font-semibold text-gray-600">تاريخ التسجيل</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {usersList.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {u.name} {u.email === "admin@aems.app" && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">المدير</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{u.email}</td>
                    <td className="px-6 py-3 text-gray-400">{new Date(u.registration).toLocaleDateString('ar-SA')}</td>
                    <td className="px-6 py-3 text-left">
                      {passwordChangeUserId === u.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input 
                            type="password" 
                            placeholder="كلمة المرور الجديدة"
                            value={newPasswordForUser}
                            onChange={(e) => setNewPasswordForUser(e.target.value)}
                            className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 w-36"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdatePassword(u.id)}
                            disabled={isChangingPassword}
                            className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3"
                          >
                            حفظ
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => {
                              setPasswordChangeUserId(null);
                              setNewPasswordForUser("");
                            }}
                            className="h-8 text-gray-500 hover:bg-gray-200"
                          >
                            إلغاء
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setPasswordChangeUserId(u.id)}
                          className="h-8 text-gray-600 border-gray-200 hover:bg-gray-100 bg-white"
                        >
                          <Key size={14} className="ml-1.5" />
                          تغيير المرور
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
