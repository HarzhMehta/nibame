import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import ProductHeader from "../components/product-header";
import { getCurrentUser } from "../lib/auth";
import { listCommunities } from "../lib/community-service";
import CommunityDirectory from "./community-directory";

/** Render authenticated community discovery and administration. */
export default async function CommunitiesPage(): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const communities = await listCommunities(user);
  return (
    <main className="product-shell">
      <ProductHeader email={user.email} />
      <div className="product-content">
        <CommunityDirectory
          initialCommunities={communities}
          isSuperAdmin={user.isSuperAdmin}
        />
      </div>
    </main>
  );
}
