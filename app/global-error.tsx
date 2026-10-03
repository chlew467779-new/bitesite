"use client";

/**
 * Shown only when the root layout itself fails (app/error.tsx covers everything below it).
 * Renders its own document without the site styles, so it uses inline styles, and reports the
 * crash for Admin's Site Errors (SYNC-070).
 */

import { useEffect } from "react";
import { reportBrowserError } from "@/lib/report-browser-error";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportBrowserError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F7F5F0", color: "#2C3E2D" }}>
        <title>Something went wrong · BiteSite</title>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box" }}>
          <section style={{ width: "100%", maxWidth: 480, background: "#fff", border: "1px solid #DDE5DC", borderRadius: 24, padding: 32, textAlign: "center", boxSizing: "border-box" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#5A8F6E" }}>BiteSite</p>
            <h1 style={{ margin: "16px 0 0", fontSize: 28 }}>Something went wrong</h1>
            <p style={{ margin: "16px 0 0", lineHeight: 1.7, color: "#6B6560" }}>We couldn&apos;t load this page right now. Please try again in a moment.</p>
            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              <button type="button" onClick={() => reset()} style={{ minHeight: 44, padding: "0 24px", borderRadius: 999, border: 0, background: "#5A8F6E", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Try again</button>
              {/* A full page load on purpose: the root layout is what failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 24px", borderRadius: 999, border: "1px solid #DDE5DC", color: "#2C3E2D", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Back to home</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
