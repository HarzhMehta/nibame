import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import CaptureForm from "./components/capture-form";
import ProductHeader from "./components/product-header";
import { getCurrentUser } from "./lib/auth";
import { getUserLinks } from "./lib/user-links";
import { getUserItems } from "./lib/user-items";
import { getUserPreferences } from "./lib/user-preferences";

/** Render the primary nibame capture surface. */
export default async function Home(): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [preferences, savedLinks, savedItems] = await Promise.all([
    getUserPreferences(user.id),
    getUserLinks(user.id),
    getUserItems(user.id),
  ]);

  return (
    <main className="product-shell">
      <ProductHeader email={user.email} />
      <CaptureForm
        initialCustomCategories={preferences.customCategories}
        initialCustomDomainRules={preferences.customDomainRules}
        initialSavedLinks={savedLinks}
        initialItems={savedItems}
      />
    </main>
  );
}
