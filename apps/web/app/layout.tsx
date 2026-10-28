import { Suspense } from "react";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
import "./studio-design.css";
export const metadata: Metadata = {
  title: {
    default: "ROMCRAFT — Build your own Android",
    template: "%s | ROMCRAFT",
  },
  description:
    "Design a personal Android configuration with an evidence-based ROM creation studio.",
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
        <Suspense
          fallback={<div className="craft-page">Loading ROMCRAFT…</div>}
        >
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
