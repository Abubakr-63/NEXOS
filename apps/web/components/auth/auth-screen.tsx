"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import {
  authenticationResponseSchema,
  type AuthenticationResponse,
} from "@rom-hub/contracts";
import { workspaceReturnPath } from "@/lib/return-path";
import { accountRequest } from "@/lib/account-api";
import { type AuthVisualState } from "./auth-shell";
import "./auth.css";

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function AuthScreen({
  mode,
  onState,
}: {
  mode: "login" | "register";
  onState: (state: AuthVisualState) => void;
}) {
  const register = mode === "register";
  const formId = `${mode}-${useId()}`;
  const ids = {
    username: `${formId}-username`,
    email: `${formId}-email`,
    password: `${formId}-password`,
    usernameHint: `${formId}-username-hint`,
    passwordHint: `${formId}-password-hint`,
  };
  const router = useRouter();
  const search = useSearchParams();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const [state, setState] = useState<AuthVisualState>("idle");
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const alert = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  function updateProgress(form: HTMLFormElement) {
    if (!register) return;
    const data = new FormData(form);
    const username = String(data.get("username") ?? "");
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const length = String(data.get("password") ?? "").length;
    setProgress(
      Number(/^[a-zA-Z0-9_]{3,30}$/.test(username)) +
        Number(!!email.value && email.validity.valid) +
        Number(length >= 12 && length <= 128),
    );
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setState("pending");
    onState("pending");
    setError("");
    try {
      const response = await accountRequest<AuthenticationResponse>(
        `auth/${mode}`,
        "POST",
        {
          email: form.get("email"),
          password: form.get("password"),
          ...(register ? { username: form.get("username") } : {}),
        },
      );
      if (!authenticationResponseSchema.safeParse(response).success)
        throw new Error(
          "The server returned an invalid account response. Please try again.",
        );
      if (!mounted.current) return;
      setState("success");
      onState("success");
      // Confirmed backend session only. No animation timer blocks navigation.
      router.replace(workspaceReturnPath(search.get("next")));
      router.refresh();
    } catch (cause) {
      if (!mounted.current) return;
      setState("idle");
      onState("idle");
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to connect. Try again.",
      );
    } finally {
      submitting.current = false;
    }
  }
  const pending = state !== "idle";
  return (
    <>
      <noscript>
        <p className="auth-error">
          Enable JavaScript to sign in or create an account.
        </p>
      </noscript>
      <form
        className="nexos-auth-form"
        method="post"
        onSubmit={submit}
        onInput={(event) => updateProgress(event.currentTarget)}
        aria-busy={!hydrated || state === "pending"}
      >
        <fieldset disabled={!hydrated || pending}>
          <legend className="auth-sr-only">
            {register ? "Create your account" : "Sign in to your account"}
          </legend>
          {register && (
            <div className="auth-field">
              <label htmlFor={ids.username}>Username</label>
              <input
                id={ids.username}
                name="username"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                autoComplete="username"
                placeholder="your_handle"
                aria-describedby={ids.usernameHint}
              />
              <small id={ids.usernameHint}>
                3–30 letters, numbers or underscores.
              </small>
            </div>
          )}
          <div className="auth-field">
            <label htmlFor={ids.email}>Email address</label>
            <input
              id={ids.email}
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
            />
          </div>
          <div className="auth-field">
            <label htmlFor={ids.password}>Password</label>
            <div className="auth-password-field">
              <input
                id={ids.password}
                name="password"
                type={visible ? "text" : "password"}
                required
                minLength={12}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={
                  register ? "Create a strong password" : "Enter your password"
                }
                aria-describedby={register ? ids.passwordHint : undefined}
              />
              <button
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {register && (
              <small id={ids.passwordHint}>Use 12–128 characters.</small>
            )}
          </div>
          {register && (
            <div
              className="auth-progress"
              aria-label={`${progress} of 3 fields meet their requirements`}
            >
              <span data-filled={progress >= 1} />
              <span data-filled={progress >= 2} />
              <span data-filled={progress >= 3} />
              <small>Make it your own.</small>
            </div>
          )}
          <button className="auth-submit" type="submit">
            {state === "pending" ? (
              <>
                <LoaderCircle className="auth-spinner" size={18} />
                {register ? "Creating account…" : "Signing in…"}
              </>
            ) : state === "success" ? (
              <>
                <Check size={18} />
                Workspace ready
              </>
            ) : (
              <>
                {register ? "Create account" : "Sign in"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </fieldset>
        {error && (
          <p ref={alert} tabIndex={-1} role="alert" className="auth-error">
            {error}
          </p>
        )}
        <p className="auth-status" role="status">
          {state === "pending"
            ? "Connecting securely to your account…"
            : state === "success"
              ? "Account confirmed. Opening your workspace…"
              : ""}
        </p>
      </form>
    </>
  );
}
