import { Suspense } from "react";
import type { Metadata } from "next";
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
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem('romhub-theme')||'dark'}catch{}`,
          }}
        />
      </head>
      <body>
        <Suspense fallback={<div className="craft-page">Loading NEXOS…</div>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
