import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/providers/ConfirmProvider";

const cairo = Cairo({ subsets: ["latin", "arabic"] });

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
      <body className={cairo.className}>
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
