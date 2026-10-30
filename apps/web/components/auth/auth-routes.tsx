"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AuthScreen } from "./auth-screen";
import { AuthShell, type AuthVisualState } from "./auth-shell";
import "./auth.css";
/** Only the form remounts; the cinematic canvas survives Login ↔ Register. */
export function AuthRoutes({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = pathname === "/register" ? "register" : "login";
  const [visual, setVisual] = useState<{
    mode: string;
    state: AuthVisualState;
  }>({ mode, state: "idle" });
  return (
    <main id="auth-main" className="auth-standalone">
      <AuthShell
        mode={mode}
        state={visual.mode === mode ? visual.state : "idle"}
      >
        <AuthScreen
          key={mode}
          mode={mode}
          onState={(state) => setVisual({ mode, state })}
        />
      </AuthShell>
      {children}
    </main>
  );
}
