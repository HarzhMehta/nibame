import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { getCurrentUser } from "../lib/auth";
import LoginForm from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{
    shared?: string | Array<string>;
    next?: string | Array<string>;
  }>;
}

/** Render the account entry screen for signed-out users. */
export default async function LoginPage({ searchParams }: LoginPageProps): Promise<ReactElement> {
  const parameters = await searchParams;
  const requestedNext = typeof parameters.next === "string" ? parameters.next : "";
  const nextPath =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext.slice(0, 512)
      : "/home";
  if (await getCurrentUser()) redirect(nextPath);
  const sharedValue = parameters.shared;
  const sharedUrl = typeof sharedValue === "string" ? sharedValue.slice(0, 2048) : undefined;

  return (
    <main className="auth-page">
      <Link className="product-brand auth-brand" href="/" aria-label="nibame home">
        <span className="product-brand-symbol" aria-hidden="true">n</span>
        <span className="product-brand-copy">
          <strong>nibame</strong>
          <small>personal index</small>
        </span>
      </Link>
      <section className="auth-intro" aria-label="nibame">
        <span>Capture / Sort / Return</span>
        <p>Links, tasks, notes.</p>
        <div className="auth-index" aria-hidden="true">
          <i>LINKS</i><i>TASKS</i><i>NOTES</i><i>PLACES</i>
        </div>
      </section>
      <LoginForm sharedUrl={sharedUrl} nextPath={nextPath} />
    </main>
  );
}
