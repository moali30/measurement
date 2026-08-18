/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * أدوات بناء ملفات Excel لنتائج الاستبيانات على جانب العميل.
 * تُستخدم من صفحة قائمة الاستبيانات لتحميل النتائج مباشرة
 * دون الحاجة لفتح صفحة تفاصيل الاستبيان.
 */

import type { ExportSheetData } from "@/types/export";

export type { ExportSheetData };

/** فهرس عمود التاريخ داخل كل صف (يطابق ترتيب headers) */
const DATE_COLUMN_INDEX = 1;

/** تنسيق عرض التاريخ داخل Excel */
const DATE_NUMBER_FORMAT = "yyyy-mm-dd hh:mm";

/** أقصى طول مسموح به لاسم ورقة داخل ملف Excel */
const MAX_SHEET_NAME_LENGTH = 31;

/** محارف ممنوعة في أسماء أوراق Excel */
const INVALID_SHEET_CHARS = /[\\/?*[\]:]/g;

/** محارف ممنوعة في أسماء الملفات على ويندوز */
const INVALID_FILE_CHARS = /[\\/:*?"<>|\r\n\t]/g;

/**
 * يحوّل التاريخ إلى كائن Date حقيقي حتى يتعامل معه Excel كتاريخ
 * (فرز وتصفية صحيحة)، ويُعيد النص كما هو إذا تعذّر التحويل.
 */
function toDateCell(value: unknown): Date | string {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date;
}

/** ينظّف اسم الملف ويضمن ألا يكون فارغاً أو طويلاً بشكل مبالغ فيه */
export function sanitizeFileName(name: string, fallback = "نتائج-الاستبيان"): string {
  const cleaned = (name || "")
    .replace(INVALID_FILE_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, 120);
}

/** ينظّف اسم ورقة Excel ويضمن عدم تكراره داخل نفس الملف */
function buildSheetName(title: string, used: Set<string>, index: number): string {
  const base =
    (title || "")
      .replace(INVALID_SHEET_CHARS, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_SHEET_NAME_LENGTH) || `استبيان ${index + 1}`;

  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  // في حالة التكرار نضيف لاحقة رقمية مع الحفاظ على الحد الأقصى للطول
  for (let counter = 2; counter < 1000; counter++) {
    const suffix = ` (${counter})`;
    const candidate = base.slice(0, MAX_SHEET_NAME_LENGTH - suffix.length) + suffix;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  const fallback = `ورقة ${index + 1}`;
  used.add(fallback);
  return fallback;
}

/** يحوّل صفوف الورقة إلى مصفوفة جاهزة للكتابة مع تحويل عمود التاريخ */
function toAoa(sheet: ExportSheetData): (string | number | Date | null)[][] {
  const rows = sheet.rows.map((row) =>
    row.map((cell, colIndex) => (colIndex === DATE_COLUMN_INDEX ? toDateCell(cell) : cell))
  );
  return [sheet.headers, ...rows];
}

/** يحسب عرضاً تقريبياً مناسباً لكل عمود */
function buildColumnWidths(headers: string[]): { wch: number }[] {
  return headers.map((header, index) => {
    if (index === 0) return { wch: 5 };
    if (index === DATE_COLUMN_INDEX) return { wch: 20 };
    return { wch: Math.min(Math.max(String(header || "").length + 4, 14), 55) };
  });
}

/** يطبّق تنسيق التاريخ على خلايا عمود التاريخ */
function applyDateFormat(XLSX: any, worksheet: any) {
  const ref = worksheet["!ref"];
  if (!ref) return;

  const range = XLSX.utils.decode_range(ref);
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const address = XLSX.utils.encode_cell({ r: row, c: DATE_COLUMN_INDEX });
    const cell = worksheet[address];
    if (cell && cell.t === "d") cell.z = DATE_NUMBER_FORMAT;
  }
}

/**
 * يبني ملف Excel واحداً يحتوي ورقة لكل استبيان ثم ينزّله في المتصفح.
 */
export async function downloadSheetsAsWorkbook(
  sheets: ExportSheetData[],
  fileName: string
): Promise<void> {
  if (!sheets || sheets.length === 0) throw new Error("لا توجد بيانات للتصدير");

  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  sheets.forEach((sheet, index) => {
    const worksheet = XLSX.utils.aoa_to_sheet(toAoa(sheet) as any[][], { cellDates: true });
    (worksheet as any)["!cols"] = buildColumnWidths(sheet.headers);
    applyDateFormat(XLSX, worksheet);
    XLSX.utils.book_append_sheet(workbook, worksheet, buildSheetName(sheet.title, usedNames, index));
  });

  // اتجاه الأوراق من اليمين لليسار (يُقرأ من إعدادات المصنّف وليس الورقة)
  (workbook as any).Workbook = { ...(workbook as any).Workbook, Views: [{ RTL: true }] };

  const safeName = sanitizeFileName(fileName);
  XLSX.writeFile(workbook, safeName.endsWith(".xlsx") ? safeName : `${safeName}.xlsx`, { cellDates: true });
}

/** تاريخ اليوم بصيغة YYYY-MM-DD لاستخدامه في اسم الملف */
export function todayStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
