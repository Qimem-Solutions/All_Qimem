import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPortfolioClient } from "@/components/hotel/public-portfolio-client";
import {
  fetchOpenJobsPublicByTenantId,
  fetchPublicPortfolioBySlug,
} from "@/lib/queries/tenant-branding-public";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const portfolio = await fetchPublicPortfolioBySlug(decodeURIComponent(slug));
  if (!portfolio) {
    return { title: "Property" };
  }
  return {
    title: `${portfolio.name} · Portfolio`,
    description: portfolio.description?.slice(0, 160) ?? `${portfolio.name} on All Qimem`,
  };
}

export default async function PublicPortfolioPage(props: Props) {
  const { slug: raw } = await props.params;
  const slug = decodeURIComponent(raw);
  const portfolio = await fetchPublicPortfolioBySlug(slug);
  if (!portfolio) notFound();

  const { rows: jobs } = await fetchOpenJobsPublicByTenantId(portfolio.id);

  return <PublicPortfolioClient portfolio={portfolio} jobs={jobs} />;
}
