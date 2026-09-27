import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { getCurrentUser } from "../lib/auth";
import LoginForm from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ shared?: string | Array<string> }>;
}

/** Render the account entry screen for signed-out users. */
export default async function LoginPage({ searchParams }: LoginPageProps): Promise<ReactElement> {
  if (await getCurrentUser()) redirect("/");
  const sharedValue = (await searchParams).shared;
  const sharedUrl = typeof sharedValue === "string" ? sharedValue.slice(0, 2048) : undefined;

  return (
    <main className="auth-page">
      <Link className="product-brand auth-brand" href="/" aria-label="nibame home">
        <span className="product-brand-image">
          <Image src="/logo.png" alt="" width={96} height={96} priority />
        </span>
        <strong>nibame</strong>
      </Link>
      <LoginForm sharedUrl={sharedUrl} />
    </main>
  );
}
