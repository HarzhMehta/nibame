"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";

import GitHubButton from "./github-button";

interface ProductHeaderProps {
  email: string;
}

/** Render shared authenticated navigation for web and Android. */
export default function ProductHeader({ email }: ProductHeaderProps): ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed");
      router.replace("/login");
      router.refresh();
    } catch {
      form.submit();
    }
  };

  return (
    <header className="product-header">
      <Link className="product-brand" href="/" aria-label="nibame home">
        <span className="product-brand-symbol" aria-hidden="true">n</span>
        <span className="product-brand-copy">
          <strong>nibame</strong>
          <small>personal index</small>
        </span>
      </Link>
      <nav className="product-nav" aria-label="Primary navigation">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          <span>01</span>
          <strong>Home</strong>
        </Link>
        <Link
          href="/communities"
          aria-current={pathname.startsWith("/communities") ? "page" : undefined}
        >
          <span>02</span>
          <strong>Communities</strong>
        </Link>
        <Link href="/about" aria-current={pathname === "/about" ? "page" : undefined}>
          <span>03</span>
          <strong>About</strong>
        </Link>
      </nav>
      <div className="product-account">
        <div className="product-identity" title={email}>
          <i aria-hidden="true" />
          <span>{email}</span>
        </div>
        <GitHubButton />
        <form action="/api/auth/logout" method="post" onSubmit={handleSignOut}>
          <button type="submit" disabled={isSigningOut} aria-label="Sign out">
            <span>{isSigningOut ? "Signing out" : "Sign out"}</span>
            <b aria-hidden="true">↗</b>
          </button>
        </form>
      </div>
    </header>
  );
}
