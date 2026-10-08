"use client";

/**
 * Shown only when the root layout itself fails (app/error.tsx covers everything below it).
 * Renders its own document without the site styles, so it uses inline styles, and reports the
 * crash for Admin's Site Errors (SYNC-070).
 */

import { useEffect } from "react";
import { useT, useLang } from '@/lib/i18n';
import { reportBrowserError } from "@/lib/report-browser-error";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  const lang = useLang();
  useEffect(() => {
    console.error(error);
    reportBrowserError(error);
  }, [error]);

  return (
    <html lang={lang === 'zh' ? 'zh-Hans' : lang}>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F3F5F0", color: "#17201B" }}>
        <title>{t('error.title')} · BiteSite</title>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box" }}>
          <section style={{ width: "100%", maxWidth: 480, background: "#fff", border: "1px solid #E3E7DF", borderRadius: 24, padding: 32, textAlign: "center", boxSizing: "border-box" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#1F4D3A" }}>BiteSite</p>
            <h1 style={{ margin: "16px 0 0", fontSize: 28 }}>{t('error.title')}</h1>
            <p style={{ margin: "16px 0 0", lineHeight: 1.7, color: "#5B655E" }}>{t('error.rootBody')}</p>
            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              <button type="button" onClick={() => reset()} style={{ minHeight: 44, padding: "0 24px", borderRadius: 999, border: 0, background: "#1F4D3A", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t('public.retry')}</button>
              {/* A full page load on purpose: the root layout is what failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 24px", borderRadius: 999, border: "1px solid #E3E7DF", color: "#17201B", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{t('public.home')}</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
