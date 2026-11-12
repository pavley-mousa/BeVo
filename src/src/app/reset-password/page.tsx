"use client";

import { useEffect, useState } from "react";
import BeVoApp from "@/components/BeVoApp";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  if (!ready) {
    return (
      <main className="boot-screen" dir="rtl" lang="ar">
        <div className="boot-mark">B</div>
        <div className="boot-spinner" />
        <strong>جاري تجهيز صفحة إعادة تعيين كلمة المرور…</strong>
        <span>BeVo</span>
      </main>
    );
  }

  return <BeVoApp />;
}
