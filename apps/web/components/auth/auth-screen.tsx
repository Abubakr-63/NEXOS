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
import { useTranslation } from "@/lib/i18n";
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
  const { t } = useTranslation("auth");
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
        throw new Error(t("invalidResponse"));
      if (!mounted.current) return;
      setState("success");
      onState("success");
      router.replace(workspaceReturnPath(search.get("next")));
      router.refresh();
    } catch (cause) {
      if (!mounted.current) return;
      setState("idle");
      onState("idle");
      setError(
        cause instanceof Error ? cause.message : t("genericError"),
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
          {t("noscript")}
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
            {register ? t("legendRegister") : t("legendSignIn")}
          </legend>
          {register && (
            <div className="auth-field">
              <label htmlFor={ids.username}>{t("username")}</label>
              <input
                id={ids.username}
                name="username"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                autoComplete="username"
                placeholder={t("usernamePlaceholder")}
                aria-describedby={ids.usernameHint}
              />
              <small id={ids.usernameHint}>
                {t("usernameHint")}
              </small>
            </div>
          )}
          <div className="auth-field">
            <label htmlFor={ids.email}>{t("email")}</label>
            <input
              id={ids.email}
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <div className="auth-field">
            <label htmlFor={ids.password}>{t("password")}</label>
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
                  register
                    ? t("passwordRegisterPlaceholder")
                    : t("passwordPlaceholder")
                }
                aria-describedby={register ? ids.passwordHint : undefined}
              />
              <button
                type="button"
                aria-label={visible ? t("hidePassword") : t("showPassword")}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {register && (
              <small id={ids.passwordHint}>{t("passwordHint")}</small>
            )}
          </div>
          {register && (
            <div
              className="auth-progress"
              aria-label={t("progressAria", { count: progress })}
            >
              <span data-filled={progress >= 1} />
              <span data-filled={progress >= 2} />
              <span data-filled={progress >= 3} />
              <small>{t("progressMakeOwn")}</small>
            </div>
          )}
          <button className="auth-submit" type="submit">
            {state === "pending" ? (
              <>
                <LoaderCircle className="auth-spinner" size={18} />
                {register ? t("creatingAccount") : t("signingIn")}
              </>
            ) : state === "success" ? (
              <>
                <Check size={18} />
                {t("workspaceReady")}
              </>
            ) : (
              <>
                {register ? t("createAccountBtn") : t("signInBtn")}
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
            ? t("connecting")
            : state === "success"
              ? t("confirmed")
              : ""}
        </p>
      </form>
    </>
  );
}
