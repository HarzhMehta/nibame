"use client";

import type { FormEvent, ReactElement } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register";

interface AuthResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

interface LoginFormProps {
  sharedUrl?: string;
}

type AuthStatusTone = "idle" | "progress" | "success" | "error";

interface AuthStatus {
  tone: AuthStatusTone;
  message: string;
}

/** Render the compact sign-in and registration form. */
export default function LoginForm({ sharedUrl }: LoginFormProps): ReactElement {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<AuthStatus>({ tone: "idle", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLocked = isSubmitting || status.tone === "success";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus({
      tone: "progress",
      message: mode === "login" ? "Checking your account..." : "Creating your account...",
    });
    if (mode === "register" && password !== confirmation) {
      setStatus({ tone: "error", message: "Passwords do not match." });
      confirmationRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as AuthResponse;
      if (!response.ok) {
        const fallbackMessage =
          response.status === 401
            ? "Email or password is incorrect."
            : response.status === 409
              ? "An account already exists for this email."
              : response.status === 503
                ? "Account service is temporarily unavailable. Try again."
                : "Could not continue. Try again.";
        throw new Error(
          response.status === 503
            ? fallbackMessage
            : payload.error?.message ?? fallbackMessage,
        );
      }
      setStatus({
        tone: "success",
        message: mode === "login" ? "Signed in. Opening nibame..." : "Account created. Opening nibame...",
      });
      if (sharedUrl) {
        await fetch("/api/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sharedUrl }),
        });
      }
      router.replace("/");
      router.refresh();
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Could not continue. Try again.";
      setStatus({ tone: "error", message });
      if (mode === "login" && message.toLocaleLowerCase().includes("password")) {
        passwordRef.current?.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeMode = (nextMode: AuthMode): void => {
    setMode(nextMode);
    setPassword("");
    setConfirmation("");
    setStatus({ tone: "idle", message: "" });
  };

  const clearErrorStatus = (): void => {
    if (status.tone === "error") setStatus({ tone: "idle", message: "" });
  };

  return (
    <div className="auth-card">
      <div className="auth-mode" role="group" aria-label="Account action">
        <button
          type="button"
          aria-pressed={mode === "login"}
          onClick={() => changeMode("login")}
          disabled={isLocked}
        >
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={mode === "register"}
          onClick={() => changeMode("register")}
          disabled={isLocked}
        >
          Create account
        </button>
      </div>

      <header className="auth-heading">
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      </header>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearErrorStatus();
            }}
            disabled={isLocked}
            required
            autoFocus
          />
        </label>
        <label>
          <span>Password</span>
          <input
            ref={passwordRef}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearErrorStatus();
            }}
            disabled={isLocked}
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        {mode === "register" && (
          <label>
            <span>Confirm password</span>
            <input
              ref={confirmationRef}
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                clearErrorStatus();
              }}
              disabled={isLocked}
              minLength={8}
              maxLength={128}
              required
            />
          </label>
        )}

        <div className={"auth-feedback is-" + status.tone} aria-live="polite">
          {status.message && (
            <p role={status.tone === "error" ? "alert" : "status"}>
              <i aria-hidden="true" />
              {status.message}
            </p>
          )}
        </div>
        <button className="auth-submit" type="submit" disabled={isLocked}>
          {status.tone === "success"
            ? "Signed in"
            : isSubmitting
              ? mode === "login"
                ? "Signing in"
                : "Creating account"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
        </button>
      </form>
    </div>
  );
}
