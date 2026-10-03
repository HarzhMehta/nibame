"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";

import GitHubButton from "./github-button";

interface ProductHeaderProps {
  email: string;
}

interface NavContentProps {
  index: string;
  label: string;
}

const PRODUCT_ROUTES = ["/home", "/communities", "/about"] as const;

function NavContent({ index, label }: NavContentProps): ReactElement {
  const { pending } = useLinkStatus();
  return (
    <>
      <span>{index}</span>
      <strong>{label}</strong>
      {pending && <i className="product-nav-pending" aria-hidden="true" />}
    </>
  );
}

/** Render shared authenticated navigation for web and Android. */
export default function ProductHeader({ email }: ProductHeaderProps): ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const prefetchTimer = window.setTimeout(() => {
      PRODUCT_ROUTES.forEach((route) => {
        if (route !== pathname) router.prefetch(route);
      });
    }, 100);
    return () => window.clearTimeout(prefetchTimer);
  }, [pathname, router]);

  const handleSignOut = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed");
      router.replace("/");
      router.refresh();
    } catch {
      form.submit();
    }
  };

  return (
    <header className="product-header">
      <Link className="product-brand" href="/home" aria-label="nibame home">
        <span className="product-brand-symbol" aria-hidden="true">n</span>
        <span className="product-brand-copy">
          <strong>nibame</strong>
          <small>personal index</small>
        </span>
      </Link>
      <nav className="product-nav" aria-label="Primary navigation">
        <Link href="/home" prefetch aria-current={pathname === "/home" ? "page" : undefined}>
          <NavContent index="01" label="Home" />
        </Link>
        <Link
          href="/communities"
          prefetch
          aria-current={pathname.startsWith("/communities") ? "page" : undefined}
        >
          <NavContent index="02" label="Communities" />
        </Link>
        <Link
          href="/about"
          prefetch
          aria-current={pathname === "/about" ? "page" : undefined}
        >
          <NavContent index="03" label="About" />
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
