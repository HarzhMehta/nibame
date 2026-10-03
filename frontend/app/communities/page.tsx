import type { ReactElement } from "react";

import ProductHeader from "../components/product-header";
import PublicHeader from "../components/public-header";
import { getCurrentUser } from "../lib/auth";
import { listCommunities } from "../lib/community-service";
import CommunityDirectory from "./community-directory";

/** Render public community discovery with authenticated actions when available. */
export default async function CommunitiesPage(): Promise<ReactElement> {
  const user = await getCurrentUser();
  const communities = await listCommunities(user);
  return (
    <main className={user ? "product-shell" : "public-shell"}>
      {user ? <ProductHeader email={user.email} /> : <PublicHeader />}
      <div className={user ? "product-content" : "public-content"}>
        <CommunityDirectory
          initialCommunities={communities}
          isAuthenticated={Boolean(user)}
          isSuperAdmin={user?.isSuperAdmin === true}
        />
      </div>
    </main>
  );
}
