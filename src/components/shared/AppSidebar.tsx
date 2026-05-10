"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FileText,
  Copy,
  Users,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

export function AppSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const navigation = [
    { name: "الرئيسية", href: "/dashboard", icon: LayoutDashboard },
    { name: "الفورمات", href: "/dashboard/forms", icon: FileText },
    { name: "القوالب", href: "/dashboard/templates", icon: Copy },
    { name: "الطلاب", href: "/dashboard/students", icon: Users },
    { name: "التقارير", href: "/dashboard/reports", icon: BarChart3 },
    { name: "الإعدادات", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col w-64 bg-white border-l border-gray-200 h-full">
      <div className="flex items-center justify-center h-16 border-b border-gray-200 px-4">
        <h1 className="text-xl font-bold text-blue-900 flex items-center gap-2">
          🎓 AEMS
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon
                  className={`ml-3 flex-shrink-0 h-5 w-5 ${
                    isActive ? "text-blue-700" : "text-gray-400 group-hover:text-gray-500"
                  }`}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={logout}
          className="group flex w-full items-center px-2 py-2 text-sm font-medium rounded-md text-red-600 hover:bg-red-50"
        >
          <LogOut className="ml-3 flex-shrink-0 h-5 w-5 text-red-500" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
