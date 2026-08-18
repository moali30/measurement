"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import * as QRCode from "qrcode";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  QrCode,
  Share2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface FormShareDialogProps {
  title: string;
  slug: string;
  status: string;
  onClose: () => void;
}

function safeFileName(value: string) {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 80) || "استبيان";
}

export function FormShareDialog({ title, slug, status, onClose }: FormShareDialogProps) {
  const [publicUrl, setPublicUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const isActive = status === "active";

  useEffect(() => {
    const url = new URL(`/f/${encodeURIComponent(slug)}`, window.location.origin).toString();
    setPublicUrl(url);
    setCanNativeShare(typeof navigator.share === "function");
  }, [slug]);

  useEffect(() => {
    if (!publicUrl) return;

    let cancelled = false;
    setQrDataUrl("");
    setQrError("");

    QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 960,
      color: {
        dark: "#172554",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch((error: unknown) => {
        console.error("Failed to generate survey QR code:", error);
        if (!cancelled) setQrError("تعذر إنشاء رمز QR. حاول مرة أخرى.");
      });

    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const copyLink = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("تم نسخ رابط الاستبيان");
    } catch {
      const input = linkInputRef.current;
      if (!input) {
        toast.error("تعذر نسخ الرابط");
        return;
      }

      input.focus();
      input.select();
      const copied = document.execCommand("copy");
      window.getSelection()?.removeAllRanges();
      if (copied) toast.success("تم نسخ رابط الاستبيان");
      else toast.error("تعذر نسخ الرابط");
    }
  };

  const shareSurvey = async () => {
    if (!publicUrl || typeof navigator.share !== "function") return;

    try {
      await navigator.share({
        title,
        text: `شارك في استبيان: ${title}`,
        url: publicUrl,
      });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Failed to share survey:", error);
      toast.error("تعذرت المشاركة من هذا الجهاز");
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR - ${safeFileName(title)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("تم تحميل رمز QR");
  };

  const openSurvey = () => {
    if (publicUrl) window.open(publicUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        aria-describedby="share-dialog-description"
        dir="rtl"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-l from-blue-50 via-white to-white px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <QrCode size={24} />
            </div>
            <div className="min-w-0">
              <h2 id="share-dialog-title" className="text-lg font-bold text-slate-900">
                مشاركة الاستبيان
              </h2>
              <p id="share-dialog-description" className="mt-0.5 truncate text-sm text-slate-500">
                {title}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة المشاركة"
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X size={20} />
          </button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
              isActive
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {isActive ? (
              <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <TriangleAlert size={19} className="mt-0.5 shrink-0 text-amber-600" />
            )}
            <div>
              <p className="font-semibold">{isActive ? "الاستبيان نشط وجاهز لاستقبال الردود" : "الاستبيان مؤرشف"}</p>
              {!isActive && (
                <p className="mt-0.5 text-xs leading-5 text-amber-700">
                  الرابط ورمز QR سيعرضان صفحة الاستبيان المغلق حتى يتم تفعيله مرة أخرى.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[280px_1fr] md:items-center">
            <div className="mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt={`رمز QR لاستبيان ${title}`}
                  width={960}
                  height={960}
                  unoptimized
                  className="h-full w-full rounded-xl"
                />
              ) : qrError ? (
                <div className="px-4 text-center text-sm text-red-600">{qrError}</div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
                  <Loader2 size={28} className="animate-spin text-blue-600" />
                  جاري إنشاء رمز QR...
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="survey-share-link" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  رابط الاستبيان
                </label>
                <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                  <input
                    ref={linkInputRef}
                    id="survey-share-link"
                    type="text"
                    readOnly
                    value={publicUrl}
                    dir="ltr"
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 bg-transparent px-2 text-left text-xs text-slate-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
                  >
                    <Copy size={14} />
                    نسخ
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1">
                {canNativeShare && (
                  <button
                    type="button"
                    onClick={shareSurvey}
                    disabled={!publicUrl}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Share2 size={17} />
                    مشاركة من الجهاز
                  </button>
                )}
                <button
                  type="button"
                  onClick={downloadQr}
                  disabled={!qrDataUrl}
                  className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                >
                  <Download size={17} />
                  تحميل QR كصورة PNG
                </button>
                <button
                  type="button"
                  onClick={openSurvey}
                  disabled={!publicUrl}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <ExternalLink size={17} />
                  فتح الاستبيان
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs leading-5 text-slate-400">
            يمكن طباعة الصورة أو إضافتها إلى إعلان؛ عند مسحها بالكاميرا سيفتح رابط الاستبيان مباشرة.
          </p>
        </div>
      </section>
    </div>
  );
}
