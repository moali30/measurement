"use client";

import { useState } from "react";
import { account } from "@/lib/appwrite";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Don't delete existing sessions - allow multiple device login
      try { 
        await account.createEmailPasswordSession(email, password);
      } catch (sessionErr: any) {
        // If already has a session, try to use it
        if (sessionErr?.code === 401 || sessionErr?.type === 'user_already_has_session') {
          // Already logged in, just redirect
          window.location.href = "/dashboard";
          return;
        }
        throw sessionErr;
      }
      window.location.href = "/dashboard";
    } catch (err: any) {
      const msg = err?.message || "فشل تسجيل الدخول. يرجى التحقق من بياناتك.";
      // Make error messages more user-friendly
      if (msg.includes("fetch") || msg.includes("Failed") || msg.includes("network")) {
        setError("خطأ في الاتصال بالخادم. يرجى التأكد من اتصالك بالإنترنت والمحاولة مرة أخرى.");
      } else if (msg.includes("Invalid credentials") || msg.includes("password")) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-md w-full mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg shadow-blue-200 mb-4">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AEMS</h1>
          <p className="text-sm text-gray-500 mt-1">نظام إدارة القياس والتقويم الأكاديمي</p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-white/50">
          <h2 className="text-xl font-bold text-gray-900 mb-6">تسجيل الدخول</h2>
          
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-sm border border-red-100 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-gray-50/50"
                placeholder="admin@aems.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">كلمة المرور</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-gray-50/50"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 h-12 bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold shadow-md shadow-blue-200 transition-all duration-200 hover:shadow-lg hover:shadow-blue-300"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري تسجيل الدخول...
                </div>
              ) : "دخول"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2025 AEMS — Assessment & Evaluation Management System
        </p>
      </div>
    </div>
  );
}
