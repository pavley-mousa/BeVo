import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "BeVo | البوابة الأكاديمية",
  description: "منصة متعددة الكليات لإدارة المواد والمحاضرات والسكاشن والتاسكات.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
