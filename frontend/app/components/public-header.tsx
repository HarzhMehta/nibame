"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useEffect } from "react";

import GitHubButton from "./github-button";

interface PublicNavLabelProps {
  label: string;
}

const PUBLIC_ROUTES = ["/", "/communities", "/about", "/login", "/home"] as const;

function PublicNavLabel({ label }: PublicNavLabelProps): ReactElement {
  const { pending } = useLinkStatus();
  return (
    <>
      <span>{label}</span>
      {pending && <i className="public-nav-pending" aria-hidden="true" />}
    </>
  );
}

/** Render navigation for public product pages. */
export default function PublicHeader(): ReactElement {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const prefetchTimer = window.setTimeout(() => {
      PUBLIC_ROUTES.forEach((route) => {
        if (route !== pathname) router.prefetch(route);
      });
    }, 100);
    return () => window.clearTimeout(prefetchTimer);
  }, [pathname, router]);

  return (
    <header className="public-header">
      <Link className="product-brand" href="/" prefetch aria-label="nibame home">
        <span className="product-brand-symbol" aria-hidden="true">n</span>
        <span className="product-brand-copy">
          <strong>nibame</strong>
          <small>personal index</small>
        </span>
      </Link>
      <nav className="public-nav" aria-label="Public navigation">
        <Link href="/" prefetch aria-current={pathname === "/" ? "page" : undefined}>
          <PublicNavLabel label="Overview" />
        </Link>
        <Link
          href="/communities"
          prefetch
          aria-current={pathname.startsWith("/communities") ? "page" : undefined}
        >
          <PublicNavLabel label="Communities" />
        </Link>
        <Link href="/about" prefetch aria-current={pathname === "/about" ? "page" : undefined}>
          <PublicNavLabel label="About" />
        </Link>
      </nav>
      <div className="public-actions">
        <GitHubButton />
        <Link className="public-sign-in" href="/login" prefetch>Sign in</Link>
        <Link className="public-open-app" href="/home" prefetch>Open app</Link>
      </div>
    </header>
  );
}
