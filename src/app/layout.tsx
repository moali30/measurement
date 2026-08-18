import type { Metadata } from "next";
import { Cairo, Amiri } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/providers/ConfirmProvider";

const cairo = Cairo({ subsets: ["latin", "arabic"] });

// خط العناوين في التقرير المطبوع — نفس الخط المستخدم في هوية النظام المرجعي.
// يُستهلك عبر متغير CSS في print.css فقط، ولا يغيّر خط الواجهة.
const amiri = Amiri({
  subsets: ["latin", "arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Measurement & Evaluation Committee",
  description: "Academic Evaluation and Survey Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.className} ${amiri.variable}`}>
        <AuthProvider>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
          <Toaster position="bottom-center" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
