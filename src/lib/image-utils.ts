'use client';

/**
 * تصغير الصور في المتصفح قبل تضمينها في بيانات التقرير.
 *
 * الشعارات والتوقيعات تُرسل base64 داخل جسم الطلب إلى /api/reports/analysis،
 * وحد جسم الطلب على Vercel قرابة 4.5 ميجابايت. شعار واحد بدقة الكاميرا يكفي
 * لتجاوز الحد فيفشل التصدير برسالة غامضة، لذلك نصغّر قبل الإرسال لا بعده.
 */

/** أقصى بُعد للشعار — أكبر بكثير مما يظهر فعلياً على الورق (نحو 36 مم) */
const MAX_LOGO_DIMENSION = 600;

/** جودة ضغط JPEG عند تسطيح الصور غير الشفافة */
const JPEG_QUALITY = 0.9;

/** فوق هذا الحجم نضغط؛ تحته نُبقي الملف كما هو */
const COMPRESS_THRESHOLD_BYTES = 200 * 1024;

/** الحجم التقريبي بالبايت لسلسلة data URL */
export function dataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;
  const base64 = dataUrl.slice(commaIndex + 1);
  return Math.floor((base64.length * 3) / 4);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('تعذّرت قراءة الصورة'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذّر فتح الصورة'));
    img.src = src;
  });
}

/**
 * يقرأ ملف صورة ويعيد data URL مصغّراً.
 * ملفات PNG تبقى PNG للحفاظ على الشفافية (مهم للشعارات والتوقيعات)،
 * وغيرها يُسطَّح إلى JPEG لأنه أصغر بفارق كبير.
 */
export async function readImageAsCompressedDataUrl(file: File): Promise<string> {
  const original = await readAsDataUrl(file);

  // الصور الصغيرة أصلاً لا تستفيد من إعادة الترميز
  if (dataUrlBytes(original) <= COMPRESS_THRESHOLD_BYTES) {
    return original;
  }

  try {
    const img = await loadImage(original);
    const largestSide = Math.max(img.width, img.height);
    const scale = largestSide > MAX_LOGO_DIMENSION ? MAX_LOGO_DIMENSION / largestSide : 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const keepsAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const compressed = keepsAlpha
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', JPEG_QUALITY);

    // إعادة الترميز قد تكبّر ملفات PNG البسيطة — نأخذ الأصغر
    return dataUrlBytes(compressed) < dataUrlBytes(original) ? compressed : original;
  } catch {
    // لو فشل التصغير لأي سبب، الصورة الأصلية أفضل من لا شيء
    return original;
  }
}

/**
 * يحوّل صورة عامة مخزّنة كرابط (مثل Supabase Storage) إلى data URL مضغوط.
 * قوالب رأس وتذييل Chromium لا تعتمد على تحميل الموارد الخارجية، لذلك يجب
 * تضمين شعارات وتوقيعات قاعدة البيانات قبل إرسال التقرير إلى الخادم.
 */
export async function readImageUrlAsCompressedDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`تعذّر تحميل الصورة (${response.status})`);
  const blob = await response.blob();
  const file = new File([blob], 'report-image', { type: blob.type || 'image/png' });
  return readImageAsCompressedDataUrl(file);
}
