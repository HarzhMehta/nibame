import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

import GitHubButton from "./github-button";

interface ProductHeaderProps {
  email: string;
}

/** Render shared authenticated navigation for web and Android. */
export default function ProductHeader({ email }: ProductHeaderProps): ReactElement {
  return (
    <header className="product-header">
      <Link className="product-brand" href="/" aria-label="nibame home">
        <span className="product-brand-image">
          <Image src="/logo.png" alt="" width={96} height={96} priority />
        </span>
        <strong>nibame</strong>
      </Link>
      <nav className="product-nav" aria-label="Primary navigation">
        <Link href="/">Home</Link>
        <Link href="/communities">Communities</Link>
      </nav>
      <div className="product-account">
        <span>{email}</span>
        <GitHubButton />
        <form action="/api/auth/logout" method="post">
          <button type="submit">Sign out</button>
        </form>
      </div>
    </header>
  );
}
