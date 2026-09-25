import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import CaptureForm from "./components/capture-form";
import { getCurrentUser } from "./lib/auth";
import { getUserLinks } from "./lib/user-links";
import { getUserPreferences } from "./lib/user-preferences";

/** Render the primary nibame capture surface. */
export default async function Home(): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [preferences, savedLinks] = await Promise.all([
    getUserPreferences(user.id),
    getUserLinks(user.id),
  ]);

  return (
    <main className="product-shell">
      <header className="product-header">
        <Link className="product-brand" href="/" aria-label="nibame home">
          <span className="product-brand-image">
            <Image src="/logo.png" alt="" width={96} height={96} priority />
          </span>
          <strong>nibame</strong>
        </Link>
        <div className="product-account">
          <span>{user.email}</span>
          <form action="/api/auth/logout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <CaptureForm
        initialCustomCategories={preferences.customCategories}
        initialCustomDomainRules={preferences.customDomainRules}
        initialSavedLinks={savedLinks}
      />
    </main>
  );
}
