import { headers } from "next/headers";
import { LoginForm } from "./login-form";
import {
  fetchTenantBrandingBySlug,
  tenantSlugFromHost,
} from "@/lib/queries/tenant-branding-public";

type Props = {
  searchParams: Promise<{
    oauth?: string;
    detail?: string;
    property?: string;
    slug?: string;
    tenant?: string;
  }>;
};

export default async function LoginPage(props: Props) {
  const searchParams = await props.searchParams;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const slugFromHost = tenantSlugFromHost(host);
  const slugParam = (
    searchParams.property ??
    searchParams.slug ??
    searchParams.tenant ??
    ""
  ).trim();
  const slug = slugParam || slugFromHost;
  const tenantBranding = slug ? await fetchTenantBrandingBySlug(slug) : null;

  return (
    <LoginForm
      oauth={searchParams.oauth}
      oauthDetail={searchParams.detail}
      tenantBranding={tenantBranding}
    />
  );
}
