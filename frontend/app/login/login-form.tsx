"use client";

import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register";

interface AuthResponse {
  error?: { message?: string };
}

interface LoginFormProps {
  sharedUrl?: string;
}

/** Render the compact sign-in and registration form. */
export default function LoginForm({ sharedUrl }: LoginFormProps): ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as AuthResponse;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Could not continue. Try again.");
      }
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
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not continue. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeMode = (nextMode: AuthMode): void => {
    setMode(nextMode);
    setPassword("");
    setConfirmation("");
    setError("");
  };

  return (
    <div className="auth-card">
      <div className="auth-mode" role="group" aria-label="Account action">
        <button type="button" aria-pressed={mode === "login"} onClick={() => changeMode("login")}>
          Sign in
        </button>
        <button type="button" aria-pressed={mode === "register"} onClick={() => changeMode("register")}>
          Create account
        </button>
      </div>

      <header className="auth-heading">
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p>Your categories and rules stay with you.</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        {mode === "register" && (
          <label>
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              maxLength={128}
              required
            />
          </label>
        )}

        <div className="auth-feedback" aria-live="polite">
          {error && <p role="alert">{error}</p>}
        </div>
        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Please wait" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
