import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import CaptureForm from "../components/capture-form";
import ProductHeader from "../components/product-header";
import { getCurrentUser } from "../lib/auth";
import { getUserItems } from "../lib/user-items";
import { getUserLinks } from "../lib/user-links";
import { getUserPreferences } from "../lib/user-preferences";

/** Render the private Nibame workspace. */
export default async function HomePage(): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/home");
  const [preferences, savedLinks, savedItems] = await Promise.all([
    getUserPreferences(user.id),
    getUserLinks(user.id),
    getUserItems(user.id),
  ]);

  return (
    <main className="product-shell">
      <ProductHeader email={user.email} />
      <div className="product-content">
        <CaptureForm
          initialCustomCategories={preferences.customCategories}
          initialCustomDomainRules={preferences.customDomainRules}
          initialSavedLinks={savedLinks}
          initialItems={savedItems}
        />
      </div>
    </main>
  );
}
