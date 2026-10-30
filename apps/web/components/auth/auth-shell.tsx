import { useId } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { PixelExperience } from "../pixel/pixel-experience";
import { NEXOSLogo } from "../nexos-logo";

export type AuthVisualState = "idle" | "pending" | "success";

export function AuthShell({
  mode,
  state,
  children,
  preview,
}: {
  mode: "login" | "register";
  state: AuthVisualState;
  children: React.ReactNode;
  preview?: React.ReactNode;
}) {
  const register = mode === "register";
  const headingId = `${mode}-${useId()}`;
  return (
    <section
      className="auth-experience"
      data-mode={mode}
      data-state={state}
      aria-labelledby={headingId}
    >
      <div className="auth-form-side">
        <div className="auth-form-content">
          <Link
            href="/login"
            className="auth-wordmark"
            aria-label="NEXOS Android Creation Studio home"
          >
            <NEXOSLogo size={28} />
          </Link>
          <div className="auth-overline">
            <span /> YOUR SPACE TO CREATE
          </div>
          <h1 id={headingId}>
            {register ? (
              <>
                Your next chapter
                <br />
                starts here.
              </>
            ) : (
              <>
                Good to have
                <br />
                you back.
              </>
            )}
          </h1>
          <p className="auth-intro">
            {register
              ? "Create an account. Save your ideas. Shape an Android that feels like you."
              : "Pick up where inspiration left off. Your Android, your way."}
          </p>
          {children}
          <p className="auth-switch">
            {register ? "Already part of NEXOS?" : "New around here?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create account"}
              <ArrowUpRight size={14} />
            </Link>
          </p>
        </div>
        <div className="auth-form-foot">
          <ShieldCheck size={15} />
          <span>Your ideas. Your personal workspace.</span>
        </div>
      </div>
      <aside
        className="auth-visual-side"
        aria-label="NEXOS cinematic product story"
      >
        {preview ?? (
          <PixelExperience mode={mode} success={state === "success"} />
        )}
      </aside>
    </section>
  );
}
