import { Suspense } from "react";
import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";
import "./studio-design.css";

export const metadata: Metadata = {
  title: {
    default: "NEXOS — Your Android. Your Rules.",
    template: "%s | NEXOS",
  },
  description: "NEXOS — Android Creation Studio. Your Android. Your Rules.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem('romhub-theme')||'dark'}catch{}
try{const m=document.cookie.match(/nexos_locale=([^;]+)/);if(m&&m[1]){document.documentElement.lang=decodeURIComponent(m[1]);}}catch{}`,
          }}
        />
      </head>
      <body>
        <I18nProvider>
          <Suspense fallback={<div className="craft-page">Loading NEXOS…</div>}>
            {children}
          </Suspense>
        </I18nProvider>
      </body>
    </html>
  );
}
