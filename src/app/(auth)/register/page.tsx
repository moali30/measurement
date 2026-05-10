"use client";

import { useState } from "react";
import { account, teams } from "@/lib/appwrite";
import { ID } from "appwrite";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Create User
      await account.create(ID.unique(), email, password, name);
      
      // 2. Login
      await account.createEmailPasswordSession(email, password);
      
      // 3. Create Team for University
      await teams.create(ID.unique(), universityName);
      
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء الحساب.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm border">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            تسجيل جامعة جديدة
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            أو{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              تسجيل الدخول لحساب موجود
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">اسم المسؤول</label>
              <input
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">اسم الجامعة / المؤسسة</label>
              <input
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={universityName}
                onChange={(e) => setUniversityName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
              <input
                type="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">كلمة المرور</label>
              <input
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "جاري الإنشاء..." : "إنشاء حساب"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
