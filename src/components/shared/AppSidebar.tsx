"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  Users,
  BarChart,
  PenTool
} from "lucide-react";
import { useState } from "react";

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navigation = [
    { name: "الرئيسية", href: "/dashboard", icon: LayoutDashboard },
    { name: "الاستبيانات", href: "/dashboard/forms", icon: FileText },
    { name: "التحليل والتقارير", href: "/dashboard/analysis", icon: BarChart },
    { name: "التوقيعات", href: "/dashboard/signatures", icon: PenTool },
  ];

  if (user?.email === "admin@aems.app") {
    navigation.push({ name: "إدارة الحسابات", href: "/dashboard/users", icon: Users });
  }

  navigation.push({ name: "الإعدادات", href: "/dashboard/settings", icon: Settings });

  return (
    <div className={`flex flex-col ${collapsed ? 'w-20' : 'w-64'} bg-white border-l border-gray-100 h-full transition-all duration-300 shadow-sm`}>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 border-b border-gray-100 px-4">
        {!collapsed && (
          <h1 className="text-sm font-bold bg-gradient-to-l from-blue-700 to-blue-500 bg-clip-text text-transparent flex items-center gap-2 leading-tight">
            🎓 إدارة الاستبيانات (القياس والتقويم)
          </h1>
        )}
        {collapsed && <span className="text-2xl mx-auto">🎓</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <ChevronLeft size={18} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold shadow-md">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.name || "المستخدم"}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email || ""}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}
                title={collapsed ? item.name : undefined}
              >
                <item.icon
                  size={20}
                  className={`flex-shrink-0 ${
                    isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                  }`}
                />
                {!collapsed && item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={logout}
          className={`group flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? "تسجيل الخروج" : undefined}
        >
          <LogOut size={20} className="text-red-400 flex-shrink-0" />
          {!collapsed && "تسجيل الخروج"}
        </button>
      </div>
    </div>
  );
}
